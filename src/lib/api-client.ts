import { getAccessToken } from './session';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 500, details?: unknown) { super(message); this.status = status; this.details = details; }
}

type Query = Record<string, string | number | boolean | null | undefined>;

const API_BASE=(process.env.NEXT_PUBLIC_POS_API_BASE||'https://rest-test.futec-soft.com/').replace(/\/?$/,'/');

function makeUrl(path:string,query?:Query){
  const url=new URL(path.replace(/^\/+/,''),API_BASE);
  Object.entries(query||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));});
  return url.toString();
}

function authHeaders(extra?:HeadersInit){
  const headers=new Headers(extra);
  headers.set('Accept','application/json');
  const token=getAccessToken();
  if(token)headers.set('Authorization',`Bearer ${token}`);
  return headers;
}

export async function apiGet<T=unknown>(path: string, query?: Query): Promise<T> {
  return browserRequest<T>(makeUrl(path,query),{method:'GET',headers:authHeaders(),cache:'no-store'});
}

export async function apiPost<T=unknown>(path: string, body?: unknown, query?: Query): Promise<T> {
  const headers=authHeaders();
  const init:RequestInit={method:'POST',headers,cache:'no-store'};
  if(body!==undefined){
    headers.set('Content-Type','application/json');
    init.body=JSON.stringify(body);
  }
  return browserRequest<T>(makeUrl(path,query),init);
}

async function browserRequest<T>(url:string,init:RequestInit):Promise<T>{
  let res:Response;
  try{
    res=await fetch(url,{...init,mode:'cors',credentials:'omit'});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(/failed to fetch|networkerror|load failed/i.test(message)){
      throw new ApiError('تعذر الاتصال بالـ API مباشرة من المتصفح. إذا ظهر خطأ CORS في Console فلابد من السماح بعنوان الـ POS من إعدادات CORS في الـ API.',0,{url,cause:message});
    }
    throw new ApiError(message||'فشل الاتصال بالـ API',0,{url});
  }
  const data=await safeJson(res);
  if(!res.ok)throw new ApiError(extractMessage(data)||`HTTP ${res.status}`,res.status,data);
  return data as T;
}

async function safeJson(res: Response) { const text = await res.text(); if (!text) return null; try { return JSON.parse(text); } catch { return text; } }
function extractMessage(x: unknown) {
  if(x&&typeof x==='object'){
    if('message' in x)return String((x as {message?:unknown}).message||'');
    if('ErrorMessage' in x)return String((x as {ErrorMessage?:unknown}).ErrorMessage||'');
  }
  return typeof x==='string'?x.slice(0,500):'';
}

export function unwrapResponse<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'Response' in data) return (data as {Response:T}).Response;
  return data as T;
}

export { API_BASE };
