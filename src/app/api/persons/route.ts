import { prisma } from "@/lib/prisma";
import { personInput } from "@/lib/validation";
import { serializePerson } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// GET /api/persons — lista todas las personas con sus roles (orden alfabético).
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const persons = await prisma.person.findMany({
    include: { roles: true },
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
  });
  return ok(persons.map(serializePerson));
}

// POST /api/persons — crea una persona (opcionalmente con roles).
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = personInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { nombre, apellido, genero, roleIds, active } = parsed.data;
  const person = await prisma.person.create({
    data: {
      nombre,
      apellido,
      ...(genero !== undefined ? { genero } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(roleIds?.length ? { roles: { connect: roleIds.map((id) => ({ id })) } } : {}),
    },
    include: { roles: true },
  });
  return ok(serializePerson(person), { status: 201 });
}
