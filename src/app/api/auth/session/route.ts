import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req:NextRequest){
  const {token}=await req.json().catch(()=>({token:''}));
  if(!token||typeof token!=='string')return NextResponse.json({message:'Token is required'},{status:400});
  const jar=await cookies();
  jar.set('pos_token',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});
  return NextResponse.json({ok:true});
}
