import type { AuthUser, CartItem, DeliverySelection, Discount, RemoteSetting } from '@/types/pos';
import { calculateCart, calculateCartItem, deliveryDiscountPercent, priceByCategory } from './pricing';

export interface PaymentMap { [ptype:number]: number }
export interface InvoiceBuildMeta { invoiceNo?: string|number; queue?: number; cashNo?: number; salesDate?: string; }

export function getTaxOptions(settings: RemoteSetting[]) {
  const find=(id:number)=>settings.find(s=>s.settingId===id);
  return { taxPercentage:find(9)?.value2 ?? 16, priceIncludesTax:find(3)?.value4 ?? true, taxIncludesDiscount:find(5)?.value4 ?? true, addQrCode:find(2)?.value4 ?? false };
}

export function buildInvoiceDraft(args:{cart:CartItem[];user:AuthUser;settings:RemoteSetting[];payments:PaymentMap;discount?:Discount|null;delivery?:DeliverySelection|null;isPrinted:boolean;meta?:InvoiceBuildMeta;stationId?:string;tableNo?:number;takerName?:string;}) {
  const {taxPercentage,priceIncludesTax,taxIncludesDiscount,addQrCode}=getTaxOptions(args.settings);
  const total=calculateCart(args.cart,{taxPercentage,priceIncludesTax,taxIncludesDiscount,discount:args.discount,delivery:args.delivery});
  const now=new Date();
  const invoiceNo=String(args.meta?.invoiceNo ?? now.getTime());
  const saleDate=args.meta?.salesDate || `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  const branch=Number(args.user.DefaultBranch);
  const priceCategory=args.delivery?.delivery.priceCategory || 0;
  const delDiscount=deliveryDiscountPercent(args.delivery);
  const qrcode=addQrCode ? generateTLV(args.user.DefaultBranch,args.user.TaxNo,total.tax.toFixed(args.user.NumbersOfDigits||3),total.grandTotal.toFixed(args.user.NumbersOfDigits||3),now) : '';
  const invoices={
    InvoiceNo:invoiceNo, InvoiceCashNo:args.meta?.cashNo ?? 0,
    InvoiceSubTotal:fix(total.price), InvoiceDiscountTotal:fix(total.discount), InvoiceServiceTotal:0,
    InvoiceTaxTotal:fix(total.tax), InvoiceGrandTotal:fix(total.grandTotal), IsPrinted:String(args.isPrinted),
    Customer:0, RealTime:now.toISOString(), TableNo:args.tableNo ?? -4, EmpTaker:args.user.UserNo,
    TakerName:args.takerName || '', Queue:args.meta?.queue ?? 0, CashPayment:fix(total.grandTotal), Warehouse:branch,
    SalesDate:saleDate, DeliveryCompany:args.delivery?.delivery.companyId ?? 0, Qrcode:qrcode, StationId:args.stationId || ''
  };
  const invoiceDtl=args.cart.map((item,index)=>{
    const calc=calculateCartItem(item,{taxPercentage,priceIncludesTax,taxIncludesDiscount,discount:args.discount,delivery:args.delivery});
    return { InvoiceNo:invoiceNo, Item:item.product.proId, Qty:item.quantity,
      Price:priceByCategory(item.product,priceCategory,delDiscount), Subtotal:fix(calc.price), DiscountV:fix(calc.discount), DiscountP:item.product.discountable===false?0:(args.discount?.percentage||0),
      TaxP:taxPercentage/100, TaxV:fix(calc.tax), GrandTotal:fix(calc.grandTotal), Taker:args.user.UserNo,
      Flavors:item.flavors.map(f=>f.enName).join(','), Warehouse:branch, SalesDate:saleDate, OfferNo:0, LineID:index,
      CatID:item.product.catId, PreparationTime:item.product.preparationTime,
      Pro_AR_Name:item.product.arName, Pro_EN_Name:item.product.enName
    };
  });
  const invoicePayment=Object.entries(args.payments).filter(([,v])=>Number(v)>0).map(([ptype,payment])=>({InvoiceId:invoiceNo,PayType:Number(ptype),Payment:Number(payment),CreditExpireDate:saleDate,Warehouse:branch}));
  return { invoices, invoiceDtl, invoicePayment };
}

export function rebasePendingInvoice(payload:ReturnType<typeof buildInvoiceDraft>, meta:InvoiceBuildMeta) {
  const old=String(payload.invoices.InvoiceNo); const next=String(meta.invoiceNo ?? old); const date=meta.salesDate || payload.invoices.SalesDate;
  return {
    invoices:{...payload.invoices,InvoiceNo:next,InvoiceCashNo:meta.cashNo ?? payload.invoices.InvoiceCashNo,Queue:meta.queue ?? payload.invoices.Queue,SalesDate:date},
    invoiceDtl:payload.invoiceDtl.map(x=>({...x,InvoiceNo:next,SalesDate:date})),
    invoicePayment:payload.invoicePayment.map(x=>({...x,InvoiceId:next,CreditExpireDate:date}))
  };
}

function fix(v:number){ return Number(v.toFixed(5)); }
function generateTLV(seller:string,trn:string,tax:string,amount:string,date:Date){
  const chunks=[seller,trn,date.toString(),tax,amount].map((value,i)=>{ const bytes=new TextEncoder().encode(value); const out=new Uint8Array(bytes.length+2); out[0]=i+1; out[1]=bytes.length; out.set(bytes,2); return out; });
  const len=chunks.reduce((a,c)=>a+c.length,0); const all=new Uint8Array(len); let off=0; chunks.forEach(c=>{all.set(c,off);off+=c.length;});
  let binary=''; all.forEach(x=>binary+=String.fromCharCode(x)); return typeof btoa==='function'?btoa(binary):Buffer.from(all).toString('base64');
}
