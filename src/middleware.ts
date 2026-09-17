import { NextRequest, NextResponse } from 'next/server';
const publicPaths=['/login','/customer-display'];
export function middleware(req:NextRequest){ const p=req.nextUrl.pathname; if(p.startsWith('/api/')||p.startsWith('/_next/')||p.startsWith('/assets/')||publicPaths.some(x=>p.startsWith(x)))return NextResponse.next(); const token=req.cookies.get('pos_token')?.value; if(!token){ const u=req.nextUrl.clone();u.pathname='/login';return NextResponse.redirect(u);} return NextResponse.next(); }
export const config={matcher:['/((?!favicon.ico).*)']};
