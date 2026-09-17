'use client';
import type {AuthUser,LocalPrinterSettings} from '@/types/pos';
import type {buildInvoiceDraft} from './invoice';
type Payload=ReturnType<typeof buildInvoiceDraft>;

type ReceiptItem={name:string;qty:number;unitPrice:number;total:number;notes:string[]};
type ReceiptModel={
  branchName:string;address:string;phone:string;taxNo:string;invoiceNo:string;dateText:string;cashier:string;orderType:string;tableLabel:string;
  currency:string;items:ReceiptItem[];subtotal:number;discount:number;tax:number;total:number;
};

export function receiptLines(payload:Payload,user:AuthUser,invoiceNo?:string){
  const model=buildReceiptModel(payload,user,invoiceNo);
  const lines:string[]=[];
  lines.push(model.branchName);
  if(model.address) lines.push(model.address);
  if(model.phone) lines.push(`هاتف: ${model.phone}`);
  if(model.taxNo) lines.push(`الرقم الضريبي: ${model.taxNo}`);
  lines.push('فاتورة ضريبية');
  lines.push('--------------------------------');
  lines.push(`رقم الفاتورة: ${model.invoiceNo}`);
  lines.push(`التاريخ: ${model.dateText}`);
  lines.push(`الكاشير: ${model.cashier}`);
  lines.push(`نوع الطلب: ${model.orderType}`);
  if(model.tableLabel) lines.push(model.tableLabel);
  lines.push('--------------------------------');
  model.items.forEach(item=>{
    lines.push(item.name);
    lines.push(`${item.qty} × ${item.unitPrice.toFixed(3)}        ${item.total.toFixed(3)}`);
    item.notes.forEach(n=>lines.push(`- ${n}`));
    lines.push('');
  });
  lines.push('--------------------------------');
  lines.push(`المجموع: ${model.subtotal.toFixed(3)} ${model.currency}`);
  lines.push(`الخصم: ${model.discount.toFixed(3)} ${model.currency}`);
  lines.push(`الضريبة: ${model.tax.toFixed(3)} ${model.currency}`);
  lines.push(`الإجمالي: ${model.total.toFixed(3)} ${model.currency}`);
  lines.push('شكراً لزيارتكم');
  return lines;
}

export function kitchenLines(payload:Payload,items:Payload['invoiceDtl'],invoiceNo?:string,note=''){return [`طلب مطبخ #${invoiceNo||payload.invoices.InvoiceNo}`,`طاولة: ${payload.invoices.TableNo}`,'--------------------------------',...items.flatMap(x=>[`${x.Pro_AR_Name||x.Pro_EN_Name} × ${x.Qty}`,x.Flavors?`إضافات: ${x.Flavors}`:'']),note?`ملاحظة: ${note}`:''];}

export async function printReceipt(payload:Payload,user:AuthUser,settings:LocalPrinterSettings,invoiceNo?:string){
  const model=buildReceiptModel(payload,user,invoiceNo);
  if(settings.printerType==='network'&&settings.printerCashIp){
    const data=await rasterReceipt(model);
    await sendNetwork(settings.printerCashIp,settings.portCash,data,true);
    return;
  }
  if(settings.printerType==='usb'){
    await printUsb(await rasterReceipt(model),true);
    return;
  }
  if(settings.printerType==='bluetooth'){
    await printBluetooth(await rasterReceipt(model),true);
    return;
  }
  if(settings.printerType==='imin'){
    const w=window as unknown as {iminPrinter?:{printText?:(t:string)=>Promise<void>|void;openCashBox?:()=>Promise<void>|void}};
    if(w.iminPrinter?.printText){
      await w.iminPrinter.printText(receiptLines(payload,user,invoiceNo).join('\n'));
      await w.iminPrinter.openCashBox?.();
      return;
    }
  }
  browserPrintReceipt(model);
}
export async function printLinesBySettings(lines:string[],settings:LocalPrinterSettings,openCashDrawer=false){if(settings.printerType==='network'&&settings.printerCashIp){const data=await rasterEscPos(lines);await sendNetwork(settings.printerCashIp,settings.portCash,data,openCashDrawer);return;}if(settings.printerType==='usb'){await printUsb(await rasterEscPos(lines),openCashDrawer);return;}if(settings.printerType==='bluetooth'){await printBluetooth(await rasterEscPos(lines),openCashDrawer);return;}if(settings.printerType==='imin'){const w=window as unknown as {iminPrinter?:{printText?:(t:string)=>Promise<void>|void;openCashBox?:()=>Promise<void>|void}};if(w.iminPrinter?.printText){await w.iminPrinter.printText(lines.join('\n'));if(openCashDrawer)await w.iminPrinter.openCashBox?.();return;}}browserPrint(lines);}
export async function printKitchen(payload:Payload,settings:LocalPrinterSettings,note='',invoiceNo?:string){const configured=payload.invoiceDtl.map(item=>({item,printer:settings.categoryPrinterMap[String(item.CatID)]||0,prep:Number(item.PreparationTime)||0})).filter(x=>x.printer>0);if(!configured.length)return;const maxPrep=Math.max(...configured.map(x=>x.prep),0);const groups=new Map<string,Payload['invoiceDtl']>();for(const x of configured){const key=`${x.printer}_${x.prep}`;const a=groups.get(key)||[];a.push(x.item);groups.set(key,a);}for(const [key,items] of groups){const [pRaw,prepRaw]=key.split('_');const p=Number(pRaw),prep=Number(prepRaw);const ip=(settings as unknown as Record<string,string>)[`printerKitchenIp${p}`]||'';const port=(settings as unknown as Record<string,string>)[`portKitchen${p}`]||'9100';if(!ip||ip==='0')continue;const delay=Math.max(0,maxPrep-prep);const groupNote=delay>0?[note,`انتظار ${delay} د - ليجهز مع الطلب`].filter(Boolean).join(' · '):note;const run=()=>rasterEscPos(kitchenLines(payload,items,invoiceNo,groupNote)).then(data=>sendNetwork(ip,port,data,false)).catch(()=>{});if(delay>0)setTimeout(run,delay*60_000);else await run();}}
export async function openDrawer(settings:LocalPrinterSettings){if(settings.printerType==='network'&&settings.printerCashIp){await fetch('/api/print/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:settings.printerCashIp,port:Number(settings.portCash),lines:[],openDrawer:true})});}}
async function sendNetwork(ip:string,port:string,data:Uint8Array,drawer=false){const base64=bytesToBase64(drawer?concat(new Uint8Array([0x1b,0x70,0,0x19,0xfa]),data):data);const r=await fetch('/api/print/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip,port:Number(port),dataBase64:base64})});if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.message||'Printer error');}}
function browserPrint(lines:string[]){const w=window.open('','_blank','width=420,height=700');if(!w)return;w.document.write(`<html dir="rtl"><head><style>body{font-family:Tahoma,Arial;width:72mm;margin:auto;font-size:14px;white-space:pre-wrap;text-align:right}</style></head><body>${escape(lines.join('\n'))}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);w.document.close();}
function browserPrintReceipt(model:ReceiptModel){
  const w=window.open('','_blank','width=430,height=760'); if(!w) return;
  const html=receiptHtml(model);
  w.document.write(html);
  w.document.close();
}

async function printBluetooth(bytes:Uint8Array,drawer=false){
 const nav=navigator as unknown as {bluetooth?:{requestDevice:(o:{acceptAllDevices:boolean;optionalServices:(number|string)[]})=>Promise<any>}};
 if(!nav.bluetooth)throw new Error('Web Bluetooth غير مدعوم في هذا المتصفح');
 const device=await nav.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[0xff00,0xffe0,0xae30]});
 const server=await device.gatt?.connect(); if(!server)throw new Error('تعذر الاتصال بطابعة Bluetooth');
 const services=await server.getPrimaryServices(); let writable:any=null;
 for(const service of services){const chars=await service.getCharacteristics();writable=chars.find((c:any)=>c.properties?.writeWithoutResponse||c.properties?.write);if(writable)break;}
 if(!writable)throw new Error('لم يتم العثور على Bluetooth write characteristic');
 const data=drawer?concat(new Uint8Array([0x1b,0x70,0,0x19,0xfa]),bytes):bytes;
 for(let i=0;i<data.length;i+=180){const chunk=data.slice(i,i+180);if(writable.writeValueWithoutResponse)await writable.writeValueWithoutResponse(chunk);else await writable.writeValue(chunk);}
 try{device.gatt?.disconnect()}catch{}
}

async function printUsb(bytes:Uint8Array,drawer=false){const nav=navigator as unknown as {usb?:{requestDevice:(o:{filters:unknown[]})=>Promise<any>}};if(!nav.usb)throw new Error('WebUSB غير مدعوم في هذا المتصفح');const d=await nav.usb.requestDevice({filters:[]});await d.open();if(!d.configuration)await d.selectConfiguration(1);const iface=d.configuration.interfaces.find((i:any)=>i.alternates.some((a:any)=>a.endpoints.some((e:any)=>e.direction==='out')));if(!iface)throw new Error('تعذر إيجاد USB endpoint');await d.claimInterface(iface.interfaceNumber);const alt=iface.alternates.find((a:any)=>a.endpoints.some((e:any)=>e.direction==='out'));const ep=alt.endpoints.find((e:any)=>e.direction==='out');const data=drawer?concat(new Uint8Array([0x1b,0x70,0,0x19,0xfa]),bytes):bytes;await d.transferOut(ep.endpointNumber,data);await d.close();}
export async function rasterEscPos(lines:string[]):Promise<Uint8Array>{const width=576,pad=18,font=27,lineH=38;const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d')!;ctx.font=`${font}px Tahoma, Arial`;const wrapped=lines.flatMap(line=>wrap(ctx,line,width-pad*2));canvas.width=width;canvas.height=Math.max(80,wrapped.length*lineH+24);const c=canvas.getContext('2d')!;c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='black';c.font=`${font}px Tahoma, Arial`;c.textAlign='right';c.direction='rtl';c.textBaseline='top';wrapped.forEach((line,i)=>c.fillText(line,width-pad,12+i*lineH));const img=c.getImageData(0,0,width,canvas.height);const bytesPerRow=Math.ceil(width/8);const raster=new Uint8Array(bytesPerRow*canvas.height);for(let y=0;y<canvas.height;y++){for(let x=0;x<width;x++){const i=(y*width+x)*4;const lum=(img.data[i]+img.data[i+1]+img.data[i+2])/3;if(lum<155)raster[y*bytesPerRow+(x>>3)]|=0x80>>(x&7);}}const header=new Uint8Array([0x1b,0x40,0x1d,0x76,0x30,0x00,bytesPerRow&255,(bytesPerRow>>8)&255,canvas.height&255,(canvas.height>>8)&255]);const cut=new Uint8Array([0x0a,0x0a,0x1d,0x56,0x41,0x03]);return concat(header,raster,cut);}
async function rasterReceipt(model:ReceiptModel):Promise<Uint8Array>{
  const width=576; const pad=24; const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=3600;
  const c=canvas.getContext('2d')!;
  c.fillStyle='white'; c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#111'; c.textBaseline='top'; c.direction='rtl';
  let y=18;
  const right=width-pad, left=pad, contentW=width-pad*2;
  const drawCentered=(text:string,size:number,weight=700,marginBottom=8)=>{c.font=`${weight} ${size}px Tahoma, Arial`; c.textAlign='center'; const lines=wrap(c,text,contentW); lines.forEach(line=>{c.fillText(line,width/2,y); y+=Math.max(size+8,24)}); y+=marginBottom;};
  const drawRule=(mb=12)=>{c.strokeStyle='#222'; c.lineWidth=1; c.beginPath(); c.moveTo(left,y); c.lineTo(right,y); c.stroke(); y+=mb;};
  const drawKv=(label:string,value:string,emphasize=false)=>{c.textAlign='right'; c.font=`${emphasize?700:600} ${emphasize?24:19}px Tahoma, Arial`; c.fillText(label,right,y); c.textAlign='left'; c.fillText(value,left,y); y+=emphasize?34:28;};
  const drawItem=(item:ReceiptItem)=>{c.textAlign='right'; c.font='700 23px Tahoma, Arial'; const nameLines=wrap(c,item.name,contentW); nameLines.forEach(line=>{c.fillText(line,right,y); y+=28;}); c.font='600 18px Tahoma, Arial'; c.textAlign='right'; c.fillText(`${item.qty} × ${item.unitPrice.toFixed(3)}`,right,y); c.textAlign='left'; c.font='700 20px Tahoma, Arial'; c.fillText(item.total.toFixed(3),left,y); y+=28; item.notes.forEach(note=>{c.textAlign='right'; c.font='400 17px Tahoma, Arial'; wrap(c,note,contentW-18).forEach(line=>{c.fillText(`• ${line}`,right-8,y); y+=22;});}); y+=8; c.strokeStyle='#d4d4d4'; c.beginPath(); c.moveTo(left,y); c.lineTo(right,y); c.stroke(); y+=10;};

  drawCentered(model.branchName||'FUTEC',30,800,2);
  if(model.address) drawCentered(model.address,18,500,0);
  if(model.phone) drawCentered(`هاتف: ${model.phone}`,17,500,0);
  if(model.taxNo) drawCentered(`الرقم الضريبي: ${model.taxNo}`,17,500,2);
  drawRule(10);
  drawCentered('فاتورة ضريبية',24,800,2);
  drawKv('رقم الفاتورة',model.invoiceNo);
  drawKv('التاريخ',model.dateText);
  drawKv('الكاشير',model.cashier);
  drawKv('نوع الطلب',model.orderType);
  if(model.tableLabel) drawKv('الموقع',model.tableLabel.replace(/^.*?:\s*/,''));
  drawRule(10);
  c.font='700 18px Tahoma, Arial'; c.textAlign='right'; c.fillText('الصنف',right,y); c.textAlign='center'; c.fillText('الكمية × السعر',width/2,y); c.textAlign='left'; c.fillText('الإجمالي',left,y); y+=26; drawRule(10);
  model.items.forEach(drawItem);
  drawKv('المجموع',`${model.subtotal.toFixed(3)} ${model.currency}`);
  drawKv('الخصم',`${model.discount.toFixed(3)} ${model.currency}`);
  drawKv('الضريبة',`${model.tax.toFixed(3)} ${model.currency}`);
  drawRule(10);
  drawKv('الإجمالي',`${model.total.toFixed(3)} ${model.currency}`,true);
  drawRule(12);
  drawCentered('شكراً لزيارتكم',20,800,0);
  drawCentered('نتشرف بخدمتكم مرة أخرى',17,500,4);
  y+=12;

  const usedHeight=Math.min(canvas.height,Math.ceil(y)+24);
  const img=c.getImageData(0,0,width,usedHeight); const bytesPerRow=Math.ceil(width/8); const raster=new Uint8Array(bytesPerRow*usedHeight);
  for(let yy=0;yy<usedHeight;yy++){for(let x=0;x<width;x++){const i=(yy*width+x)*4;const lum=(img.data[i]+img.data[i+1]+img.data[i+2])/3;if(lum<175)raster[yy*bytesPerRow+(x>>3)]|=0x80>>(x&7);}}
  const header=new Uint8Array([0x1b,0x40,0x1d,0x76,0x30,0x00,bytesPerRow&255,(bytesPerRow>>8)&255,usedHeight&255,(usedHeight>>8)&255]);
  const cut=new Uint8Array([0x0a,0x0a,0x1d,0x56,0x41,0x03]);
  return concat(header,raster,cut);
}
function wrap(ctx:CanvasRenderingContext2D,line:string,max:number){if(!line)return[''];const words=String(line).split(/\s+/),out:string[]=[];let cur='';for(const word of words){const t=cur?`${cur} ${word}`:word;if(ctx.measureText(t).width>max&&cur){out.push(cur);cur=word;}else cur=t;}if(cur)out.push(cur);return out;}
function concat(...xs:Uint8Array[]){const n=xs.reduce((a,x)=>a+x.length,0),o=new Uint8Array(n);let p=0;xs.forEach(x=>{o.set(x,p);p+=x.length});return o;}function bytesToBase64(v:Uint8Array){let s='';for(let i=0;i<v.length;i+=0x8000)s+=String.fromCharCode(...v.subarray(i,i+0x8000));return btoa(s);}function escape(v:string){return v.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]!));}

function buildReceiptModel(payload:Payload,user:AuthUser,invoiceNo?:string):ReceiptModel{
  const h=payload.invoices;
  const items=payload.invoiceDtl.map(x=>({
    name:String(x.Pro_AR_Name||x.Pro_EN_Name||'صنف'),
    qty:Number(x.Qty)||0,
    unitPrice:Number(x.Price)||0,
    total:Number(x.GrandTotal)||0,
    notes:[x.Flavors].filter(Boolean).flatMap(v=>String(v).split(',').map(s=>s.trim()).filter(Boolean))
  }));
  return {
    branchName:String(user.BranchName||'FUTEC'),
    address:String(user.Address||''),
    phone:String(user.Phones||''),
    taxNo:String(user.TaxNo||''),
    invoiceNo:String(invoiceNo||h.InvoiceNo||''),
    dateText:new Date(h.RealTime).toLocaleString('ar-JO'),
    cashier:String(user.Username||''),
    orderType:resolveOrderType(h.TableNo),
    tableLabel:resolveTableLabel(h.TableNo),
    currency:String(user.DefaultCurrency||''),
    items,
    subtotal:Number(h.InvoiceSubTotal)||0,
    discount:Number(h.InvoiceDiscountTotal)||0,
    tax:Number(h.InvoiceTaxTotal)||0,
    total:Number(h.InvoiceGrandTotal)||0,
  };
}
function resolveOrderType(tableNo:number){return Number(tableNo)>=0?'محلي':'سفري';}
function resolveTableLabel(tableNo:number){return Number(tableNo)>=0?`الطاولة: ${tableNo}`:'';}
function receiptHtml(model:ReceiptModel){
  const logo=`${location.origin}/assets/logo.png`;
  const items=model.items.map(item=>`<div class="item"><div class="item-name">${escape(item.name)}</div><div class="item-meta"><span>${item.qty} × ${item.unitPrice.toFixed(3)}</span><strong>${item.total.toFixed(3)}</strong></div>${item.notes.length?`<div class="item-notes">${item.notes.map(n=>`<span>• ${escape(n)}</span>`).join('')}</div>`:''}</div>`).join('');
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>Receipt</title><style>
  @page{size:80mm auto;margin:0}
  *{box-sizing:border-box} body{margin:0;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;color:#111} .sheet{width:80mm;max-width:80mm;margin:0 auto;background:#fff;padding:10px 9px 14px} .center{text-align:center}
  .logo{display:block;width:54px;height:54px;object-fit:contain;margin:0 auto 6px;border-radius:12px}.store{font-size:18px;font-weight:800}.sub{font-size:11px;line-height:1.45;color:#444}.invoice-title{margin:8px 0;padding:6px 8px;border:1px solid #111;border-radius:10px;font-weight:800;font-size:14px;text-align:center}
  .meta{border-top:1px dashed #777;border-bottom:1px dashed #777;padding:7px 0;margin:8px 0}.meta-row,.sum-row,.sum-grand{display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0}.meta-row b,.sum-row b,.sum-grand b{font-weight:800}.items-head{display:flex;justify-content:space-between;font-size:11px;font-weight:800;padding-bottom:5px}.items{display:grid;gap:7px}.item{padding-bottom:7px;border-bottom:1px dashed #d4d4d4}.item-name{font-size:13px;font-weight:800;line-height:1.35}.item-meta{display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-top:4px}.item-meta strong{font-size:12px}.item-notes{display:grid;gap:2px;font-size:10px;color:#555;margin-top:4px;padding-right:8px}
  .totals{margin-top:8px;padding-top:6px;border-top:1px dashed #777}.sum-grand{font-size:14px;padding-top:6px;margin-top:6px;border-top:1px solid #111}.thanks{margin-top:10px;padding-top:8px;border-top:1px dashed #777;text-align:center}.thanks b{display:block;font-size:13px;margin-bottom:4px}.thanks span{font-size:10px;color:#555}
  @media print{body{background:#fff}.sheet{margin:0 auto;box-shadow:none}}
  </style></head><body><div class="sheet"><div class="center"><img class="logo" src="${logo}" onerror="this.style.display='none'"/><div class="store">${escape(model.branchName)}</div><div class="sub">${escape(model.address||'')}</div>${model.phone?`<div class="sub">هاتف: ${escape(model.phone)}</div>`:''}${model.taxNo?`<div class="sub">الرقم الضريبي: ${escape(model.taxNo)}</div>`:''}</div><div class="invoice-title">فاتورة ضريبية</div><div class="meta"><div class="meta-row"><span>رقم الفاتورة</span><b>${escape(model.invoiceNo)}</b></div><div class="meta-row"><span>التاريخ</span><b>${escape(model.dateText)}</b></div><div class="meta-row"><span>الكاشير</span><b>${escape(model.cashier)}</b></div><div class="meta-row"><span>نوع الطلب</span><b>${escape(model.orderType)}</b></div>${model.tableLabel?`<div class="meta-row"><span>الموقع</span><b>${escape(model.tableLabel.replace(/^.*?:\s*/,''))}</b></div>`:''}</div><div class="items-head"><span>الصنف</span><span>الإجمالي</span></div><div class="items">${items}</div><div class="totals"><div class="sum-row"><span>المجموع</span><b>${model.subtotal.toFixed(3)} ${escape(model.currency)}</b></div><div class="sum-row"><span>الخصم</span><b>${model.discount.toFixed(3)} ${escape(model.currency)}</b></div><div class="sum-row"><span>الضريبة</span><b>${model.tax.toFixed(3)} ${escape(model.currency)}</b></div><div class="sum-grand"><span>الإجمالي</span><b>${model.total.toFixed(3)} ${escape(model.currency)}</b></div></div><div class="thanks"><b>شكراً لزيارتكم</b><span>نتشرف بخدمتكم مرة أخرى</span></div></div><script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`;
}
