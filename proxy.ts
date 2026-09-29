import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for the API when another site (e.g. the main game) calls it from a different origin.
 * ALLOWED_ORIGINS: comma-separated origins, e.g. https://game.example.com
 * Left empty = allow any origin (fine for the hackathon demo, tighten for production).
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function allowOrigin(origin: string): string | null {
  if (allowedOrigins.length === 0) return "*";
  return allowedOrigins.includes(origin) ? origin : null;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowOrigin(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: { ...(allowed && { "Access-Control-Allow-Origin": allowed }), ...corsOptions },
    });
  }

  const response = NextResponse.next();
  if (allowed) response.headers.set("Access-Control-Allow-Origin", allowed);
  Object.entries(corsOptions).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
