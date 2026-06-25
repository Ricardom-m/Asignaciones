import { prisma } from "@/lib/prisma";
import { sectionInput } from "@/lib/validation";
import { serializeSection } from "@/lib/serialize";
import { ok, fail, requireSession, requireAdmin, rateLimit, clientKey } from "@/lib/server";

// GET /api/sections — lista las secciones (ordenadas).
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const sections = await prisma.section.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  return ok(sections.map(serializeSection));
}

// POST /api/sections — crea una sección (se agrega al final). Solo admin.
export async function POST(req: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = sectionInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.section.findUnique({ where: { nombre: parsed.data.nombre } });
  if (exists) return fail("Ya existe una sección con ese nombre", 409);

  const count = await prisma.section.count();
  const section = await prisma.section.create({
    data: { nombre: parsed.data.nombre, orden: parsed.data.orden ?? count },
  });
  return ok(serializeSection(section), { status: 201 });
}
