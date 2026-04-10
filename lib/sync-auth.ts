import { NextRequest } from "next/server";

/** Vercel Cron шлёт Authorization: Bearer <CRON_SECRET>, если переменная задана */
export function assertSyncAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: true as const, reason: "no_secret" };
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) {
    return { ok: true as const, reason: "bearer" };
  }
  return { ok: false as const };
}
