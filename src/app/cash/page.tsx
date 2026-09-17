'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { usePos } from '@/context/PosContext';
import {
  closePoint,
  getCash,
  getCashSalesSummary,
  getPaymentsSummary,
  getSaleDay,
  getSalesSummary,
} from '@/lib/pos-api';
import { printLinesBySettings } from '@/lib/printing';
import { clearUser } from '@/lib/session';

type R = Record<string, unknown>;

export default function Page() {
  return (
    <AppShell title="إغلاق الكاش">
      <Suspense fallback={<Loading />}>
        <Cash />
      </Suspense>
    </AppShell>
  );
}

function Cash() {
  const { user, printerSettings } = usePos();
  const sp = useSearchParams();
  const router = useRouter();
  const selectedNo = sp.get('cashNo');
  const selectedUser = Number(sp.get('cashUser') || 0);
  const returnTo = sp.get('returnTo');
  const lineDateParam = sp.get('lineDate') || '';
  const endDayMode = returnTo === 'end-day';

  const [cash, setCash] = useState<R | null>(null);
  const [payments, setPayments] = useState<R[]>([]);
  const [sales, setSales] = useState<R[]>([]);
  const [cashInfo, setCashInfo] = useState<R | null>(null);
  const [saleDay, setSaleDay] = useState<R | null>(null);
  const [available, setAvailable] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const cashUser = selectedUser || user.UserNo;
      const own = await getCash(cashUser);
      const c = { ...own, ...(selectedNo ? { CashNo: selectedNo } : {}) };
      setCash(c);

      const no = String(c.CashNo ?? selectedNo ?? '1');
      const [p, s, ci, sd] = await Promise.all([
        getPaymentsSummary(no, user.DefaultBranch),
        getSalesSummary(no),
        getCashSalesSummary(no),
        getSaleDay(user.DefaultBranch),
      ]);
      setPayments(p || []);
      setSales(s || []);
      setCashInfo(ci || {});
      setSaleDay(sd || {});
    } catch (e) {
      setCash(null);
      setError(e instanceof Error ? e.message : 'لا توجد نقطة بيع مفتوحة');
    } finally {
      setLoading(false);
    }
  }, [user, selectedNo, selectedUser]);

  useEffect(() => {
    load();
  }, [load]);

  const sale = sales[0] || {};
  const required = useMemo(
    () => n(cashInfo?.CashSales) + n(cashInfo?.CashCustody) - n(cashInfo?.Return ?? cashInfo?.OrderReturn),
    [cashInfo],
  );

  async function close() {
    if (!user || !cash) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        CashNo: String(cash.CashNo ?? selectedNo ?? '0'),
        CashUser: selectedUser || user.UserNo,
        CashRealEndTime: new Date().toISOString(),
        CashWithDrawals: 0,
        CashSubTotal: n(sale.SubTotal),
        CashDiscountTotal: n(sale.Discount),
        CashTaxTotal: n(sale.Tax),
        CashServiceTotal: 0,
        CashGrandTotal: n(sale.GrandTotal),
        RequiredCash: required,
        AvailableCash: Number(available) || 0,
        CashCustomerPayment: n(cashInfo?.CashSales),
        VoidAfter: n(cashInfo?.Return ?? cashInfo?.OrderReturn),
        VoidBefore: 0,
        IllegalOpenCashDrawer: 0,
      };

      await closePoint(payload);
      try {
        await printLinesBySettings(shiftLines(payload, payments, cashInfo), printerSettings, true);
      } catch {}

      setSuccess(`تم إغلاق الكاش رقم ${payload.CashNo} بنجاح`);
      setCash(null);

      if (endDayMode) {
        const d = lineDateParam || fmtDateIso(saleDay?.LineDate ?? cash.CashStartDate);
        router.replace(`/end-day?date=${encodeURIComponent(d)}`);
        return;
      }

      if (selectedNo) {
        router.replace('/cash/opened');
        return;
      }

      // مطابق لتدفق Flutter عند إغلاق شفت المستخدم من شاشة إغلاق الكاش العادية.
      await fetch('/api/auth/logout', { method: 'POST' });
      clearUser();
      router.replace('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل إغلاق الكاش');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="جاري تحميل بيانات الكاش..." />;

  const difference = (Number(available) || 0) - required;

  return (
    <main className="content cash-close-page">
      <section className="cash-close-hero card">
        <div className="cash-close-hero-copy">
          <div className="cash-close-eyebrow">إدارة نقطة البيع</div>
          <h1>إغلاق الكاش</h1>
          <p>
            راجع ملخص الشفت وطرق الدفع، ثم أدخل المبلغ الموجود فعليًا في الصندوق قبل إغلاق نقطة البيع.
          </p>
        </div>
        <div className={`cash-close-status ${cash ? 'open' : 'closed'}`}>
          <span className="cash-close-status-dot" />
          <div>
            <small>حالة نقطة البيع</small>
            <strong>{cash ? 'مفتوحة' : 'لا توجد نقطة مفتوحة'}</strong>
          </div>
        </div>
      </section>

      {endDayMode && (
        <div className="cash-close-alert warning">
          <b>إغلاق اليوم:</b> أنت تغلق هذه النقطة ضمن عملية إغلاق يوم العمل. بعد الإغلاق ستعود تلقائيًا إلى قائمة النقاط المفتوحة.
        </div>
      )}
      {success && <div className="cash-close-alert success">{success}</div>}
      {error && <div className="cash-close-alert error">{error}</div>}

      <section className="cash-close-toolbar card">
        <div>
          <strong>إجراءات نقطة البيع</strong>
          <span className="muted">يمكنك تحديث البيانات أو الانتقال إلى النقاط المفتوحة وتقارير اليوم.</span>
        </div>
        <div className="cash-close-toolbar-actions">
          {!cash && !endDayMode && <Link href="/cash/open" className="btn success">فتح نقطة بيع</Link>}
          <Link href={endDayMode ? `/end-day?date=${encodeURIComponent(lineDateParam)}` : '/cash/opened'} className="btn blue">
            النقاط المفتوحة
          </Link>
          <Link href="/reports" className="btn">تقارير اليوم</Link>
          <button className="btn" onClick={load}>↻ تحديث</button>
        </div>
      </section>

      {!cash ? (
        <section className="cash-close-empty card">
          <div className="cash-close-empty-icon">✓</div>
          <h2>لا توجد نقطة بيع مفتوحة</h2>
          <p>لا توجد نقطة بيع مفتوحة لهذا المستخدم حاليًا.</p>
        </section>
      ) : (
        <>
          <section className="cash-close-stats">
            <CashStat icon="▣" label="رقم الكاش" value={`#${String(cash.CashNo ?? '—')}`} />
            <CashStat icon="◷" label="يوم العمل" value={fmtDate(saleDay?.LineDate ?? cash.CashStartDate)} />
            <CashStat icon="¤" label="العهدة الافتتاحية" value={money(cashInfo?.CashCustody)} numeric />
            <CashStat icon="◈" label="مبيعات الكاش" value={money(cashInfo?.CashSales)} numeric />
            <CashStat icon="↶" label="المرتجعات" value={money(cashInfo?.Return ?? cashInfo?.OrderReturn)} numeric danger={n(cashInfo?.Return ?? cashInfo?.OrderReturn) > 0} />
            <CashStat icon="=" label="المبلغ المطلوب" value={money(required)} numeric emphasize />
          </section>

          <section className="cash-close-grid">
            <article className="cash-close-panel card">
              <div className="cash-close-panel-head">
                <div>
                  <span className="cash-close-panel-eyebrow">ملخص الشفت</span>
                  <h2>ملخص المبيعات</h2>
                </div>
                <span className="cash-close-chip">Cash #{String(cash.CashNo ?? '—')}</span>
              </div>

              <div className="cash-close-summary-list">
                <CashRow label="المجموع قبل الخصم" value={sale.SubTotal} />
                <CashRow label="الخصم" value={sale.Discount} />
                <CashRow label="الضريبة" value={sale.Tax} />
                <CashRow label="الخدمة" value={sale.Service} />
                <CashRow label="الإجمالي" value={sale.GrandTotal} total />
              </div>

              <div className="cash-close-section-divider" />

              <div className="cash-close-section-title">
                <div>
                  <span className="cash-close-panel-eyebrow">التوزيع المالي</span>
                  <h3>طرق الدفع</h3>
                </div>
                <span className="cash-close-count">{payments.length}</span>
              </div>

              <div className="cash-close-payments">
                {payments.length ? payments.map((pay, i) => (
                  <div className="cash-close-payment-row" key={i}>
                    <div className="cash-close-payment-icon">{i + 1}</div>
                    <span>{String(pay.Desc ?? pay.TypeArDesc ?? pay.Type ?? `طريقة ${i + 1}`)}</span>
                    <b className="num">{money(pay.sum ?? pay.Sum ?? pay.Payments)}</b>
                  </div>
                )) : (
                  <div className="cash-close-no-data">لا توجد بيانات دفع لهذا الشفت.</div>
                )}
              </div>
            </article>

            <article className="cash-close-panel cash-close-final-panel card">
              <div className="cash-close-panel-head">
                <div>
                  <span className="cash-close-panel-eyebrow">التسوية النهائية</span>
                  <h2>إغلاق نقطة البيع</h2>
                </div>
                <span className="cash-close-open-badge"><span /> مفتوحة</span>
              </div>

              <p className="cash-close-help">
                عدّ المبلغ الموجود فعليًا في الصندوق وأدخله هنا. هذه العملية تغلق نقطة البيع الحالية فقط ولا تغلق يوم العمل.
              </p>

              <label className="cash-close-available-field">
                <span>المبلغ المتوفر فعليًا</span>
                <div className="cash-close-input-wrap">
                  <input
                    className="cash-close-available-input num"
                    inputMode="decimal"
                    value={available}
                    onChange={(e) => setAvailable(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <small>{user?.DefaultCurrency || ''}</small>
                </div>
              </label>

              <div className="cash-close-reconcile">
                <CashReconcile label="المطلوب" value={required} />
                <CashReconcile label="المتوفر" value={Number(available) || 0} />
                <CashReconcile label="الفرق" value={difference} difference />
              </div>

              <div className={`cash-close-difference-note ${difference === 0 ? 'balanced' : difference > 0 ? 'over' : 'short'}`}>
                <span className="cash-close-difference-dot" />
                <div>
                  <b>{difference === 0 ? 'الصندوق متطابق' : difference > 0 ? 'يوجد زيادة في الصندوق' : 'يوجد نقص في الصندوق'}</b>
                  <small>
                    {difference === 0
                      ? 'المبلغ المتوفر يطابق المبلغ المطلوب.'
                      : `قيمة الفرق ${money(Math.abs(difference))} ${user?.DefaultCurrency || ''}`}
                  </small>
                </div>
              </div>

              <button className="btn danger cash-close-submit" disabled={saving} onClick={close}>
                {saving ? 'جاري إغلاق الكاش...' : 'إغلاق الكاش'}
              </button>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function CashStat({ icon, label, value, numeric, danger, emphasize }: { icon: string; label: string; value: string; numeric?: boolean; danger?: boolean; emphasize?: boolean }) {
  return (
    <div className={`cash-close-stat card ${danger ? 'danger' : ''} ${emphasize ? 'emphasize' : ''}`}>
      <div className="cash-close-stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong className={numeric ? 'num' : ''}>{value}</strong>
      </div>
    </div>
  );
}

function CashRow({ label, value, total }: { label: string; value: unknown; total?: boolean }) {
  return (
    <div className={`cash-close-summary-row ${total ? 'total' : ''}`}>
      <span>{label}</span>
      <b className="num">{money(value)}</b>
    </div>
  );
}

function CashReconcile({ label, value, difference }: { label: string; value: number; difference?: boolean }) {
  return (
    <div className={`cash-close-reconcile-card ${difference ? 'difference' : ''}`}>
      <span>{label}</span>
      <b className="num">{money(value)}</b>
    </div>
  );
}

function n(v: unknown) { return Number(v) || 0; }
function money(v: unknown) { return n(v).toFixed(3); }
function fmtDate(v: unknown) {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('ar-JO');
}
function fmtDateIso(v: unknown) {
  const raw = String(v ?? '');
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || new Date().toISOString().slice(0, 10);
}

function shiftLines(p: Record<string, unknown>, payments: Record<string, unknown>[], cashInfo: Record<string, unknown> | null) {
  return [
    'FUTEC POS',
    'تقرير إغلاق الشفت',
    `Cash: ${String(p.CashNo ?? '')}`,
    `User: ${String(p.CashUser ?? '')}`,
    `Date: ${new Date().toLocaleString('ar-JO')}`,
    '--------------------------------',
    `Subtotal: ${money(p.CashSubTotal)}`,
    `Discount: ${money(p.CashDiscountTotal)}`,
    `Tax: ${money(p.CashTaxTotal)}`,
    `Grand Total: ${money(p.CashGrandTotal)}`,
    `Cash Sales: ${money(cashInfo?.CashSales)}`,
    `Returns: ${money(cashInfo?.Return ?? cashInfo?.OrderReturn)}`,
    `Opening Balance: ${money(cashInfo?.CashCustody)}`,
    `Required: ${money(p.RequiredCash)}`,
    `Available: ${money(p.AvailableCash)}`,
    '--------------------------------',
    ...payments.map((x) => `${String(x.Desc ?? x.TypeArDesc ?? x.Type ?? 'Payment')}: ${money(x.sum ?? x.Sum ?? x.Payments)}`),
  ];
}
