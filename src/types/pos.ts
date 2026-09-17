export interface Permission {
  UserNo: number;
  PermissionId: string;
  Allow: boolean;
  WarehouseId: number;
}

export interface AuthUser {
  Token: string;
  UserNo: number;
  Username: string;
  TakeAway: boolean;
  DriveThru: boolean;
  DineInopen: boolean;
  DineInclose: boolean;
  DefaultBranch: string;
  DefaultCurrency: string;
  NumbersOfDigits: number;
  TaxNo: string;
  BranchName: string;
  Phones: string;
  Address: string;
  POBox: string;
  Website: string;
  ExpaireDate: string;
  Permissions: Permission[];
}

export interface Category {
  catId: string;
  arName: string;
  enName: string;
  taxPercentage: number;
  icon?: string | null;
  backColor?: string | null;
  foreColor?: string | null;
  price?: string | null;
  printer?: string | null;
  printer2?: string | null;
  tag: string;
  saleable: boolean;
  standardItem: boolean;
  discountable: boolean;
}

export interface Product {
  proId: string;
  barcode: string;
  arName: string;
  enName: string;
  catId: string;
  categoryAr: string;
  categoryEn: string;
  father: string;
  price: number;
  price2: number;
  price3: number;
  price4: number;
  taxable: boolean;
  taxPercentage: number;
  discountable: boolean;
  icon?: string | null;
  backColor?: string | null;
  foreColor?: string | null;
  printer?: string | null;
  printer2?: string | null;
  tag: string;
  preparationTime: number;
  question1?: string | null;
  question2?: string | null;
  question3?: string | null;
  question4?: string | null;
  question5?: string | null;
  standardItem: boolean;
  isActive: boolean;
  rawMaterial: boolean;
  compositeMaterial: boolean;
  compo: boolean;
  isMaximumQty: boolean;
  question1Qty?: string | null;
  question2Qty?: string | null;
  question3Qty?: string | null;
  question4Qty?: string | null;
  question5Qty?: string | null;
}

export interface Flavor {
  flavorNo: number;
  arName: string;
  enName: string;
  price: number;
  warehouse: string;
  categories: string[];
  isActive: boolean;
}

export interface Question {
  productId: string;
  questionElements1: string;
  productQuestionId: number;
  productPrice: number;
  isRequired: boolean;
  questionAr: string;
}

export interface Offer {
  offerId: number;
  productId: string;
  productNameAr: string;
  productNameEn: string;
  fromDate: string;
  toDate: string;
  priceOffer: boolean;
  qtyOffer: boolean;
  extraOffer: boolean;
  price: number;
  qty: number;
  extraProduct: string;
  isActive: boolean;
  extraProductAr?: string | null;
  extraProductEn?: string | null;
  offerTypeAr: string;
  offerTypeEn: string;
  offerValueAr: string;
  offerValueEn: string;
  dineInOffers: number;
}

export interface Discount {
  serial: number;
  percentage: number;
  arName: string;
  enName: string;
  active: boolean;
}

export interface Delivery {
  companyId: number;
  companyName: string;
  phone?: string | null;
  email?: string | null;
  percent: number;
  priceCategory: number;
  active: boolean;
}

export interface DeliveryDiscount {
  lineId: number;
  companyId: number;
  companyDesc: string;
  fromDate: string;
  toDate: string;
  discountValue: number;
  branchId: number;
  branchName: string;
  isActive: boolean;
}

export interface DeliverySelection {
  delivery: Delivery;
  discount?: DeliveryDiscount | null;
}

export interface PaymentType {
  ptype: number;
  arName: string;
  enName: string;
  cashMoney: boolean;
  commissions: number;
  coupon: boolean;
  isCredit: boolean;
}

export interface RemoteSetting {
  settingId: number;
  arDesc: string;
  enDesc: string;
  value1: string;
  value2: number;
  value3: number;
  value4: boolean;
  value5: string;
  visible: boolean;
  groupTypeAr: string;
  groupTypeEn: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  flavors: Flavor[];
  questions: Product[];
  offers: Offer[];
  note: string;
  isOffer: boolean;
  extraItemId?: string | null;
  originalPrice: number;
}

export interface PriceAndTax {
  price: number;
  tax: number;
  discount: number;
  grandTotal: number;
}

export interface PendingOrder {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  name?: string;
  cartItems: CartItem[];
  orderType: number;
  discount?: Discount | null;
  delivery?: DeliverySelection | null;
  note?: string;
}

export interface LocalPrinterSettings {
  stationName: string;
  printerType: 'browser' | 'network' | 'usb' | 'bluetooth' | 'imin';
  printerCashIp: string;
  portCash: string;
  printerKitchenIp1: string;
  portKitchen1: string;
  printerKitchenIp2: string;
  portKitchen2: string;
  printerKitchenIp3: string;
  portKitchen3: string;
  printerKitchenIp4: string;
  portKitchen4: string;
  categoryPrinterMap: Record<string, number>;
  enableKds: boolean;
  kdsPort: number;
  categoryKdsMap: Record<string, number>;
  customerDisplay: boolean;
}

export interface InvoiceListItem {
  InvoiceNo: number;
  InvoiceCashNo: number;
  Customer: number;
  EmpTaker: number;
  SalesDate: string;
  FreeTax: boolean;
  InvoiceSubTotal: number;
  InvoiceDiscountTotal: number;
  InvoiceServiceTotal: number;
  InvoiceTaxTotal: number;
  InvoiceGrandTotal: number;
  StationId: string;
  [key: string]: unknown;
}

export interface InvoiceDetailLine {
  InvoiceNo: number;
  Item: string;
  ArName: string;
  EnName: string;
  Qty: number;
  FatherID: string;
  Price: number;
  Subtotal: number;
  DiscountV: number;
  DiscountP: number;
  TaxP: number;
  TaxV: number;
  GrandTotal: number;
  Taker: number;
  Flavors: string;
  Warehouse: number | string;
  SalesDate: string;
  OfferNo: number;
  LineID: number;
}

export interface InvoiceHeader {
  InvoiceNo: number;
  InvoiceCashNo: number;
  InvoiceSubTotal: number;
  InvoiceDiscountTotal: number;
  InvoiceServiceTotal: number;
  InvoiceTaxTotal: number;
  InvoiceGrandTotal: number;
  IsPrinted: boolean;
  Customer: number;
  RealTime: string;
  TableNo: number;
  EmpTaker: number;
  TakerName: string;
  Queue: number;
  CashPayment: number;
  Warehouse: number | string;
  SalesDate: string;
  DeliveryCompany: number;
  EncryptionSeal: string;
  Guid: string;
  Qrcode: string;
  StationId: string;
}

export interface InvoiceDetailResponse {
  invoices: InvoiceHeader;
  invoiceDtl: InvoiceDetailLine[];
  invoicePayment: Array<Record<string, unknown>>;
}
