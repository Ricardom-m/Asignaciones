import { prisma } from "@/lib/prisma";
import { userInput } from "@/lib/validation";
import { serializeAllowedUser } from "@/lib/serialize";
import { getAllowedEmails } from "@/lib/auth";
import { ok, fail, requireAdmin, rateLimit, clientKey } from "@/lib/server";

// GET /api/users — usuarios autorizados (DB) + los del respaldo por env (bootstrap).
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const users = await prisma.allowedUser.findMany({ orderBy: { email: "asc" } });
  return ok({ users: users.map(serializeAllowedUser), bootstrap: getAllowedEmails() });
}

// POST /api/users — autoriza un correo nuevo.
export async function POST(req: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = userInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { email, nombre } = parsed.data;
  if (getAllowedEmails().includes(email))
    return fail("Ese correo ya está autorizado (respaldo permanente)", 409);
  const exists = await prisma.allowedUser.findUnique({ where: { email } });
  if (exists) return fail("Ese correo ya está autorizado", 409);

  const user = await prisma.allowedUser.create({ data: { email, nombre: nombre ?? null } });
  return ok(serializeAllowedUser(user), { status: 201 });
}
