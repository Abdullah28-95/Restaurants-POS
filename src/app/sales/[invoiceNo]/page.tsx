'use client';
import {Suspense,useEffect,useMemo,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Loading} from '@/components/Loading';
import {Modal} from '@/components/Modal';
import {usePos} from '@/context/PosContext';
import {getInvoiceDetail,getReturnedInvoiceDetail,insertReturn} from '@/lib/pos-api';
import {printInvoiceDetail} from '@/lib/printing';
import type {InvoiceDetailResponse} from '@/types/pos';
type R=Record<string,unknown>;

export default function Page(){return <AppShell title="عرض وإرجاع الفاتورة"><Suspense fallback={<Loading/>}><Detail/></Suspense></AppShell>}

function Detail(){
  const params=useParams<{invoiceNo:string}>(),sp=useSearchParams(),{user,printerSettings}=usePos();
  const [d,setD]=useState<InvoiceDetailResponse|null>(null),[returned,setReturned]=useState<R|null>(null),[loading,setLoading]=useState(true),[printing,setPrinting]=useState(false),[ret,setRet]=useState(false),[msg,setMsg]=useState(''),[error,setError]=useState('');
  const invoiceNo=decodeURIComponent(params.invoiceNo);
  async function load(){setLoading(true);setError('');try{setD(await getInvoiceDetail(invoiceNo));const rid=Number(sp.get('returnId')||0);if(rid&&user)setReturned(await getReturnedInvoiceDetail(rid,user.DefaultBranch));else setReturned(null)}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل الفاتورة')}finally{setLoading(false)}}
  useEffect(()=>{load()},[invoiceNo,user]); // eslint-disable-line react-hooks/exhaustive-deps
  async function reprint(){if(!d||!user)return;setPrinting(true);setError('');try{await printInvoiceDetail(d,user,printerSettings);setMsg('تم إرسال الفاتورة للطباعة');window.setTimeout(()=>setMsg(''),2800)}catch(e){setError(e instanceof Error?e.message:'فشلت إعادة الطباعة')}finally{setPrinting(false)}}
  if(loading)return <Loading label="جاري تحميل تفاصيل الفاتورة..."/>;
  if(!d)return <main className="content"><div className="page-alert error">{error||'تعذر تحميل الفاتورة'}</div></main>;
  const h=d.invoices,currency=user?.DefaultCurrency||'';
  return <main className="content invoice-view-page">
    {msg&&<div className="page-alert success">{msg}</div>}{error&&<div className="page-alert error">{error}</div>}
    <section className="invoice-view-hero card">
      <div><span className="page-eyebrow">عرض وإرجاع</span><h1>فاتورة #{h.InvoiceNo}</h1><p>راجع تفاصيل الفاتورة والأصناف، أعد طباعتها أو نفّذ إرجاعًا جزئيًا من نفس الشاشة.</p></div>
      <div className="invoice-view-actions"><button className="btn invoice-print-btn" onClick={reprint} disabled={printing}>{printing?'جاري الطباعة...':'إعادة طباعة'}</button>{!returned&&<button className="btn danger" onClick={()=>setRet(true)}>إرجاع أصناف</button>}</div>
    </section>

    <section className="invoice-view-stats">
      <InvoiceStat label="رقم الفاتورة" value={`#${h.InvoiceNo}`}/>
      <InvoiceStat label="الكاش" value={`#${h.InvoiceCashNo||'—'}`}/>
      <InvoiceStat label="التاريخ" value={formatDate(h.RealTime||h.SalesDate)}/>
      <InvoiceStat label="الإجمالي" value={`${h.InvoiceGrandTotal.toFixed(3)} ${currency}`} strong/>
    </section>

    <section className="invoice-view-grid">
      <article className="invoice-items-card card">
        <header className="invoice-section-head"><div><span className="page-eyebrow">تفاصيل المواد</span><h2>أصناف الفاتورة</h2></div><span className="invoice-lines-count">{d.invoiceDtl.length} صنف</span></header>
        <div className="table-wrap invoice-items-table-wrap"><table className="table invoice-items-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>{d.invoiceDtl.map((x,i)=><tr key={`${x.Item}-${x.LineID}-${i}`}><td><div className="invoice-item-name"><b>{x.ArName||x.EnName}</b>{x.Flavors&&<small>{x.Flavors}</small>}</div></td><td className="num">{x.Qty}</td><td className="num">{x.Price.toFixed(3)}</td><td className="num">{x.DiscountV.toFixed(3)}</td><td><div className="invoice-tax-cell"><span>الضريبة</span><b className="num">{x.TaxV.toFixed(3)}</b></div></td><td className="num invoice-line-total">{x.GrandTotal.toFixed(3)}</td></tr>)}</tbody></table></div>
      </article>

      <aside className="invoice-summary-card card">
        <span className="page-eyebrow">الملخص المالي</span><h2>إجماليات الفاتورة</h2>
        <div className="invoice-summary-list">
          <SummaryRow label="المجموع" value={h.InvoiceSubTotal} currency={currency}/>
          <SummaryRow label="الخصم" value={h.InvoiceDiscountTotal} currency={currency}/>
          <SummaryRow label="الخدمة" value={h.InvoiceServiceTotal} currency={currency}/>
          <SummaryRow label="الضريبة" value={h.InvoiceTaxTotal} currency={currency}/>
          <SummaryRow label="الإجمالي" value={h.InvoiceGrandTotal} currency={currency} total/>
        </div>
        <div className="invoice-meta-panel"><div><span>المستخدم</span><b>{h.TakerName||h.EmpTaker||'—'}</b></div><div><span>نوع الطلب</span><b>{Number(h.TableNo)>=0?'محلي':'سفري'}</b></div>{Number(h.TableNo)>=0&&<div><span>الطاولة</span><b className="num">#{h.TableNo}</b></div>}<div><span>المحطة</span><b>{h.StationId||'—'}</b></div></div>
      </aside>
    </section>

    {returned&&<section className="invoice-returned-banner card"><div><span className="invoice-returned-icon">↶</span><div><b>هذه الفاتورة مرتبطة بعملية مرتجع</b><small>أنت تعرض تفاصيل فاتورة سبق فتح مرتجع مرتبط بها.</small></div></div><span className="badge amber">مرتجع مسجل</span></section>}

    <ReturnModal open={ret} onClose={()=>setRet(false)} data={d} onDone={()=>{setRet(false);setMsg('تم تسجيل المرتجع بنجاح');load()}}/>
  </main>
}

function InvoiceStat({label,value,strong}:{label:string;value:string;strong?:boolean}){return <div className={`invoice-stat card ${strong?'strong':''}`}><span>{label}</span><b className="num">{value}</b></div>}
function SummaryRow({label,value,currency,total}:{label:string;value:number;currency:string;total?:boolean}){return <div className={`invoice-summary-row ${total?'total':''}`}><span>{label}</span><b className="num">{Number(value||0).toFixed(3)} {currency}</b></div>}
function formatDate(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString('ar-JO',{dateStyle:'medium',timeStyle:'short'})}

function ReturnModal({open,onClose,data,onDone}:{open:boolean;onClose:()=>void;data:InvoiceDetailResponse;onDone:()=>void}){
  const [qty,setQty]=useState<Record<string,number>>({}),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const selected=useMemo(()=>data.invoiceDtl.filter(x=>(qty[x.Item]||0)>0),[data,qty]);
  const sums=selected.reduce((a,x)=>{const q=Math.min(x.Qty,qty[x.Item]||0),r=q/x.Qty;return{sub:a.sub+x.Subtotal*r,disc:a.disc+x.DiscountV*r,tax:a.tax+x.TaxV*r,total:a.total+x.GrandTotal*r}},{sub:0,disc:0,tax:0,total:0});
  async function submit(){setLoading(true);setError('');try{const h=data.invoices;const hdr={ReturnId:0,ReturnDate:new Date().toISOString(),InvoiceNo:h.InvoiceNo,ReturnedBy:h.EmpTaker,FromCash:h.InvoiceCashNo,VoidReason:3,ExtraNote:'',ReturnsSubTotal:sums.sub,ReturnsDiscountTotal:sums.disc,ReturnsServiceTotal:0,ReturnsTaxTotal:sums.tax,ReturnsGrandTotal:sums.total,Warehouse:String(h.Warehouse),EncryptionSeal:'',Guid:h.Guid,Qrcode:h.Qrcode,CompanyId:h.DeliveryCompany,PayType:0,StationId:''};const dtl=selected.map((x,i)=>{const q=Math.min(x.Qty,qty[x.Item]||0),r=q/x.Qty;return{ReturnId:0,IndexId:i,ItemId:x.Item,Qty:q,UnitPrice:x.Price,SubTotal:x.Subtotal*r,Discount:x.DiscountV*r,TaxValue:x.TaxV*r,DiscountPercentage:x.DiscountP,TaxPercentage:x.TaxP,GrandTotal:x.GrandTotal*r,Posted:true,Warehouse:String(x.Warehouse)}});await insertReturn({Hdr:hdr,Dtl:dtl});onDone()}catch(e){setError(e instanceof Error?e.message:'فشل المرتجع')}finally{setLoading(false)}}
  return <Modal open={open} title="إرجاع أصناف الفاتورة" onClose={onClose} width={900} actions={<><button className="btn" onClick={onClose}>إلغاء</button><button className="btn danger" disabled={!selected.length||loading} onClick={submit}>{loading?'جاري الحفظ...':`تأكيد المرتجع ${sums.total.toFixed(3)}`}</button></>}><div className="return-modal-intro"><div><b>حدد الكمية المراد إرجاعها</b><small>يمكنك إرجاع صنف واحد أو أكثر بكمية لا تتجاوز الكمية الأصلية.</small></div><div className="return-modal-total"><span>إجمالي المرتجع</span><b className="num">{sums.total.toFixed(3)}</b></div></div><div className="selection-list return-selection-list">{data.invoiceDtl.map(x=><div className={`select-card return-select-card ${(qty[x.Item]||0)>0?'selected':''}`} key={`${x.Item}-${x.LineID}`}><div className="return-product-info"><b>{x.ArName||x.EnName}</b><small>الكمية الأصلية: <span className="num">{x.Qty}</span> · السعر: <span className="num">{x.Price.toFixed(3)}</span></small></div><label><span>كمية الإرجاع</span><input className="input num" type="number" min={0} max={x.Qty} step="1" value={qty[x.Item]||0} onChange={e=>setQty(q=>({...q,[x.Item]:Math.min(x.Qty,Math.max(0,Number(e.target.value)||0))}))}/></label></div>)}</div>{error&&<div className="page-alert error" style={{marginTop:10}}>{error}</div>}</Modal>
}
