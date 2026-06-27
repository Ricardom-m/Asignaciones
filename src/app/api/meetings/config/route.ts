import { prisma } from "@/lib/prisma";
import { meetingConfigInput } from "@/lib/validation";
import { ok, fail, requireSession, requireAdmin, rateLimit, clientKey } from "@/lib/server";

const ID = "default";
const DEFAULTS = { weekdays: [4, 6], weeks: 4, congregacion: null };

// GET /api/meetings/config — la regla guardada (días + semanas + congregación).
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const cfg = await prisma.meetingConfig.findUnique({ where: { id: ID } });
  return ok(cfg ? { weekdays: cfg.weekdays, weeks: cfg.weeks, congregacion: cfg.congregacion } : DEFAULTS);
}

// PUT /api/meetings/config — guarda la regla. Solo admin.
export async function PUT(req: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = meetingConfigInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { weekdays, weeks, congregacion } = parsed.data;
  const cong = congregacion === undefined ? undefined : congregacion?.trim() || null;
  const cfg = await prisma.meetingConfig.upsert({
    where: { id: ID },
    create: { id: ID, weekdays, weeks, congregacion: cong ?? null },
    update: { weekdays, weeks, ...(cong !== undefined ? { congregacion: cong } : {}) },
  });
  return ok({ weekdays: cfg.weekdays, weeks: cfg.weeks, congregacion: cfg.congregacion });
}
