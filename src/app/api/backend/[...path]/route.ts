import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE } from '@/lib/endpoints';
import { describeServerApiError, serverApiRequestRobust } from '@/lib/server-api';

export const runtime = 'nodejs';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const jar = await cookies();
  const token = jar.get('pos_token')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(path.join('/'), API_BASE);
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  let body: string | undefined;
  let dioNullBody = false;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const requestBody = await req.text();
    headers.set('Content-Type', req.headers.get('content-type') || 'application/json');

    // In Flutter, query-only write calls reach Dio as data == null. dart:io
    // sends those as an empty chunked request. Preserve that wire behavior.
    if (requestBody.length === 0) {
      dioNullBody = true;
    } else {
      body = requestBody;
    }
  }

  try {
    const upstream = await serverApiRequestRobust(url, {
      method: req.method,
      headers,
      body,
      dioNullBody,
    });

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return new NextResponse(upstream.text, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const details = describeServerApiError(error);
    console.error('[POS backend API error]', { path: url.pathname, ...details });
    return NextResponse.json(details, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
