'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { usePos } from '@/context/PosContext';
import { openPoint } from '@/lib/pos-api';

export default function Page() {
  return (
    <AppShell title="فتح نقطة البيع">
      <Suspense fallback={<Loading />}>
        <OpenCash />
      </Suspense>
    </AppShell>
  );
}

function OpenCash() {
  const { user } = usePos();
  const router = useRouter();
  const search = useSearchParams();
  const lineDate = search.get('lineDate') || undefined;
  const openDayRequired = search.get('openDay') === '1';
  const [amount, setAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await openPoint(user.UserNo, user.DefaultBranch, Number(amount) || 0, lineDate);
      router.replace('/pos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل فتح نقطة البيع');
    } finally {
      setLoading(false);
    }
  }

  const key = (v: string) =>
    setAmount((a) =>
      v === 'C' ? '0' : v === '⌫' ? (a.length > 1 ? a.slice(0, -1) : '0') : a === '0' ? v : a + v,
    );


  return (
    <main className="content">
      <div className="card" style={{ maxWidth: 520, margin: '5vh auto', padding: 24 }}>
        <h2 className="section-title">فتح نقطة بيع جديدة</h2>
        {lineDate && (
          <div className="badge amber" style={{ marginBottom: 10 }}>
            يوم العمل: <span className="num">{lineDate}</span>
          </div>
        )}
        {openDayRequired && (
          <div style={{ background: '#eef8f4', color: '#087658', padding: 11, borderRadius: 12, marginBottom: 10, fontWeight: 700 }}>
            يوم العمل مغلق حاليًا. عند الضغط على فتح نقطة البيع سيتم فتح يوم العمل أولًا ثم فتح النقطة تلقائيًا.
          </div>
        )}
        <p className="muted">أدخل القيمة الافتتاحية / عهدة الصندوق لبدء الشفت.</p>
        <input
          className="input num"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          style={{ fontSize: 28, textAlign: 'center', margin: '12px 0' }}
        />
        <div className="keypad">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'].map((x) => (
            <button key={x} className="key" onClick={() => key(x)}>
              {x}
            </button>
          ))}
        </div>
        {error && <div style={{ color: '#a22', marginTop: 12 }}>{error}</div>}
        <button
          className="btn success"
          disabled={loading}
          onClick={submit}
          style={{ width: '100%', height: 54, marginTop: 16, fontSize: 18 }}
        >
          {loading ? 'جاري الفتح...' : 'فتح نقطة البيع'}
        </button>
      </div>
    </main>
  );
}
