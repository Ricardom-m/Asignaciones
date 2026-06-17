import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth, isEmailAllowed } from "@/lib/auth";

// ── Respuestas JSON ───────────────────────────────────────
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

type SessionResult =
  | { session: Session; response: null }
  | { session: null; response: NextResponse };

/**
 * Verifica que haya sesión válida y que el correo siga en la allowlist.
 * Devuelve la sesión o una respuesta 401 lista para retornar.
 */
export async function requireSession(): Promise<SessionResult> {
  const session = await auth();
  if (!session?.user || !isEmailAllowed(session.user.email)) {
    return { session: null, response: fail("No autorizado", 401) };
  }
  return { session, response: null };
}

// ── Rate limiting simple en memoria ───────────────────────
// Suficiente para un equipo pequeño. Para escalar, mover a Upstash/Redis.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function clientKey(req: Request, email?: string | null): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${email ?? "anon"}:${ip}`;
}
