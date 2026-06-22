import { ensureMeetingWindow } from "@/lib/meetings";
import { ok, requireSession } from "@/lib/server";

// POST /api/meetings/ensure — asegura la ventana de la regla (con sesión). Idempotente.
export async function POST() {
  const { response } = await requireSession();
  if (response) return response;
  const created = await ensureMeetingWindow();
  return ok({ created });
}
