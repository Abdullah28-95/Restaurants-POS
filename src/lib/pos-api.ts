import { apiGet, apiPost, unwrapResponse } from './api-client';
import { endpoints } from './endpoints';
import { normalizeCategory, normalizeDelivery, normalizeDeliveryDiscount, normalizeDiscount, normalizeFlavor, normalizeOffer, normalizePaymentType, normalizeProduct, normalizeQuestion, normalizeSetting } from './normalize';
import type { InvoiceDetailResponse } from '@/types/pos';

type Obj=Record<string,unknown>;
const asObjects=(x:unknown)=>Array.isArray(x)?x.filter(v=>v&&typeof v==='object') as Obj[]:[];

export async function loadCatalog(branch:string){
  const common={'paging.PageNumber':32,'paging.PageSize':32};
  const results=await Promise.allSettled([
    apiGet(endpoints.getAllCategories,common), apiGet(endpoints.getAllItems,{Warehouse:branch,...common}), apiGet(endpoints.getAllFlavors), apiGet(endpoints.getItemQuestions),
    apiGet(endpoints.getAllDiscounts,{Warehouse:branch,...common}), apiGet(endpoints.getAllOffers,{Warehouse:branch,...common}), apiGet(endpoints.getAllDeliveryCompanies,common), apiGet(endpoints.getAllDeliveryDiscount,common),
    apiGet(endpoints.getAllPaymentTypes), apiGet(endpoints.getSettings,{Warehouse:branch})
  ]);
  const val=(i:number)=>results[i].status==='fulfilled'?(results[i] as PromiseFulfilledResult<unknown>).value:[];
  return {
    categories:asObjects(unwrapResponse(val(0))).map(normalizeCategory), products:asObjects(unwrapResponse(val(1))).map(normalizeProduct), flavors:asObjects(unwrapResponse(val(2))).map(normalizeFlavor),
    questions:asObjects(unwrapResponse(val(3))).map(normalizeQuestion), discounts:asObjects(unwrapResponse(val(4))).map(normalizeDiscount), offers:asObjects(unwrapResponse(val(5))).map(normalizeOffer),
    deliveries:asObjects(unwrapResponse(val(6))).map(normalizeDelivery), deliveryDiscounts:asObjects(unwrapResponse(val(7))).map(normalizeDeliveryDiscount), paymentTypes:asObjects(unwrapResponse(val(8))).map(normalizePaymentType),
    settings:asObjects(unwrapResponse(val(9))).map(normalizeSetting), errors:results.map((r,i)=>r.status==='rejected'?{index:i,error:String((r as PromiseRejectedResult).reason)}:null).filter(Boolean)
  };
}
export async function getSaleDay(branch:string){ return unwrapResponse<Obj>(await apiGet(endpoints.getSalesByWarehouse,{Warehouse:branch})); }
export async function getRemoteSettings(branch:string){ return asObjects(unwrapResponse(await apiGet(endpoints.getSettings,{Warehouse:branch}))).map(normalizeSetting); }
export async function getCash(userNo:number){ return unwrapResponse<Obj>(await apiGet(endpoints.getSalesByUser,{CashUser:userNo})); }
export async function getLastInvoice(branch:string){ return unwrapResponse<Obj>(await apiGet(endpoints.getLastInvoiceNo,{Warehouse:branch})); }
export async function insertInvoice(payload:unknown){ return unwrapResponse<string>(await apiPost(endpoints.insertInvoice,sanitizeInvoice(payload))); }
export async function getInvoices(branch:string,userNo:number,from:string,to:string){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getInvoicesByIntervalDate,{Warehouse:branch,UserNo:userNo,FromDate:from,ToDate:to})); }
export async function getInvoiceDetail(invoiceNo:string|number){ return unwrapResponse<InvoiceDetailResponse>(await apiGet(endpoints.getInvoiceDetail,{InvoiceNo:invoiceNo})); }
export async function getReturnedInvoices(branch:string,userNo:number){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getReturnedInvoices,{Warehouse:branch,ReturnedBy:userNo})); }
export async function getReturnedInvoiceDetail(returnId:number,branch:string){ return unwrapResponse<Obj>(await apiGet(endpoints.getReturnedInvoiceDetail,{ReturnId:returnId,Warehouse:branch})); }
export async function insertReturn(payload:unknown){ return apiPost(endpoints.insertReturn,payload); }
export async function getCategorySales(branch:string,from:string,to:string){ return apiGet(endpoints.getCategorySales,{Warehouse:branch,FromDate:from,ToDate:to}); }
export async function getPaymentsSummary(cashNo:string|number,branch:string){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getSalesByCashNo,{Warehouse:branch,InvoiceCashNo:cashNo})); }
export async function getSalesSummary(cashNo:string|number){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getSalesSummary,{CashNo:cashNo})); }
export async function getCashSalesSummary(cashNo:string|number){ return unwrapResponse<Obj>(await apiGet(endpoints.getCashSalesSummary,{CashNo:cashNo})); }
export async function openDay(branch:string,lineDate=localDateOnly()){
  return apiPost(endpoints.insertByParameters,undefined,{Warehouse:branch,LineDate:lineDate,OpenTime:localDateTimeString()});
}
export async function openPoint(userNo:number,branch:string,custody:number,lineDate?:string){
  let cash:Obj|undefined;
  try{cash=await getCash(userNo);}catch{}
  if(hasOpenCashNo(cash)) throw new Error(`يوجد كاش مفتوح بالفعل للمستخدم رقم ${userNo}`);

  // مطابق لتدفق Flutter: إذا لم يوجد يوم عمل، افتحه أولًا ثم افتح نقطة الكاش.
  let workDate=lineDate||localDateOnly();
  let hasOpenDay=false;
  try{
    const day=await getSaleDay(branch);
    if(day?.LineDate){
      workDate=dateOnlyLocal(day.LineDate);
      hasOpenDay=true;
    }
  }catch{
    hasOpenDay=false;
  }

  if(!hasOpenDay){
    workDate=lineDate||localDateOnly();
    await openDay(branch,workDate);
  }

  return apiPost(endpoints.openPointByParameters,undefined,{CashUser:userNo,Warehouse:branch,CashStartDate:workDate,CashCustody:String(custody),CashRealTime:localDateTimeString()});
}
export async function closePoint(data:Obj){ return apiPost(endpoints.closePoint,data); }
export async function getOpenedPoints(startDate:string,branch:string){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getSalesByDate,{CashStartDate:startDate,Warehouse:branch})); }
export async function endDay(data:Obj){ return apiPost(endpoints.endDay,data); }
export async function getZReport(branch:string,lineDate:string){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getSalesZReport,{Warehouse:branch,LineDate:lineDate})); }
export async function getLineSummary(branch:string,lineDate:string){ return unwrapResponse<Obj[]>(await apiGet(endpoints.getSummaryByLineId,{Warehouse:branch,LineDate:lineDate})); }

function hasOpenCashNo(value: unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Obj;
  const cashNo=Number(row.CashNo??row.cashNo??0);
  return Number.isFinite(cashNo)&&cashNo>0;
}

function localDateOnly(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function localDateTimeString(date=new Date()){
  const ms=String(date.getMilliseconds()).padStart(3,'0');
  return `${localDateOnly(date)} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}.${ms}`;
}
function dateOnlyLocal(value:unknown){
  const raw=String(value??'');
  const match=raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if(match)return match[1];
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?localDateOnly():localDateOnly(d);
}

function sanitizeInvoice(payload:unknown){
  if(!payload||typeof payload!=='object')return payload;
  const p=payload as {invoices?:unknown;invoiceDtl?:unknown[];invoicePayment?:unknown[]};
  return {...p,invoiceDtl:Array.isArray(p.invoiceDtl)?p.invoiceDtl.map(x=>{if(!x||typeof x!=='object')return x;const {Pro_AR_Name:_,Pro_EN_Name:__,...apiLine}=x as Record<string,unknown>;return apiLine;}):p.invoiceDtl};
}
