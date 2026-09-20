'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { usePos } from '@/context/PosContext';
import { ApiError } from '@/lib/api-client';
import { endDay, getLineSummary, getOpenedPoints, getSaleDay, getZReport } from '@/lib/pos-api';
import { printEndDayReport, type EndDayPrintData } from '@/lib/printing';
import { closePosApplication } from '@/lib/app-close';

type R = Record<string, unknown>;

export default function Page() {
  return (
    <AppShell title="إغلاق اليوم">
      <Suspense fallback={<Loading label="جاري تحميل يوم العمل..." />}>
        <EndDay />
      </Suspense>
    </AppShell>
  );
}

function EndDay() {
  const { user, printerSettings } = usePos();
  const router = useRouter();
  const search = useSearchParams();
  const requestedDate = search.get('date') || '';

  const [lineDate, setLineDate] = useState(requestedDate || localDateOnly());
  const [saleDay, setSaleDay] = useState<R | null>(null);
  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastPrintReport, setLastPrintReport] = useState<EndDayPrintData | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      let date = requestedDate || lineDate || localDateOnly();
      let day: R | null = null;

      try {
        const current = await getSaleDay(user.DefaultBranch);
        if (current?.LineDate) {
          day = current;
          if (!requestedDate) date = dateOnly(current.LineDate);
        }
      } catch (e) {
        if (!isNoOpenDay(e)) throw e;
      }

      setSaleDay(day);
      setLineDate(date);

      if (!day && !requestedDate) {
        setRows([]);
        return;
      }

      const opened = await getOpenedPoints(date, user.DefaultBranch);
      setRows(opened || []);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [user, requestedDate, lineDate]);

  useEffect(() => {
    load();
    // load is intentionally run when the user/date changes; lineDate is synchronized inside load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requestedDate]);

  const canCloseDay = Boolean(saleDay || requestedDate) && rows.length === 0 && !loading;
  const openedCount = rows.length;
  const usersCount = useMemo(() => new Set(rows.map((x) => String(x.CashUser ?? x.cashUser ?? ''))).size, [rows]);

  function closePointUrl(x: R) {
    const params = new URLSearchParams({
      cashNo: String(x.CashNo ?? x.cashNo ?? ''),
      cashUser: String(x.CashUser ?? x.cashUser ?? ''),
      returnTo: 'end-day',
      lineDate,
    });
    return `/cash?${params.toString()}`;
  }

  async function closeWorkDay() {
    if (!user || !canCloseDay) return;
    setClosing(true);
    setError('');
    setMessage('');
    try {
      const opened = await getOpenedPoints(lineDate, user.DefaultBranch);
      setRows(opened || []);
      if ((opened || []).length > 0) {
        setError('تم العثور على نقاط بيع مفتوحة. يجب إغلاق جميع النقاط قبل إغلاق يوم العمل.');
        return;
      }

      const closedAt = new Date().toISOString();
      await endDay({
        LineDate: lineDate,
        CloseTime: closedAt,
        WareHouse: user.DefaultBranch,
      });

      const [zReport, daySummary] = await Promise.all([
        getZReport(user.DefaultBranch, lineDate).catch(() => []),
        getLineSummary(user.DefaultBranch, lineDate).catch(() => []),
      ]);
      const reportData: EndDayPrintData = { lineDate, closedAt, z: zReport || [], summary: daySummary || [] };
      setLastPrintReport(reportData);
      setSaleDay(null);
      try {
        await printEndDayReport(reportData, user, printerSettings);
      } catch (printError) {
        setMessage('تم إغلاق يوم العمل بنجاح، لكن الطباعة لم تكتمل.');
        setError(printError instanceof Error ? `فشل طباعة تقرير إغلاق اليوم: ${printError.message}` : 'فشل طباعة تقرير إغلاق اليوم');
        return;
      }
      setLastPrintReport(null);
      setMessage('تم إغلاق يوم العمل وطباعته بنجاح.');
      await closePosApplication();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setClosing(false);
    }
  }

  async function retryEndDayPrint() {
    if (!user || !lastPrintReport) return;
    setClosing(true);
    setError('');
    try {
      await printEndDayReport(lastPrintReport, user, printerSettings);
      setLastPrintReport(null);
      await closePosApplication();
    } catch (e) {
      setError(e instanceof Error ? `فشل طباعة تقرير إغلاق اليوم: ${e.message}` : 'فشل طباعة تقرير إغلاق اليوم');
    } finally {
      setClosing(false);
    }
  }

  return (
    <main className="content end-day-page">
      <section className="end-day-hero card">
        <div className="end-day-hero-copy">
          <div className="end-day-eyebrow">إدارة نهاية يوم العمل</div>
          <h1>إغلاق اليوم</h1>
          <p>راجع نقاط البيع المفتوحة وأغلقها واحدة تلو الأخرى. بعد إغلاق آخر نقطة سيتاح إغلاق يوم العمل.</p>
        </div>
        <div className={`end-day-status ${saleDay || requestedDate ? 'open' : 'closed'}`}>
          <span className="end-day-status-dot" />
          <div>
            <small>حالة يوم العمل</small>
            <strong>{saleDay || requestedDate ? 'مفتوح' : 'لا يوجد يوم مفتوح'}</strong>
          </div>
        </div>
      </section>

      {error && <div className="end-day-alert error">{error}</div>}
      {message && <div className="end-day-alert success">{message}</div>}
      {lastPrintReport && <div className="end-day-alert warning"><b>تقرير إغلاق اليوم جاهز لإعادة الطباعة.</b> <button className="btn" onClick={retryEndDayPrint} disabled={closing}>إعادة الطباعة</button></div>}

      <section className="end-day-stats">
        <Stat icon="▣" label="يوم العمل" value={lineDate || '—'} />
        <Stat icon="◫" label="النقاط المفتوحة" value={String(openedCount)} danger={openedCount > 0} />
        <Stat icon="♙" label="المستخدمون" value={String(usersCount)} />
        <Stat icon="⌂" label="الفرع" value={user?.BranchName || user?.DefaultBranch || '—'} />
      </section>

      <section className="end-day-toolbar card">
        <div>
          <strong>نقاط البيع المفتوحة</strong>
          <span className="muted">يتم تحديث القائمة بعد كل عملية إغلاق.</span>
        </div>
        <button className="btn" onClick={load} disabled={loading || closing}>↻ تحديث القائمة</button>
      </section>

      {loading ? (
        <Loading label="جاري تحميل نقاط البيع المفتوحة..." />
      ) : (
        <>
          {rows.length > 0 ? (
            <section className="end-day-points">
              {rows.map((x, i) => (
                <article className="end-day-point-card card" key={`${String(x.CashNo ?? x.cashNo ?? '')}-${i}`}>
                  <div className="end-day-point-top">
                    <div className="end-day-point-number">
                      <small>رقم النقطة</small>
                      <strong className="num">#{String(x.CashNo ?? x.cashNo ?? '—')}</strong>
                    </div>
                    <span className="end-day-open-badge"><span /> مفتوحة</span>
                  </div>

                  <div className="end-day-point-info">
                    <Info label="المستخدم" value={String(x.CashUser ?? x.cashUser ?? '—')} />
                    <Info label="وقت الفتح" value={fmtDateTime(x.CashRealTime ?? x.CashStartDate ?? x.cashStartDate)} />
                    <Info label="العهدة" value={money(x.CashCustody ?? x.cashCustody)} numeric />
                    <Info label="التاريخ" value={dateOnly(x.CashStartDate ?? x.cashStartDate ?? lineDate)} />
                  </div>

                  <button className="btn danger end-day-close-point" onClick={() => router.push(closePointUrl(x))}>
                    إغلاق هذه النقطة
                  </button>
                </article>
              ))}
            </section>
          ) : (
            <section className="end-day-empty card">
              <div className="end-day-empty-icon">✓</div>
              <h2>{saleDay || requestedDate ? 'جميع نقاط البيع مغلقة' : 'لا يوجد يوم عمل مفتوح'}</h2>
              <p>
                {saleDay || requestedDate
                  ? 'لا توجد نقاط بيع مفتوحة لهذا اليوم. يمكنك الآن إغلاق يوم العمل.'
                  : 'لا يوجد يوم عمل مفتوح حاليًا لإغلاقه.'}
              </p>
            </section>
          )}

          <section className={`end-day-final card ${canCloseDay ? 'ready' : ''}`}>
            <div className="end-day-final-copy">
              <div className="end-day-final-icon">◷</div>
              <div>
                <h2>إغلاق يوم العمل</h2>
                <p>
                  {rows.length > 0
                    ? `متبقي ${rows.length} نقطة مفتوحة. أغلق جميع النقاط أولًا.`
                    : canCloseDay
                      ? `كل النقاط مغلقة. يوم ${lineDate} جاهز للإغلاق.`
                      : 'لا يوجد يوم عمل متاح للإغلاق.'}
                </p>
              </div>
            </div>
            <button className="btn danger end-day-close-day" disabled={!canCloseDay || closing} onClick={closeWorkDay}>
              {closing ? 'جاري إغلاق اليوم...' : 'إغلاق يوم العمل'}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ icon, label, value, danger }: { icon: string; label: string; value: string; danger?: boolean }) {
  return (
    <div className={`end-day-stat card ${danger ? 'danger' : ''}`}>
      <div className="end-day-stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong className="num">{value}</strong>
      </div>
    </div>
  );
}

function Info({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="end-day-info-row">
      <span>{label}</span>
      <b className={numeric ? 'num' : ''}>{value}</b>
    </div>
  );
}

function isNoOpenDay(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 400 || error.status === 404) return true;
  return /not\s*found|no\s*data|لا يوجد|مغلق/i.test(error.message);
}
function errorText(e: unknown) { return e instanceof Error ? e.message : 'فشل تنفيذ العملية'; }
function money(v: unknown) { return (Number(v) || 0).toFixed(3); }
function localDateOnly(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dateOnly(v: unknown) {
  const raw = String(v ?? '');
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw || '—' : localDateOnly(d);
}
function fmtDateTime(v: unknown) {
  const raw = String(v ?? '');
  if (!raw) return '—';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('ar-JO', { dateStyle: 'short', timeStyle: 'short' });
}
