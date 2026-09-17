'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { usePos } from '@/context/PosContext';
import { endDay, getOpenedPoints, getSaleDay } from '@/lib/pos-api';

type R = Record<string, unknown>;

export default function Page() {
  return (
    <AppShell title="نقاط البيع المفتوحة / إغلاق اليوم">
      <Suspense fallback={<Loading />}>
        <Opened />
      </Suspense>
    </AppShell>
  );
}

function Opened() {
  const { user } = usePos();
  const router = useRouter();
  const search = useSearchParams();
  const endDayMode = search.get('mode') === 'end-day';
  const queryDate = search.get('date') || '';

  const [date, setDate] = useState(queryDate || new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingDay, setClosingDay] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      let d = queryDate || date;
      if (!queryDate) {
        try {
          const s = await getSaleDay(user.DefaultBranch);
          if (s?.LineDate) d = String(s.LineDate).slice(0, 10);
        } catch {}
      }
      setDate(d);
      const opened = await getOpenedPoints(d, user.DefaultBranch);
      setRows(opened || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تحميل نقاط البيع المفتوحة');
    } finally {
      setLoading(false);
    }
  }, [user, queryDate, date]);

  useEffect(() => {
    if (endDayMode) {
      router.replace(`/end-day?date=${encodeURIComponent(queryDate || date)}`);
      return;
    }
    load();
  }, [endDayMode, queryDate, date, load, router]);

  async function closeDay() {
    if (!user) return;
    setClosingDay(true);
    setError('');
    setMessage('');
    try {
      const opened = await getOpenedPoints(date, user.DefaultBranch);
      setRows(opened || []);
      if ((opened || []).length > 0) {
        setError('لا يمكن إغلاق اليوم قبل إغلاق جميع نقاط البيع المفتوحة.');
        return;
      }

      await endDay({
        LineDate: date,
        CloseTime: new Date().toISOString(),
        WareHouse: user.DefaultBranch,
      });
      setMessage('تم إغلاق يوم العمل بنجاح.');
      router.replace(`/reports?tab=z&lineDate=${encodeURIComponent(date)}&closed=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل إغلاق يوم العمل');
    } finally {
      setClosingDay(false);
    }
  }

  const pointUrl = (x: R) => {
    const params = new URLSearchParams({
      cashNo: String(x.CashNo ?? ''),
      cashUser: String(x.CashUser ?? ''),
    });
    if (endDayMode) {
      params.set('returnTo', 'end-day');
      params.set('lineDate', date);
    }
    return `/cash?${params.toString()}`;
  };

  return (
    <main className="content">
      {endDayMode && (
        <div className="card" style={{ padding: 16, marginBottom: 12, borderColor: '#efc96a', background: '#fffaf0' }}>
          <h3 style={{ margin: '0 0 6px' }}>إغلاق يوم العمل</h3>
          <div className="muted">
            أغلق كل نقطة بيع مفتوحة أولًا. بعد إغلاق آخر نقطة سيتفعّل زر إغلاق اليوم.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ minWidth: 220 }}>
          تاريخ يوم العمل
          <input
            className="input"
            type="date"
            value={date}
            disabled={endDayMode && Boolean(queryDate)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="btn primary" onClick={load}>تحديث</button>
        {!endDayMode && <button className="btn" onClick={() => router.push('/cash')}>رجوع لإغلاق الكاش</button>}
        {endDayMode && <button className="btn" onClick={() => router.push('/reports?tab=day')}>رجوع للتقارير</button>}
      </div>

      {error && <div className="card" style={{ padding: 12, color: '#a22', marginBottom: 10 }}>{error}</div>}
      {message && <div className="card" style={{ padding: 12, color: '#087658', marginBottom: 10 }}>{message}</div>}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid3">
            {rows.map((x, i) => (
              <div className="card" style={{ padding: 16 }} key={`${String(x.CashNo ?? '')}-${i}`}>
                <div className="muted">رقم الكاش</div>
                <h2 className="num" style={{ margin: '4px 0 12px' }}>{String(x.CashNo ?? '—')}</h2>
                <div>المستخدم: <b className="num">{String(x.CashUser ?? '—')}</b></div>
                <div className="muted" style={{ marginTop: 5 }}>البداية: {fmt(x.CashStartDate ?? x.CashRealTime)}</div>
                <button
                  className="btn danger"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => router.push(pointUrl(x))}
                >
                  {endDayMode ? 'إغلاق هذه النقطة ثم العودة' : 'إغلاق هذا الكاش'}
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="card empty" style={{ gridColumn: '1/-1', borderColor: endDayMode ? '#8fd6bd' : undefined }}>
                {endDayMode ? 'تم إغلاق جميع نقاط البيع. يمكنك الآن إغلاق يوم العمل.' : 'لا توجد نقاط بيع مفتوحة'}
              </div>
            )}
          </div>

          {endDayMode && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px' }}>إغلاق اليوم</h3>
                  <div className="muted">
                    {rows.length > 0
                      ? `متبقي ${rows.length} نقطة مفتوحة. أغلقها قبل إغلاق اليوم.`
                      : `لا توجد نقاط مفتوحة ليوم ${date}.`}
                  </div>
                </div>
                <button className="btn danger" disabled={closingDay || rows.length > 0} onClick={closeDay} style={{ minWidth: 180, height: 48 }}>
                  {closingDay ? 'جاري إغلاق اليوم...' : 'إغلاق يوم العمل'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function fmt(v: unknown) {
  const d = new Date(String(v || ''));
  return Number.isNaN(d.getTime()) ? String(v || '') : d.toLocaleString('ar-JO');
}
