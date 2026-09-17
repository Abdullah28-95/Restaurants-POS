import type { AuthUser, RemoteSetting } from '@/types/pos';
import { ApiError } from './api-client';
import { getCash, getRemoteSettings, getSaleDay } from './pos-api';

type Obj = Record<string, unknown>;

export interface CashFlowStatus {
  saleDay: Obj | null;
  hasSaleDay: boolean;
  settings: RemoteSetting[];
  cash: Obj | null;
  hasPoint: boolean;
  mustCloseDay: boolean;
  lineDate: string;
  closeTime: string;
}

export async function getCashFlowStatus(user: AuthUser): Promise<CashFlowStatus> {
  let saleDay: Obj | null = null;
  try {
    const value = await getSaleDay(user.DefaultBranch);
    if (value && typeof value === 'object' && value.LineDate) saleDay = value;
  } catch (error) {
    // عدم وجود يوم مفتوح حالة تشغيل طبيعية بعد الـ Login، وليست فشل تسجيل دخول.
    // أخطاء الاتصال/الصلاحية الحقيقية يجب أن تظهر للمستخدم بدل اعتبارها يومًا مغلقًا.
    if (!isClosedDayResponse(error)) throw error;
    saleDay = null;
  }

  const settings = await getRemoteSettings(user.DefaultBranch);

  let cash: Obj | null = null;
  try {
    const value = await getCash(user.UserNo);
    // بعض ردود الـ API ترجع Object افتراضي حتى لو ما في نقطة مفتوحة.
    // النقطة تعتبر مفتوحة فقط إذا كان لديها CashNo حقيقي أكبر من صفر.
    if (isOpenCash(value)) cash = value;
  } catch (error) {
    if (!isNoCashResponse(error)) throw error;
    cash = null;
  }

  const hasSaleDay = saleDay !== null;
  const lineDate = hasSaleDay ? dateOnly(saleDay?.LineDate) : localDateOnly();
  const closeTime = calculateCloseTime(lineDate, settings[1]?.value5);

  return {
    saleDay,
    hasSaleDay,
    settings,
    cash,
    hasPoint: isOpenCash(cash),
    // لا يوجد "وقت إغلاق يوم" إذا لم يوجد يوم عمل مفتوح أصلًا.
    mustCloseDay: hasSaleDay && Date.now() > closeTime.getTime(),
    lineDate,
    closeTime: closeTime.toISOString(),
  };
}

export function isOpenCash(value: unknown): value is Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const cashNo = Number((value as Obj).CashNo ?? (value as Obj).cashNo ?? 0);
  return Number.isFinite(cashNo) && cashNo > 0;
}

export function calculateCloseTime(lineDate: string, value5?: string) {
  const base = parseLocalDate(lineDate);
  const closingHour = extractHour(value5);
  const close = new Date(base);

  // نفس منطق Flutter القديم: أوقات الصباح تعتبر إغلاق اليوم في اليوم التالي.
  if (24 - closingHour > 12) close.setDate(close.getDate() + 1);
  close.setHours(closingHour, 0, 0, 0);
  return close;
}

function isClosedDayResponse(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 0 || error.status === 401 || error.status === 403 || error.status >= 500) return false;
  return error.status === 400 || error.status === 404 || /not\s*found|no\s*data|لا يوجد|مغلق/i.test(error.message);
}

function isNoCashResponse(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 0 || error.status === 401 || error.status === 403 || error.status >= 500) return false;
  return error.status === 400 || error.status === 404 || /not\s*found|no\s*data|cash|point|لا يوجد/i.test(error.message);
}

function extractHour(value?: string) {
  if (!value) return 23;
  const m = String(value).match(/T(\d{1,2}):/);
  if (m) return clampHour(Number(m[1]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 23 : clampHour(d.getHours());
}

function clampHour(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(23, Math.trunc(value))) : 23;
}

function parseLocalDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function dateOnly(value: unknown) {
  const raw = String(value ?? '');
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return localDateOnly();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localDateOnly(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}
