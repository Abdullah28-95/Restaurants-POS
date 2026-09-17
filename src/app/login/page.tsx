'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { establishLocalSession, loginDirect } from '@/lib/auth-api';
import { getCashFlowStatus } from '@/lib/cash-flow';
import { clearUser, saveUser } from '@/lib/session';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatus('جاري تسجيل الدخول...');

    try {
      const user = await loginDirect(username, password);
      await establishLocalSession(user.Token);
      saveUser(user);

      setStatus('جاري التحقق من يوم العمل ونقطة البيع...');
      const flow = await getCashFlowStatus(user);

      if (flow.mustCloseDay) {
        router.replace(`/end-day?date=${encodeURIComponent(flow.lineDate)}`);
        return;
      }

      if (!flow.hasSaleDay || !flow.hasPoint) {
        const params = new URLSearchParams({ lineDate: flow.lineDate });
        if (!flow.hasSaleDay) params.set('openDay', '1');
        router.replace(`/cash/open?${params.toString()}`);
        return;
      }

      router.replace('/pos');
    } catch (e) {
      // إذا فشل فحص التشغيل بعد نجاح الـ login، لا نترك جلسة نصف مفتوحة.
      clearUser();
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setStatus('');
      setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'linear-gradient(rgba(18,20,24,.64),rgba(18,20,24,.72)),url(/assets/login_background.jpg) center/cover',
      }}
    >
      <form
        onSubmit={submit}
        className="card"
        style={{
          width: 'min(430px,92vw)',
          padding: 28,
          backdropFilter: 'blur(14px)',
          background: 'rgba(255,255,255,.94)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <img
            src="/assets/logo.jpeg"
            alt="Futec"
            style={{ width: 64, height: 64, borderRadius: 15, objectFit: 'cover' }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 25 }}>نقطة بيع المطاعم</h1>
            <div className="muted">Futec Restaurant POS · Next.js</div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fdecec',
              color: '#a82424',
              padding: 10,
              borderRadius: 10,
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}

        {loading && status && (
          <div
            style={{
              background: '#eef6ff',
              color: '#245b9d',
              padding: 10,
              borderRadius: 10,
              marginBottom: 12,
              textAlign: 'center',
              fontWeight: 700,
            }}
          >
            {status}
          </div>
        )}

        <label>
          اسم المستخدم
          <input
            className="input ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{ margin: '6px 0 14px' }}
          />
        </label>
        <label>
          كلمة المرور
          <input
            className="input ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ margin: '6px 0 18px' }}
          />
        </label>
        <button className="btn primary" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
        </button>
        <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '16px 0 0' }}>
          يتم التحقق من يوم العمل ونقطة الكاش تلقائيًا بعد تسجيل الدخول
        </p>
      </form>
    </main>
  );
}
