import type { AuthUser } from '@/types/pos';

const USER_KEY='futec-pos-user';
const TOKEN_KEY='futec-pos-token';

export function saveUser(u:AuthUser){
  if(typeof window==='undefined')return;
  const {Token,...profile}=u;
  sessionStorage.setItem(USER_KEY,JSON.stringify(profile));
  sessionStorage.setItem(TOKEN_KEY,Token||'');
}

export function loadUser():AuthUser|null{
  if(typeof window==='undefined')return null;
  try{
    const token=sessionStorage.getItem(TOKEN_KEY)||'';
    const profile=JSON.parse(sessionStorage.getItem(USER_KEY)||'null');
    if(!profile||!token)return null;
    return {...profile,Token:token} as AuthUser;
  }catch{return null;}
}

export function getAccessToken(){
  if(typeof window==='undefined')return '';
  return sessionStorage.getItem(TOKEN_KEY)||'';
}

export function clearUser(){
  if(typeof window==='undefined')return;
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
