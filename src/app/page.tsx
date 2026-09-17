import { cookies } from 'next/headers'; import { redirect } from 'next/navigation';
export default async function Page(){ const c=await cookies(); redirect(c.get('pos_token')?'/pos':'/login'); }
