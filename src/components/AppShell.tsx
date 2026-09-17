'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {PosProvider,usePos} from '@/context/PosContext';
import {clearUser} from '@/lib/session';

type IconName='home'|'sales'|'cash'|'endDay'|'reports'|'settings'|'logout';

type NavItem={
  href:string;
  icon:IconName;
  label:string;
  tone?:'cash'|'end-day';
};

const links:NavItem[]=[
  {href:'/pos',icon:'home',label:'POS'},
  {href:'/sales',icon:'sales',label:'المبيعات'},
  {href:'/cash',icon:'cash',label:'إغلاق الكاش',tone:'cash'},
  {href:'/end-day',icon:'endDay',label:'إغلاق اليوم',tone:'end-day'},
  {href:'/reports',icon:'reports',label:'التقارير'},
  {href:'/settings',icon:'settings',label:'الإعدادات'},
];

function SidebarIcon({name}:{name:IconName}){
  const common={width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(name==='home')return <svg {...common}><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
  if(name==='sales')return <svg {...common}><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if(name==='cash')return <svg {...common}><path d="M4 7h16v11H4z"/><path d="M7 10h10M7 14h4"/><circle cx="16.5" cy="14" r="1.5"/></svg>;
  if(name==='endDay')return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.3 2"/><path d="M5.3 5.6 3.8 4.1"/></svg>;
  if(name==='reports')return <svg {...common}><path d="M4 19.5V10M10 19.5V5M16 19.5v-7M22 19.5H2"/></svg>;
  if(name==='settings')return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.07A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15.03 1.7 1.7 0 0 0 3.07 14H3v-4h.07A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.03 4.2l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.07V3h4v.07a1.7 1.7 0 0 0 1.03 1.53 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.93 10H21v4h-.07A1.7 1.7 0 0 0 19.4 15Z"/></svg>;
  return <svg {...common}><path d="M10 5H5.5A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19H10"/><path d="M14 8l4 4-4 4M18 12H8"/></svg>;
}

function Inner({children,title}:{children:React.ReactNode;title:string}){
  const p=usePathname(),r=useRouter(),{user,error}=usePos();
  async function logout(){clearUser();await fetch('/api/auth/logout',{method:'POST'});r.replace('/login')}
  return <div className="app-shell">
    <aside className="side-nav" aria-label="القائمة الرئيسية">
      <div className="side-brand" title={user?.BranchName||'Futec POS'}>
        <div className="side-logo" style={{backgroundImage:'url(/assets/logo.jpeg)'}}/>
        <span className="side-brand-status" aria-hidden="true"/>
      </div>
      <nav className="side-menu">
        {links.map(item=>{
          const active=p===item.href||p.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={`nav-link ${active?'active':''} ${item.tone?`nav-${item.tone}`:''}`}>
            <span className="nav-icon-wrap"><SidebarIcon name={item.icon}/></span>
            <span className="nav-label">{item.label}</span>
          </Link>
        })}
      </nav>
      <div className="side-spacer"/>
      <div className="side-footer">
        <button onClick={logout} className="nav-link nav-logout" type="button">
          <span className="nav-icon-wrap"><SidebarIcon name="logout"/></span>
          <span className="nav-label">خروج</span>
        </button>
      </div>
    </aside>
    <div className="page-wrap">
      <header className="topbar"><div><div className="topbar-title">{title}</div>{error&&<div style={{fontSize:11,color:'#b36b00'}}>{error}</div>}</div><div className="topbar-info"><span className="badge amber">{user?.BranchName||user?.DefaultBranch||'—'}</span><span className="badge">{user?.Username||'—'}</span></div></header>
      {children}
    </div>
  </div>
}
export function AppShell({children,title}:{children:React.ReactNode;title:string}){return <PosProvider><Inner title={title}>{children}</Inner></PosProvider>}
