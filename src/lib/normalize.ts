import type {
  AuthUser, Category, Delivery, DeliveryDiscount, Discount, Flavor, Offer,
  PaymentType, Product, Question, RemoteSetting
} from '@/types/pos';

export const n = (v: unknown, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};
export const s = (v: unknown, fallback = '') => v == null ? fallback : String(v);
export const b = (v: unknown, fallback = false) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const x = v.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(x)) return true;
    if (['false', '0', 'no', ''].includes(x)) return false;
  }
  return fallback;
};
const arr = <T>(v: unknown): T[] => Array.isArray(v) ? v as T[] : [];

export function normalizeAuth(raw: Record<string, unknown>): AuthUser {
  return {
    Token: s(raw.Token), UserNo: n(raw.UserNo), Username: s(raw.Username),
    TakeAway: b(raw.TakeAway), DriveThru: b(raw.DriveThru), DineInopen: b(raw.DineInopen), DineInclose: b(raw.DineInclose),
    DefaultBranch: s(raw.DefaultBranch), DefaultCurrency: s(raw.DefaultCurrency), NumbersOfDigits: n(raw.NumbersOfDigits, 3),
    TaxNo: s(raw.TaxNo), BranchName: s(raw.BranchName), Phones: s(raw.Phones), Address: s(raw.Address),
    POBox: s(raw.POBox), Website: s(raw.Website), ExpaireDate: s(raw.ExpaireDate),
    Permissions: arr<Record<string, unknown>>(raw.Permissions).map(x => ({ UserNo:n(x.UserNo), PermissionId:s(x.PermissionId), Allow:b(x.Allow), WarehouseId:n(x.WarehouseId) }))
  };
}

export function normalizeCategory(x: Record<string, unknown>): Category {
  return { catId:s(x.CatID), arName:s(x.Cat_AR_Name), enName:s(x.Cat_EN_Name), taxPercentage:n(x.TaxPercentage), icon:x.ImgPath ? s(x.ImgPath):null,
    backColor:x.BackColor ? s(x.BackColor):null, foreColor:x.ForeColor ? s(x.ForeColor):null, price:x.Price == null?null:s(x.Price), printer:x.Printer==null?null:s(x.Printer),
    printer2:x.Printer2==null?null:s(x.Printer2), tag:s(x.Tag), saleable:b(x.Saleable), standardItem:b(x.StandardItem), discountable:b(x.Discountable)};
}
export function normalizeProduct(x: Record<string, unknown>): Product {
  return { proId:s(x.ProID), barcode:s(x.Barcode), arName:s(x.Pro_AR_Name), enName:s(x.Pro_EN_Name), catId:s(x.CatID), categoryAr:s(x.CategoryAr), categoryEn:s(x.CategoryEn), father:s(x.Father),
    price:n(x.Price), price2:n(x.Price2), price3:n(x.Price3), price4:n(x.Price4), taxable:b(x.Taxable), taxPercentage:n(x.TaxPercentage), discountable:b(x.Discountable), icon:x.ImgPath?s(x.ImgPath):null,
    backColor:x.BackColor?s(x.BackColor):null, foreColor:x.ForeColor?s(x.ForeColor):null, printer:x.Printer==null?null:s(x.Printer), printer2:x.Printer2==null?null:s(x.Printer2), tag:s(x.Tag), preparationTime:n(x.PreparationTime),
    question1:x.Question1==null?null:s(x.Question1), question2:x.Question2==null?null:s(x.Question2), question3:x.Question3==null?null:s(x.Question3), question4:x.Question4==null?null:s(x.Question4), question5:x.Question5==null?null:s(x.Question5),
    standardItem:b(x.StandardItem), isActive:b(x.IsActive,true), rawMaterial:b(x.RawMaterial), compositeMaterial:b(x.CompositeMaterial), compo:b(x.Compo), isMaximumQty:b(x.IsMaximumQty),
    question1Qty:x.Question1Qty==null?null:s(x.Question1Qty), question2Qty:x.Question2Qty==null?null:s(x.Question2Qty), question3Qty:x.Question3Qty==null?null:s(x.Question3Qty), question4Qty:x.Question4Qty==null?null:s(x.Question4Qty), question5Qty:x.Question5Qty==null?null:s(x.Question5Qty) };
}
export function normalizeFlavor(x: Record<string, unknown>): Flavor {
  let categories: string[] = [];
  const raw = x.Category;
  if (Array.isArray(raw)) categories = raw.map(String); else if (typeof raw === 'string') { try { const p=JSON.parse(raw); categories=Array.isArray(p)?p.map(String):[]; } catch { categories=raw.split(',').map(y=>y.trim()).filter(Boolean); } }
  return { flavorNo:n(x.FlavorNo), arName:s(x.FlavorAr), enName:s(x.FlavorEn), price:n(x.Price), warehouse:s(x.Warehouse), categories, isActive:b(x.IsActive,true) };
}
export const normalizeQuestion = (x:Record<string,unknown>): Question => ({ productId:s(x.ProductId), questionElements1:s(x.QuestionElements1), productQuestionId:n(x.ProductQuestionId), productPrice:n(x.ProductPrice), isRequired:b(x.IsRequired), questionAr:s(x.QuestionAr) });
export const normalizeOffer = (x:Record<string,unknown>): Offer => ({ offerId:n(x.OfferId), productId:s(x.ProductId), productNameAr:s(x.ProductNameAr), productNameEn:s(x.ProductNameEn), fromDate:s(x.FromDate), toDate:s(x.ToDate), priceOffer:b(x.PriceOffer), qtyOffer:b(x.QtyOffer), extraOffer:b(x.ExtraOffer), price:n(x.Price), qty:n(x.Qty), extraProduct:s(x.ExtraProduct), isActive:b(x.IsActive,true), extraProductAr:x.ExtraProductAr==null?null:s(x.ExtraProductAr), extraProductEn:x.ExtraProductEn==null?null:s(x.ExtraProductEn), offerTypeAr:s(x.OfferTypeAr), offerTypeEn:s(x.OfferTypeEn), offerValueAr:s(x.offerValueAr), offerValueEn:s(x.offerValueEn), dineInOffers:n(x.DineInOffers) });
export const normalizeDiscount = (x:Record<string,unknown>): Discount => ({ serial:n(x.Serial), percentage:n(x.DiscountPercentage), arName:s(x.DiscountTypeAr), enName:s(x.DiscountTypeEn), active:b(x.Active,true) });
export const normalizeDelivery = (x:Record<string,unknown>): Delivery => ({ companyId:n(x.CompanyId), companyName:s(x.CompanyName), phone:x.phone==null?null:s(x.phone), email:x.email==null?null:s(x.email), percent:n(x.Percent), priceCategory:n(x.PriceCategory), active:b(x.Active,true) });
export const normalizeDeliveryDiscount = (x:Record<string,unknown>): DeliveryDiscount => ({ lineId:n(x.LineId), companyId:n(x.CompanyId), companyDesc:s(x.CompanyDesc), fromDate:s(x.FromDate), toDate:s(x.ToDate), discountValue:n(x.DiscountValue), branchId:n(x.BranchId), branchName:s(x.Branche), isActive:b(x.IsActive,true) });
export const normalizePaymentType = (x:Record<string,unknown>): PaymentType => ({ ptype:n(x.Ptype), arName:s(x.PaymentArDesc), enName:s(x.PaymentEnDesc), cashMoney:b(x.CashMoney), commissions:n(x.Commissions), coupon:b(x.Coupon), isCredit:b(x.IsCredit) });
export const normalizeSetting = (x:Record<string,unknown>): RemoteSetting => ({ settingId:n(x.SettingId), arDesc:s(x.SettingArdesc), enDesc:s(x.SettingEndesc), value1:s(x.Value1), value2:n(x.Value2), value3:n(x.Value3), value4:b(x.Value4), value5:s(x.Value5), visible:b(x.Visible,true), groupTypeAr:s(x.GroupTypeAr), groupTypeEn:s(x.GroupTypeEn) });
