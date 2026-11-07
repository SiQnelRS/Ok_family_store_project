import { gatewayOrigin } from "../../../../lib/admin";
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
    return new Response(null, { status: 404 });
  try {
    const response = await fetch(
      new URL("/api/media/" + filename, gatewayOrigin()),
      {
        signal: AbortSignal.timeout(10000),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (!response.ok)
      return new Response(null, {
        status: response.status === 404 ? 404 : 503,
      });
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
