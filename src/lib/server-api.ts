import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';

export type ServerApiResult = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  transport?: 'http1' | 'http2';
  attempt?: 'dio-http1' | 'swagger-http2' | 'swagger-http1';
};

type RequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: string;
  /**
   * Dio/IOHttpClient sends a body-capable request with data == null as an
   * empty chunked HTTP/1.1 entity (Transfer-Encoding: chunked, no
   * Content-Length). The Futec server routes this differently from
   * Content-Length: 0, so query-only POSTs need this mode.
   */
  dioNullBody?: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function allowInsecureTls() {
  return String(process.env.POS_ALLOW_INSECURE_TLS || '').toLowerCase() === 'true';
}

function timeoutMs() {
  const parsed = Number(process.env.POS_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isBodyMethod(method: string) {
  return !['GET', 'HEAD'].includes(method);
}

function prepareRequest(options: RequestOptions = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (!headers.has('accept')) headers.set('accept', 'application/json');

  let bodyBuffer: Buffer | undefined;
  const useDioNullBody = isBodyMethod(method) && options.dioNullBody === true;

  if (isBodyMethod(method)) {
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');

    if (useDioNullBody) {
      // Match dart:io HttpClient for POST/PUT/PATCH with no request data:
      // contentLength remains unknown (-1), therefore HTTP/1.1 uses chunked
      // transfer encoding. Do not send Content-Length: 0.
      headers.delete('content-length');
      if (!headers.has('transfer-encoding')) headers.set('transfer-encoding', 'chunked');
      bodyBuffer = undefined;
    } else {
      const body = options.body ?? '';
      bodyBuffer = Buffer.from(body, 'utf8');
      headers.delete('transfer-encoding');
      if (!headers.has('content-length')) headers.set('content-length', String(bodyBuffer.byteLength));
    }
  }

  return { method, headers, bodyBuffer, useDioNullBody };
}

/** HTTP/1.1 transport, close to Dart IOHttpClient behavior. */
export async function serverApiRequest(url: URL, options: RequestOptions = {}): Promise<ServerApiResult> {
  const { method, headers, bodyBuffer } = prepareRequest(options);
  const protocol = url.protocol === 'https:' ? https : http;

  if (!headers.has('user-agent')) {
    headers.set('user-agent', process.env.POS_API_USER_AGENT || 'Dart/3 (dart:io)');
  }

  return await new Promise<ServerApiResult>((resolve, reject) => {
    const request = protocol.request(
      url,
      {
        method,
        headers: Object.fromEntries(headers.entries()),
        family: 4,
        ...(url.protocol === 'https:'
          ? {
              rejectUnauthorized: !allowInsecureTls(),
              servername: url.hostname,
              ALPNProtocols: ['http/1.1'],
            }
          : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) responseHeaders.append(key, item);
            } else if (value !== undefined) {
              responseHeaders.set(key, String(value));
            }
          }

          const status = response.statusCode || 502;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: responseHeaders,
            text: Buffer.concat(chunks).toString('utf8'),
            transport: 'http1',
          });
        });
      },
    );

    request.setTimeout(timeoutMs(), () => {
      const error = new Error(`API request timed out after ${timeoutMs()} ms`) as Error & { code?: string };
      error.code = 'API_TIMEOUT';
      request.destroy(error);
    });

    request.on('error', reject);
    if (bodyBuffer !== undefined) request.end(bodyBuffer);
    else request.end();
  });
}

/**
 * HTTP/2 fallback that mirrors the browser/Swagger transport. This is only
 * used when the legacy HTTP/1.1 route returns the known Plesk/HTTP.sys routing
 * responses. It stays HTTPS and does not downgrade credentials to plain HTTP.
 */
export async function serverApiRequestHttp2(url: URL, options: RequestOptions = {}): Promise<ServerApiResult> {
  if (url.protocol !== 'https:') throw new Error('HTTP/2 fallback requires HTTPS');

  const { method, headers, bodyBuffer } = prepareRequest(options);
  if (!headers.has('user-agent')) {
    headers.set(
      'user-agent',
      process.env.POS_API_HTTP2_USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
    );
  }

  // Swagger is known to work from the browser on the API host. These headers
  // make the fallback look like the same same-origin request without changing
  // the API contract/query parameters.
  const origin = `${url.protocol}//${url.host}`;
  if (!headers.has('origin')) headers.set('origin', origin);
  if (!headers.has('referer')) headers.set('referer', `${origin}/swagger/index.html`);

  return await new Promise<ServerApiResult>((resolve, reject) => {
    const session = http2.connect(origin, {
      rejectUnauthorized: !allowInsecureTls(),
      servername: url.hostname,
    });

    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      try { session.destroy(); } catch {}
      reject(error);
    };

    const timer = setTimeout(() => {
      const error = new Error(`API HTTP/2 request timed out after ${timeoutMs()} ms`) as Error & { code?: string };
      error.code = 'API_TIMEOUT';
      finishReject(error);
    }, timeoutMs());

    session.once('error', (error) => {
      clearTimeout(timer);
      finishReject(error);
    });

    session.once('connect', () => {
      const h2Headers: http2.OutgoingHttpHeaders = {
        [http2.constants.HTTP2_HEADER_METHOD]: method,
        [http2.constants.HTTP2_HEADER_PATH]: `${url.pathname}${url.search}`,
        [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
        [http2.constants.HTTP2_HEADER_AUTHORITY]: url.host,
      };

      headers.forEach((value, key) => {
        // Connection-specific HTTP/1 headers are illegal in HTTP/2.
        if (!['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
          h2Headers[key.toLowerCase()] = value;
        }
      });

      const req = session.request(h2Headers);
      const chunks: Buffer[] = [];
      let status = 502;
      const responseHeaders = new Headers();

      req.on('response', (incoming) => {
        status = Number(incoming[http2.constants.HTTP2_HEADER_STATUS] || 502);
        for (const [key, value] of Object.entries(incoming)) {
          if (key.startsWith(':') || value === undefined) continue;
          if (Array.isArray(value)) {
            for (const item of value) responseHeaders.append(key, String(item));
          } else {
            responseHeaders.set(key, String(value));
          }
        }
      });

      req.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      req.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        session.close();
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: responseHeaders,
          text: Buffer.concat(chunks).toString('utf8'),
          transport: 'http2',
        });
      });

      req.on('error', (error) => {
        clearTimeout(timer);
        finishReject(error);
      });

      if (bodyBuffer !== undefined) req.end(bodyBuffer);
      else req.end();
    });
  });
}

export function looksLikePlesk404(result: ServerApiResult) {
  return result.status === 404 && /WebPros International|Plesk|Page Not Found/i.test(result.text);
}

export function looksLikePleskRoutingError(result: ServerApiResult) {
  return (result.status === 400 || result.status === 404)
    && /WebPros International|Plesk|Bad Request|Page Not Found/i.test(result.text);
}

export function looksLikeLegacyRoutingFailure(result: ServerApiResult) {
  return result.status === 411 || looksLikePleskRoutingError(result);
}

/**
 * Normal API call with an automatic HTTP/2/Swagger-compatible retry only for
 * the exact legacy routing failures seen on api.futec-soft.com.
 */
export async function serverApiRequestRobust(url: URL, options: RequestOptions = {}): Promise<ServerApiResult> {
  const firstRaw = await serverApiRequest(url, options);
  const first: ServerApiResult = { ...firstRaw, attempt: 'dio-http1' };
  if (!looksLikeLegacyRoutingFailure(first) || url.protocol !== 'https:') return first;

  let h2Result: ServerApiResult | undefined;
  try {
    const h2Raw = await serverApiRequestHttp2(url, options);
    h2Result = { ...h2Raw, attempt: 'swagger-http2' };
    if (!looksLikeLegacyRoutingFailure(h2Result)) return h2Result;
  } catch (error) {
    console.warn('[POS API] HTTP/2 Swagger fallback failed', {
      url: `${url.origin}${url.pathname}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Final browser/Swagger-style HTTP/1.1 attempt. Unlike the Dio-shaped first
  // request, do not force chunked transfer encoding here; send an explicit
  // zero-length entity for query-only POSTs.
  const origin = `${url.protocol}//${url.host}`;
  const swaggerHeaders = new Headers(options.headers);
  swaggerHeaders.set('accept', swaggerHeaders.get('accept') || 'application/json');
  swaggerHeaders.set('content-type', swaggerHeaders.get('content-type') || 'application/json');
  swaggerHeaders.set(
    'user-agent',
    process.env.POS_API_HTTP2_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
  );
  swaggerHeaders.set('origin', origin);
  swaggerHeaders.set('referer', `${origin}/swagger/index.html`);

  try {
    const thirdRaw = await serverApiRequest(url, {
      ...options,
      headers: swaggerHeaders,
      dioNullBody: false,
      body: options.body ?? '',
    });
    const third: ServerApiResult = { ...thirdRaw, attempt: 'swagger-http1' };
    return third;
  } catch (error) {
    console.warn('[POS API] HTTP/1.1 Swagger fallback failed', {
      url: `${url.origin}${url.pathname}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return h2Result || first;
  }
}

export function describeServerApiError(error: unknown) {
  const err = error as Error & { code?: string; cause?: unknown };
  const code = err?.code || ((err?.cause as { code?: string } | undefined)?.code) || 'API_CONNECTION_ERROR';
  const rawMessage = err instanceof Error ? err.message : String(error || 'Unknown API connection error');

  const tlsCodes = new Set([
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'ERR_OSSL_X509_CERT_ALREADY_IN_HASH_TABLE',
  ]);

  if (tlsCodes.has(code) || /certificate|cert|tls|ssl/i.test(rawMessage)) {
    return {
      code,
      message: `SSL certificate validation failed (${code}). Set POS_ALLOW_INSECURE_TLS=true temporarily, or fix the API certificate.`,
      cause: rawMessage,
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code, message: `تعذر العثور على عنوان خادم الـ API (${code}). تحقق من الإنترنت واسم الدومين.`, cause: rawMessage };
  }

  if (code === 'ECONNREFUSED') {
    return { code, message: `خادم الـ API رفض الاتصال (${code}). تحقق من أن الخدمة والمنفذ يعملان.`, cause: rawMessage };
  }

  if (code === 'ETIMEDOUT' || code === 'API_TIMEOUT') {
    return { code, message: `انتهت مهلة الاتصال بخادم الـ API (${code}).`, cause: rawMessage };
  }

  return { code, message: `فشل الاتصال بخادم الـ API (${code}): ${rawMessage}`, cause: rawMessage };
}
