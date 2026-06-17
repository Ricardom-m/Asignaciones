import { prisma } from "@/lib/prisma";
import { roleInput } from "@/lib/validation";
import { serializeRole } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// GET /api/roles — lista los roles.
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const roles = await prisma.role.findMany({ orderBy: { nombre: "asc" } });
  return ok(roles.map(serializeRole));
}

// POST /api/roles — crea un rol.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = roleInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.role.findUnique({ where: { nombre: parsed.data.nombre } });
  if (exists) return fail("Ya existe un rol con ese nombre", 409);

  const role = await prisma.role.create({
    data: { nombre: parsed.data.nombre, ...(parsed.data.color ? { color: parsed.data.color } : {}) },
  });
  return ok(serializeRole(role), { status: 201 });
}
