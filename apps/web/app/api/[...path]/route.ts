import { NextResponse, type NextRequest } from "next/server";

// Same-origin proxy to the API so the browser never needs to know its host/port —
// only this server needs to. Read at request time (not module load via next.config's
// rewrites, which next build bakes into routes-manifest.json) so the target can be
// changed at container start without a rebuild.
function apiInternalUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:4000";
}

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = new URL(`${apiInternalUrl()}/${path.join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  // undici's fetch doesn't implement the "Expect: 100-continue" handshake browsers
  // and curl send for multipart/form-data uploads — leaving it in makes every file
  // upload fail with "NotSupportedError: expect header not supported".
  headers.delete("expect");

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Required by undici/Node fetch when streaming a request body.
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);

  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete("content-encoding");

  return new NextResponse(res.body, { status: res.status, headers: responseHeaders });
}

export const dynamic = "force-dynamic";

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};
