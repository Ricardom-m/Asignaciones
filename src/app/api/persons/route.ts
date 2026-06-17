import { prisma } from "@/lib/prisma";
import { personInput } from "@/lib/validation";
import { serializePerson } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// GET /api/persons — lista todas las personas (orden alfabético).
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const persons = await prisma.person.findMany({
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
  });
  return ok(persons.map(serializePerson));
}

// POST /api/persons — crea una persona.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = personInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const person = await prisma.person.create({ data: parsed.data });
  return ok(serializePerson(person), { status: 201 });
}
