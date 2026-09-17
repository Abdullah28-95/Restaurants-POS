import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE, endpoints } from '@/lib/endpoints';
import { normalizeAuth } from '@/lib/normalize';
import { describeServerApiError, looksLikePleskRoutingError, serverApiRequestRobust } from '@/lib/server-api';

export const runtime = 'nodejs';

async function loginUpstream(url: URL) {
  // Flutter contract: POST + query parameters + JSON headers + no JSON payload.
  // serverApiRequestRobust first uses the Dart-like HTTP/1.1 transport, then
  // automatically retries with the browser/Swagger HTTP/2 transport only when
  // the server returns its known 411/Plesk-404 routing response.
  return await serverApiRequestRobust(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    // Flutter/Dio calls client.post(..., data: null). On dart:io this is an
    // empty chunked POST, not Content-Length: 0. Futec's legacy routing is
    // sensitive to this exact distinction.
    dioNullBody: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ message: 'اسم المستخدم وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const url = new URL(endpoints.login, API_BASE);
    url.searchParams.set('UserName', String(username));
    url.searchParams.set('Password', String(password));

    const r = await loginUpstream(url);

    let body: unknown;
    try {
      body = JSON.parse(r.text);
    } catch {
      body = r.text;
    }

    if (!r.ok) {
      if (looksLikePleskRoutingError(r)) {
        return NextResponse.json(
          {
            message: `خادم الـ API أعاد Plesk ${r.status} بدل استجابة الـ API بعد محاولات الاتصال التلقائية.`,
            upstreamStatus: r.status,
            attempt: r.attempt || 'unknown',
            transport: r.transport || 'unknown',
            upstreamServer: r.headers.get('server') || null,
          },
          { status: 502 },
        );
      }
      return NextResponse.json(
        typeof body === 'object' && body !== null ? body : { message: String(body || 'فشل تسجيل الدخول') },
        { status: r.status },
      );
    }

    const raw = body && typeof body === 'object' && 'Response' in body
      ? (body as { Response: Record<string, unknown> }).Response
      : body as Record<string, unknown>;

    const user = normalizeAuth(raw);
    if (!user.Token) return NextResponse.json({ message: 'لم يُرجع الخادم Token صالحًا' }, { status: 502 });

    const jar = await cookies();
    jar.set('pos_token', user.Token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 16,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const details = describeServerApiError(error);
    console.error('[POS login API error]', details);
    return NextResponse.json(details, { status: 502 });
  }
}
