import { idbGet,idbSet } from './idb';
import type { PendingOrder } from '@/types/pos';
import type { buildInvoiceDraft } from './invoice';
export type InvoicePayload=ReturnType<typeof buildInvoiceDraft>;
const PENDING='pending-invoices'; const ORDERS='pending-orders'; const CATALOG='catalog-cache';
export async function getPendingInvoices(){ return (await idbGet<InvoicePayload[]>(PENDING))||[]; }
export async function savePendingInvoice(p:InvoicePayload){ const a=await getPendingInvoices(); a.push(p); await idbSet(PENDING,a); }
export async function setPendingInvoices(a:InvoicePayload[]){ await idbSet(PENDING,a); }
export async function getOrders(){ return (await idbGet<PendingOrder[]>(ORDERS))||[]; }
export async function setOrders(a:PendingOrder[]){ await idbSet(ORDERS,a); }
export async function cacheCatalog(v:unknown){ await idbSet(CATALOG,v); }
export async function getCachedCatalog<T>(){ return idbGet<T>(CATALOG); }
