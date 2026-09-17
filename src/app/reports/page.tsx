'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { usePos } from '@/context/PosContext';
import { getCategorySales, getLineSummary, getSaleDay, getZReport } from '@/lib/pos-api';
import { unwrapResponse } from '@/lib/api-client';

type R = Record<string, unknown>;
type Tab = 'category' | 'z';
const today = () => new Date().toISOString().slice(0, 10);

export default function Page() {
  return (
    <AppShell title="التقارير">
      <Suspense fallback={<Loading />}>
        <Reports />
      </Suspense>
    </AppShell>
  );
}

function Reports() {
  const { user } = usePos();
  const search = useSearchParams();
  const queryTab = search.get('tab');
  const queryLineDate = search.get('lineDate') || '';
  const closed = search.get('closed') === '1';

  const [tab, setTab] = useState<Tab>(queryTab === 'z' ? 'z' : 'category');
  const [from, setFrom] = useState(queryLineDate || today());
  const [to, setTo] = useState(queryLineDate || today());
  const [lineDate, setLineDate] = useState(queryLineDate || today());
  const [category, setCategory] = useState<R[]>([]);
  const [z, setZ] = useState<R[]>([]);
  const [summary, setSummary] = useState<R[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg] = useState(closed ? 'تم إغلاق يوم العمل بنجاح. تم تحميل تقرير الإغلاق.' : '');

  useEffect(() => {
    if (queryTab === 'z') setTab('z');
    if (queryLineDate) {
      setLineDate(queryLineDate);
      setFrom(queryLineDate);
      setTo(queryLineDate);
    }
  }, [queryTab, queryLineDate]);

  useEffect(() => {
    if (!user || queryLineDate) return;
    (async () => {
      try {
        const s = await getSaleDay(user.DefaultBranch);
        if (s?.LineDate) {
          const d = String(s.LineDate).slice(0, 10);
          setLineDate(d);
          setFrom(d);
          setTo(d);
        }
      } catch {}
    })();
  }, [user, queryLineDate]);

  useEffect(() => {
    if (user && queryTab === 'z' && queryLineDate) loadZ(queryLineDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryTab, queryLineDate]);

  async function loadCategory() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const raw = await getCategorySales(user.DefaultBranch, from, to);
      setCategory(unwrapResponse<R[]>(raw) || []);
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadZ(date = lineDate) {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [a, b] = await Promise.all([
        getZReport(user.DefaultBranch, date),
        getLineSummary(user.DefaultBranch, date),
      ]);
      setZ(a || []);
      setSummary(b || []);
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }

  const cats = useMemo(
    () => category.map((x, i) => ({ key: i, c: (x.cateSales ?? x.CateSales ?? x) as R })),
    [category],
  );

  return (
    <main className="content">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'category' ? 'primary' : ''}`} onClick={() => setTab('category')}>مبيعات المجموعات</button>
        <button className={`btn ${tab === 'z' ? 'primary' : ''}`} onClick={() => setTab('z')}>تقرير Z</button>
      </div>

      {error && <div className="card" style={{ padding: 12, color: '#a22', marginBottom: 10 }}>{error}</div>}
      {msg && <div className="card" style={{ padding: 12, color: '#087658', marginBottom: 10 }}>{msg}</div>}

      {tab === 'category' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 9 }}>
              <label>من<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>إلى<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              <button className="btn primary" onClick={loadCategory} style={{ alignSelf: 'end' }}>عرض</button>
            </div>
          </div>
          {loading ? <Loading /> : (
            <div className="selection-list">
              {cats.map(({ key, c }) => {
                const h = (c.Hdr ?? c.hdr ?? {}) as R;
                const dtl = (c.Dtl ?? c.dtl ?? []) as R[];
                return (
                  <div className="card" key={key} style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{String(h.FatherName ?? h.fatherName ?? 'مجموعة')}</h3>
                        <span className="muted num">{String(h.Father ?? h.father ?? '')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 18 }}>
                        <b>الكمية: <span className="num">{money(h.TotalQty ?? h.totalQty)}</span></b>
                        <b>الإجمالي: <span className="num">{money(h.TotalGrand ?? h.totalGrand)}</span></b>
                      </div>
                    </div>
                    {dtl.length > 0 && (
                      <div className="table-wrap" style={{ marginTop: 12 }}>
                        <table className="table">
                          <thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                          <tbody>
                            {dtl.map((d, j) => (
                              <tr key={j}>
                                <td>{String(d.ItemName ?? d.itemName ?? '')}</td>
                                <td className="num">{money(d.Qty ?? d.qty)}</td>
                                <td className="num">{money(d.Grand ?? d.grand)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {!cats.length && <div className="card empty">اختر الفترة واضغط عرض.</div>}
            </div>
          )}
        </>
      )}

      {tab === 'z' && (
        <>
          <DateBar date={lineDate} setDate={setLineDate} onLoad={() => loadZ()} />
          {loading ? <Loading /> : <ReportCards z={z} summary={summary} />}
        </>
      )}
    </main>
  );
}

function DateBar({ date, setDate, onLoad }: { date: string; setDate: (v: string) => void; onLoad: () => void }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
      <label style={{ minWidth: 220 }}>
        يوم العمل
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button className="btn primary" onClick={onLoad}>تحميل</button>
    </div>
  );
}

function ReportCards({ z, summary }: { z: R[]; summary: R[] }) {
  return (
    <>
      <div className="grid3" style={{ marginBottom: 12 }}>
        {summary.map((s, i) => (
          <div className="card" style={{ padding: 14 }} key={i}>
            <div className="muted">ملخص اليوم</div>
            <Row k="Subtotal" v={s.SubTotal} />
            <Row k="الخصم" v={s.Discount} />
            <Row k="الضريبة" v={s.Tax} />
            <Row k="الخدمة" v={s.Service} />
            <Row k="الإجمالي" v={s.GrandTotal} strong />
          </div>
        ))}
      </div>
      <div className="selection-list">
        {z.map((raw, i) => {
          const x = (raw.ZReport ?? raw.zReport ?? raw) as R;
          const ps = (x.ZPayments ?? x.zPayments ?? []) as R[];
          return (
            <div className="card" style={{ padding: 16 }} key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>Cash #{String(x.ZCashNo ?? x.zCashNo ?? '')}</h3>
                <b>{String(x.Casher ?? x.casher ?? '')}</b>
              </div>
              <Row k="المبيعات" v={x.ZSales ?? x.zSales} />
              <Row k="المرتجعات" v={x.ZReturn ?? x.zReturn} />
              {ps.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="table">
                    <thead><tr><th>طريقة الدفع</th><th>المبلغ</th><th>عدد الفواتير</th></tr></thead>
                    <tbody>
                      {ps.map((p, j) => (
                        <tr key={j}>
                          <td>{String(p.TypeArDesc ?? p.TypeEnDesc ?? p.Type ?? '')}</td>
                          <td className="num">{money(p.Payments)}</td>
                          <td className="num">{String(p.InvoicesCount ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {!z.length && !summary.length && <div className="card empty">لا توجد بيانات تقرير محملة.</div>}
      </div>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: unknown; strong?: boolean }) {
  return (
    <div className="sum-row" style={strong ? { fontWeight: 900 } : {}}>
      <span>{k}</span>
      <span className="num">{money(v)}</span>
    </div>
  );
}
function money(v: unknown) { return (Number(v) || 0).toFixed(3); }
function err(e: unknown) { return e instanceof Error ? e.message : 'فشل تنفيذ العملية'; }
