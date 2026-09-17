import { API_BASE, ApiError } from './api-client';
import { endpoints } from './endpoints';
import { normalizeAuth } from './normalize';
import type { AuthUser } from '@/types/pos';

export async function loginDirect(username:string,password:string):Promise<AuthUser>{
  const url=new URL(endpoints.login.replace(/^\/+/,''),API_BASE);
  url.searchParams.set('UserName',username);
  url.searchParams.set('Password',password);

  let res:Response;
  try{
    res=await fetch(url.toString(),{
      method:'POST',
      headers:{Accept:'application/json'},
      mode:'cors',
      credentials:'omit',
      cache:'no-store',
    });
  }catch(error){
    const msg=error instanceof Error?error.message:String(error);
    throw new ApiError('المتصفح لم يتمكن من الوصول للـ API مباشرة. افتح أدوات المطور Console؛ إذا ظهر CORS فلابد من السماح لـ http://localhost:3000 في إعدادات CORS الخاصة بالـ API.',0,{cause:msg,url:url.toString()});
  }

  const text=await res.text();
  let body:unknown=text;
  try{body=text?JSON.parse(text):null;}catch{}

  if(!res.ok){
    const message=body&&typeof body==='object'&&'ErrorMessage' in body
      ?String((body as {ErrorMessage?:unknown}).ErrorMessage||`HTTP ${res.status}`)
      :body&&typeof body==='object'&&'message' in body
        ?String((body as {message?:unknown}).message||`HTTP ${res.status}`)
        :typeof body==='string'&&body?body.slice(0,500):`HTTP ${res.status}`;
    throw new ApiError(message,res.status,body);
  }

  if(body&&typeof body==='object'&&'Success' in body&&(body as {Success?:unknown}).Success===false){
    throw new ApiError(String((body as {ErrorMessage?:unknown}).ErrorMessage||'فشل تسجيل الدخول'),400,body);
  }

  const raw=body&&typeof body==='object'&&'Response' in body
    ?(body as {Response:Record<string,unknown>}).Response
    :body as Record<string,unknown>;
  const user=normalizeAuth(raw||{});
  if(!user.Token)throw new ApiError('لم يُرجع الـ API Token صالحًا',502,body);
  return user;
}

export async function establishLocalSession(token:string){
  const res=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!res.ok){
    const data=await res.json().catch(()=>null) as {message?:string}|null;
    throw new Error(data?.message||'تعذر إنشاء جلسة POS المحلية');
  }
}
