import type { CartItem, DeliverySelection, Discount, Offer, PriceAndTax, Product } from '@/types/pos';
import { generateId } from './generate-id';

export function deliveryDiscountPercent(delivery?: DeliverySelection | null) {
  if (!delivery?.discount || !delivery.discount.isActive) return 0;
  const now = Date.now();
  const from = Date.parse(delivery.discount.fromDate);
  const to = Date.parse(delivery.discount.toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const active = to < from ? now > from || now < to : now > from && now < to;
  return active ? delivery.discount.discountValue : 0;
}

export function priceByCategory(product: Pick<Product,'price'|'price2'|'price3'|'price4'>, category = 1, discountPercent = 0) {
  const list = [product.price, product.price2, product.price3, product.price4];
  const base = list[Math.min(3, Math.max(0, category - 1))] ?? product.price;
  return base - (discountPercent / 100) * base;
}

export function calculatePriceAndTax(price: number, taxPercentage: number, priceIncludesTax: boolean, discount = 0, taxIncludesDiscount = false): PriceAndTax {
  const normalizedDiscount = discount > 1 ? discount / 100 : discount;
  let base: number;
  let tax: number;
  if (priceIncludesTax) {
    base = price / (1 + taxPercentage / 100);
    tax = price - base;
  } else {
    base = price;
    tax = base * (taxPercentage / 100);
  }
  const discountValue = normalizedDiscount ? (taxIncludesDiscount ? (base + tax) * normalizedDiscount : base * normalizedDiscount) : 0;
  return { price: base, tax, discount: discountValue, grandTotal: base + tax - discountValue };
}

export function calculateCartItem(item: CartItem, opts: {taxPercentage:number;priceIncludesTax:boolean;taxIncludesDiscount:boolean;discount?:Discount|null;delivery?:DeliverySelection|null}): PriceAndTax {
  const category = opts.delivery?.delivery.priceCategory || 0;
  const deliveryPct = deliveryDiscountPercent(opts.delivery);
  const discountPct = item.product.discountable === false ? 0 : (opts.discount?.percentage || 0);
  const product = calculatePriceAndTax(priceByCategory(item.product, category, deliveryPct), opts.taxPercentage, opts.priceIncludesTax, discountPct, opts.taxIncludesDiscount);
  const flavors = item.flavors.reduce((a,f)=>sumPT(a, calculatePriceAndTax(f.price, opts.taxPercentage, opts.priceIncludesTax, 0, opts.taxIncludesDiscount)), zero());
  const questions = item.questions.reduce((a,q)=>sumPT(a, calculatePriceAndTax(priceByCategory(q,category,deliveryPct), opts.taxPercentage, opts.priceIncludesTax, 0, opts.taxIncludesDiscount)), zero());
  return mulPT(sumPT(sumPT(product,flavors),questions), item.quantity);
}

export function calculateCart(cart:CartItem[], opts:{taxPercentage:number;priceIncludesTax:boolean;taxIncludesDiscount:boolean;discount?:Discount|null;delivery?:DeliverySelection|null}) {
  return cart.reduce((a,item)=>sumPT(a,calculateCartItem(item,opts)),zero());
}

function zero():PriceAndTax { return {price:0,tax:0,discount:0,grandTotal:0}; }
function sumPT(a:PriceAndTax,b:PriceAndTax):PriceAndTax { return {price:a.price+b.price,tax:a.tax+b.tax,discount:a.discount+b.discount,grandTotal:a.grandTotal+b.grandTotal}; }
function mulPT(a:PriceAndTax,m:number):PriceAndTax { return {price:a.price*m,tax:a.tax*m,discount:a.discount*m,grandTotal:a.grandTotal*m}; }

export function applyOffers(cart:CartItem[], orderType:number):CartItem[] {
  const clean = cart.filter(i=>!i.isOffer);
  const updated = clean.map(item=>{
    let product:Product = {...item.product, price:item.originalPrice, price2:item.originalPrice, price3:item.originalPrice, price4:item.originalPrice};
    for (const offer of item.offers) {
      if (!offerCompatible(offer,item,orderType)) continue;
      if (offer.priceOffer) product = {...product,price:offer.price,price2:offer.price,price3:offer.price,price4:offer.price};
      else if (offer.qtyOffer && item.quantity >= offer.qty && offer.qty > 0) {
        const p=offer.price/offer.qty; product={...product,price:p,price2:p,price3:p,price4:p};
      }
    }
    return {...item, product};
  });
  const out=[...updated];
  for (const item of updated) {
    for (const offer of item.offers) {
      if (!offerCompatible(offer,item,orderType) || !offer.extraOffer || item.quantity < offer.qty || offer.qty<=0) continue;
      const q=Math.floor(item.quantity/offer.qty);
      const p:Product={...item.product,proId:offer.extraProduct || offer.productId,arName:offer.extraProductAr || item.product.arName,enName:offer.extraProductEn || item.product.enName,icon:null,price:offer.price,price2:offer.price,price3:offer.price,price4:offer.price};
      out.push({id:generateId(),product:p,quantity:q,isOffer:true,flavors:[],questions:[],offers:[],note:'',originalPrice:0,extraItemId:item.id});
    }
  }
  return out;
}
function offerCompatible(offer:Offer,item:CartItem,orderType:number){ return offer.isActive && offer.productId===item.product.proId && (offer.dineInOffers===0 || offer.dineInOffers===orderType) && Date.now()<Date.parse(offer.toDate); }
