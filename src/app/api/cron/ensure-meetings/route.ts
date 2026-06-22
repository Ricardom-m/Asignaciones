import { NextResponse } from "next/server";
import { ensureMeetingWindow } from "@/lib/meetings";

// Endpoint para tareas programadas (cron). No usa sesión: se autentica con
// CRON_SECRET vía cabecera "Authorization: Bearer <secreto>" o ?key=<secreto>.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("key");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const created = await ensureMeetingWindow();
  return NextResponse.json({ ok: true, created });
}

export const GET = handle;
export const POST = handle;
