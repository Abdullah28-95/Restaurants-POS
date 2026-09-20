'use client';
import {Suspense,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Loading} from '@/components/Loading';
import {usePos} from '@/context/PosContext';
import {getCategorySales,getLineSummary,getSaleDay,getZReport} from '@/lib/pos-api';
import {unwrapResponse} from '@/lib/api-client';

type R=Record<string,unknown>;type Tab='category'|'z';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

export default function Page(){return <AppShell title="التقارير"><Suspense fallback={<Loading/>}><Reports/></Suspense></AppShell>}
function Reports(){
 const {user}=usePos(),search=useSearchParams();const queryTab=search.get('tab'),queryLineDate=search.get('lineDate')||'',closed=search.get('closed')==='1';
 const [tab,setTab]=useState<Tab>(queryTab==='z'?'z':'category'),[from,setFrom]=useState(queryLineDate||today()),[to,setTo]=useState(queryLineDate||today()),[lineDate,setLineDate]=useState(queryLineDate||today());
 const [category,setCategory]=useState<R[]>([]),[z,setZ]=useState<R[]>([]),[summary,setSummary]=useState<R[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(queryTab==='z')setTab('z');if(queryLineDate){setLineDate(queryLineDate);setFrom(queryLineDate);setTo(queryLineDate)}},[queryTab,queryLineDate]);
 useEffect(()=>{if(!user||queryLineDate)return;(async()=>{try{const s=await getSaleDay(user.DefaultBranch);if(s?.LineDate){const d=String(s.LineDate).slice(0,10);setLineDate(d);setFrom(d);setTo(d)}}catch{}})()},[user,queryLineDate]);
 useEffect(()=>{if(user&&queryTab==='z'&&queryLineDate)loadZ(queryLineDate)},[user,queryTab,queryLineDate]); // eslint-disable-line react-hooks/exhaustive-deps
 async function loadCategory(){if(!user)return;setLoading(true);setError('');try{const raw=await getCategorySales(user.DefaultBranch,from,to);setCategory(unwrapResponse<R[]>(raw)||[])}catch(e){setError(err(e))}finally{setLoading(false)}}
 async function loadZ(date=lineDate){if(!user)return;setLoading(true);setError('');try{const[a,b]=await Promise.all([getZReport(user.DefaultBranch,date),getLineSummary(user.DefaultBranch,date)]);setZ(a||[]);setSummary(b||[])}catch(e){setError(err(e))}finally{setLoading(false)}}
 const cats=useMemo(()=>category.map((x,i)=>({key:i,c:(x.cateSales??x.CateSales??x)as R})),[category]);
 const categoryTotals=useMemo(()=>cats.reduce((a,{c})=>{const h=(c.Hdr??c.hdr??{})as R;a.qty+=n(h.TotalQty??h.totalQty);a.total+=n(h.TotalGrand??h.totalGrand);return a},{qty:0,total:0}),[cats]);
 const dayTotals=useMemo(()=>summary.reduce((a,s)=>({subtotal:a.subtotal+n(s.SubTotal),discount:a.discount+n(s.Discount),tax:a.tax+n(s.Tax),service:a.service+n(s.Service),grand:a.grand+n(s.GrandTotal)}),{subtotal:0,discount:0,tax:0,service:0,grand:0}),[summary]);
 const currency=user?.DefaultCurrency||'';
 return <main className="content reports-page">
  <section className="reports-hero card"><div><span className="page-eyebrow">لوحة التقارير</span><h1>التقارير والتحليلات</h1><p>تابع أداء المجموعات وتقارير Z وملخصات يوم العمل من شاشة واحدة واضحة.</p></div><div className="reports-branch"><small>الفرع</small><strong>{user?.BranchName||user?.DefaultBranch||'—'}</strong></div></section>
  {closed&&<div className="page-alert success">تم إغلاق يوم العمل بنجاح. تم تحميل تقرير الإغلاق.</div>}{error&&<div className="page-alert error">{error}</div>}
  <div className="reports-tabs"><button className={tab==='category'?'active':''} onClick={()=>setTab('category')}><span className="reports-tab-icon">▦</span><div><b>مبيعات المجموعات</b><small>تفاصيل الأصناف والكميات</small></div></button><button className={tab==='z'?'active':''} onClick={()=>setTab('z')}><span className="reports-tab-icon">Z</span><div><b>تقرير Z</b><small>ملخص نقاط البيع واليوم</small></div></button></div>
  {tab==='category'?<>
    <section className="reports-filter card"><div><span className="page-eyebrow">تقرير المجموعات</span><h2>حدد الفترة</h2></div><div className="reports-filter-fields"><label><span>من</span><input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>إلى</span><input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="btn primary" onClick={loadCategory} disabled={loading}>{loading?'جاري التحميل...':'عرض التقرير'}</button></div></section>
    {cats.length>0&&<section className="reports-stats"><ReportMetric label="عدد المجموعات" value={String(cats.length)}/><ReportMetric label="إجمالي الكمية" value={money(categoryTotals.qty)}/><ReportMetric label="إجمالي المبيعات" value={`${money(categoryTotals.total)} ${currency}`} strong/></section>}
    {loading?<Loading/>:<section className="report-category-list">{cats.map(({key,c})=>{const h=(c.Hdr??c.hdr??{})as R,dtl=(c.Dtl??c.dtl??[])as R[];return <article className="report-group-card card" key={key}><header><div><span className="page-eyebrow">مجموعة</span><h2>{String(h.FatherName??h.fatherName??'مجموعة')}</h2><small className="num">#{String(h.Father??h.father??'')}</small></div><div className="report-group-totals"><span><small>الكمية</small><b className="num">{money(h.TotalQty??h.totalQty)}</b></span><span><small>الإجمالي</small><b className="num">{money(h.TotalGrand??h.totalGrand)} {currency}</b></span></div></header>{dtl.length>0?<div className="table-wrap report-table-wrap"><table className="table report-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>{dtl.map((d,j)=><tr key={j}><td>{String(d.ItemName??d.itemName??'')}</td><td className="num">{money(d.Qty??d.qty)}</td><td className="num report-money">{money(d.Grand??d.grand)}</td></tr>)}</tbody></table></div>:<div className="empty">لا توجد تفاصيل لهذه المجموعة.</div>}</article>})}{!cats.length&&<div className="reports-empty card">اختر الفترة ثم اضغط <b>عرض التقرير</b>.</div>}</section>}
  </>:<>
    <section className="reports-filter card"><div><span className="page-eyebrow">تقرير نهاية اليوم</span><h2>تقرير Z</h2></div><div className="reports-filter-fields z"><label><span>يوم العمل</span><input className="input" type="date" value={lineDate} onChange={e=>setLineDate(e.target.value)}/></label><button className="btn primary" onClick={()=>loadZ()} disabled={loading}>{loading?'جاري التحميل...':'تحميل التقرير'}</button></div></section>
    {summary.length>0&&<section className="reports-stats five"><ReportMetric label="المجموع" value={`${money(dayTotals.subtotal)} ${currency}`}/><ReportMetric label="الخصم" value={`${money(dayTotals.discount)} ${currency}`}/><ReportMetric label="الضريبة" value={`${money(dayTotals.tax)} ${currency}`}/><ReportMetric label="الخدمة" value={`${money(dayTotals.service)} ${currency}`}/><ReportMetric label="الإجمالي" value={`${money(dayTotals.grand)} ${currency}`} strong/></section>}
    {loading?<Loading/>:<section className="z-report-list">{z.map((raw,i)=>{const x=(raw.ZReport??raw.zReport??raw)as R,ps=(x.ZPayments??x.zPayments??[])as R[];return <article className="z-report-card card" key={i}><header><div><span className="page-eyebrow">نقطة البيع</span><h2>Cash #{String(x.ZCashNo??x.zCashNo??'—')}</h2></div><div className="z-cashier"><small>الكاشير</small><b>{String(x.Casher??x.casher??'—')}</b></div></header><div className="z-summary"><div><span>المبيعات</span><b className="num">{money(x.ZSales??x.zSales)} {currency}</b></div><div><span>المرتجعات</span><b className="num">{money(x.ZReturn??x.zReturn)} {currency}</b></div></div>{ps.length>0&&<div className="table-wrap report-table-wrap"><table className="table report-table"><thead><tr><th>طريقة الدفع</th><th>المبلغ</th><th>عدد الفواتير</th></tr></thead><tbody>{ps.map((p,j)=><tr key={j}><td>{String(p.TypeArDesc??p.TypeEnDesc??p.Type??'')}</td><td className="num report-money">{money(p.Payments)}</td><td className="num">{String(p.InvoicesCount??'')}</td></tr>)}</tbody></table></div>}</article>})}{!z.length&&!summary.length&&<div className="reports-empty card">اختر يوم العمل واضغط <b>تحميل التقرير</b>.</div>}</section>}
  </>}
 </main>
}
function ReportMetric({label,value,strong}:{label:string;value:string;strong?:boolean}){return <div className={`report-metric card ${strong?'strong':''}`}><span>{label}</span><b className="num">{value}</b></div>}
function n(v:unknown){return Number(v)||0}function money(v:unknown){return n(v).toFixed(3)}function err(e:unknown){return e instanceof Error?e.message:'فشل تنفيذ العملية'}
