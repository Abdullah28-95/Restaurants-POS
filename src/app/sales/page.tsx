'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Loading} from '@/components/Loading';
import {usePos} from '@/context/PosContext';
import {getInvoiceDetail,getInvoices,getReturnedInvoices} from '@/lib/pos-api';
import {printInvoiceDetail} from '@/lib/printing';

type R=Record<string,unknown>;
type Tab='sales'|'returns';
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

export default function Page(){return <AppShell title="المبيعات والمرتجعات"><Sales/></AppShell>}

function Sales(){
  const {user,printerSettings}=usePos();
  const [from,setFrom]=useState(localToday()),[to,setTo]=useState(localToday());
  const [rows,setRows]=useState<R[]>([]),[returns,setReturns]=useState<R[]>([]),[tab,setTab]=useState<Tab>('sales');
  const [loading,setLoading]=useState(false),[search,setSearch]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[printing,setPrinting]=useState<string|null>(null);

  async function load(){
    if(!user)return;setLoading(true);setError('');
    try{
      const [a,b]=await Promise.all([getInvoices(user.DefaultBranch,user.UserNo,from,to),getReturnedInvoices(user.DefaultBranch,user.UserNo)]);
      setRows(a||[]);setReturns(b||[]);
    }catch(e){setError(e instanceof Error?e.message:'فشل تحميل المبيعات')}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reprint(invoiceNo:unknown){
    if(!user)return;
    const no=String(invoiceNo??''); if(!no)return;
    setPrinting(no);setError('');setNotice('');
    try{
      const detail=await getInvoiceDetail(no);
      if(!detail)throw new Error('تعذر تحميل تفاصيل الفاتورة');
      await printInvoiceDetail(detail,user,printerSettings);
      setNotice(`تم إرسال الفاتورة #${no} للطباعة`);
      window.setTimeout(()=>setNotice(''),3000);
    }catch(e){setError(e instanceof Error?e.message:'فشلت إعادة الطباعة')}finally{setPrinting(null)}
  }

  const filtered=useMemo(()=>{
    let base=tab==='sales'?rows:returns.filter(x=>inRange(x.ReturnDate,from,to));
    const q=search.trim().toLowerCase();
    if(q)base=base.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
    return base;
  },[rows,returns,tab,search,from,to]);

  const stats=useMemo(()=>({
    invoices:rows.length,
    sales:rows.reduce((a,x)=>a+n(x.InvoiceGrandTotal),0),
    tax:rows.reduce((a,x)=>a+n(x.InvoiceTaxTotal),0),
    returns:returns.reduce((a,x)=>a+n(x.ReturnsGrandTotal),0),
  }),[rows,returns]);
  const currency=user?.DefaultCurrency||'';

  return <main className="content sales-page">
    <section className="sales-hero card">
      <div><span className="page-eyebrow">مراجعة العمليات</span><h1>المبيعات والمرتجعات</h1><p>راجع الفواتير، افتح شاشة العرض والإرجاع، أو أعد طباعة أي فاتورة مباشرة.</p></div>
      <div className="sales-hero-branch"><small>الفرع الحالي</small><strong>{user?.BranchName||user?.DefaultBranch||'—'}</strong></div>
    </section>

    <section className="sales-stats">
      <Metric label="عدد الفواتير" value={String(stats.invoices)} icon="▤"/>
      <Metric label="إجمالي المبيعات" value={`${money(stats.sales)} ${currency}`} icon="↗" strong/>
      <Metric label="إجمالي الضريبة" value={`${money(stats.tax)} ${currency}`} icon="%"/>
      <Metric label="إجمالي المرتجعات" value={`${money(stats.returns)} ${currency}`} icon="↶" danger={stats.returns>0}/>
    </section>

    <section className="sales-filter card">
      <div className="sales-filter-head"><div><span className="page-eyebrow">الفترة والبحث</span><h2>تصفية العمليات</h2></div><button className="btn primary sales-search-btn" onClick={load} disabled={loading}>{loading?'جاري التحميل...':'تحديث البيانات'}</button></div>
      <div className="sales-filter-grid">
        <label><span>من تاريخ</span><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label><span>إلى تاريخ</span><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <label className="sales-search-field"><span>بحث سريع</span><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="رقم الفاتورة، الكاش، أو أي قيمة..."/></label>
      </div>
    </section>

    <div className="sales-tabs" role="tablist">
      <button className={tab==='sales'?'active':''} onClick={()=>setTab('sales')}><span>الفواتير</span><b>{rows.length}</b></button>
      <button className={tab==='returns'?'active danger':''} onClick={()=>setTab('returns')}><span>المرتجعات</span><b>{returns.length}</b></button>
    </div>

    {notice&&<div className="page-alert success">{notice}</div>}
    {error&&<div className="page-alert error">{error}</div>}
    {loading?<Loading label="جاري تحميل العمليات..."/>:<section className="sales-table-card card">
      <div className="sales-table-head"><div><span className="page-eyebrow">{tab==='sales'?'قائمة الفواتير':'قائمة المرتجعات'}</span><h2>{filtered.length} عملية</h2></div><span className="muted">الأرقام بالعملة {currency||'المعتمدة'}</span></div>
      <div className="table-wrap sales-table-wrap"><table className="table sales-table"><thead><tr>{tab==='sales'?<><th>رقم الفاتورة</th><th>التاريخ</th><th>الكاش</th><th>القيم</th><th>الإجراءات</th></>:<><th>رقم المرتجع</th><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>الإجراءات</th></>}</tr></thead><tbody>{filtered.map((x,i)=>tab==='sales'?<tr key={i}>
        <td><span className="invoice-number num">#{String(x.InvoiceNo??'')}</span></td>
        <td>{fmt(x.SalesDate)}</td>
        <td><span className="cash-pill num">#{String(x.InvoiceCashNo??'—')}</span></td>
        <td><div className="sales-financials"><div><span>الإجمالي</span><b className="num">{money(x.InvoiceGrandTotal)} {currency}</b></div><div><span>الضريبة</span><b className="num">{money(x.InvoiceTaxTotal)} {currency}</b></div></div></td>
        <td><div className="sales-actions"><Link className="btn sales-detail-btn" href={`/sales/${encodeURIComponent(String(x.InvoiceNo))}`}>عرض وإرجاع</Link><button className="btn sales-reprint-btn" onClick={()=>reprint(x.InvoiceNo)} disabled={printing===String(x.InvoiceNo)}>{printing===String(x.InvoiceNo)?'جاري الطباعة...':'إعادة طباعة'}</button></div></td>
      </tr>:<tr key={i}>
        <td><span className="return-number num">#{String(x.ReturnId??'')}</span></td>
        <td className="num">#{String(x.InvoiceNo??'')}</td>
        <td>{fmt(x.ReturnDate)}</td>
        <td><div className="sales-financials single"><div><span>الإجمالي</span><b className="num">{money(x.ReturnsGrandTotal)} {currency}</b></div></div></td>
        <td><div className="sales-actions"><Link className="btn sales-detail-btn" href={`/sales/${encodeURIComponent(String(x.InvoiceNo))}?returnId=${x.ReturnId}`}>عرض وإرجاع</Link><button className="btn sales-reprint-btn" onClick={()=>reprint(x.InvoiceNo)} disabled={printing===String(x.InvoiceNo)}>{printing===String(x.InvoiceNo)?'جاري الطباعة...':'إعادة طباعة'}</button></div></td>
      </tr>)}</tbody></table>{filtered.length===0&&<div className="empty sales-empty">لا توجد عمليات مطابقة للفترة أو البحث الحالي.</div>}</div>
    </section>}
  </main>
}

function Metric({label,value,icon,strong,danger}:{label:string;value:string;icon:string;strong?:boolean;danger?:boolean}){return <div className={`sales-stat card ${strong?'strong':''} ${danger?'danger':''}`}><div className="sales-stat-icon">{icon}</div><div><span>{label}</span><b className="num">{value}</b></div></div>}
function n(v:unknown){return Number(v)||0}function money(v:unknown){return n(v).toFixed(3)}
function fmt(v:unknown){const d=new Date(String(v||''));return Number.isNaN(d.getTime())?String(v||'—'):d.toLocaleString('ar-JO',{dateStyle:'short',timeStyle:'short'})}
function inRange(v:unknown,from:string,to:string){const raw=String(v??'').slice(0,10);return !raw||((!from||raw>=from)&&(!to||raw<=to))}
