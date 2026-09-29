import { NextResponse } from "next/server";

/**
 * Health check for uptime monitors and the keep-alive job.
 * Render's free plan sleeps after ~15 minutes without traffic, so an external job
 * calls this every 5-10 minutes. Kept cheap on purpose: no RPC or blacklist calls.
 *
 * GET  /api/health -> { status: "ok", service, time, startedAt, uptimeSeconds, commit }
 * HEAD /api/health -> 200, no body
 */

const startedAt = new Date().toISOString();

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "veris-backend",
      time: new Date().toISOString(),
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      // Set automatically by Render; null when running elsewhere
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
