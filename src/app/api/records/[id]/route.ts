import { prisma } from "@/lib/prisma";
import { recordInput } from "@/lib/validation";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey, isAdmin } from "@/lib/server";
import { SECCION_TESOROS, TESOROS_MAX, esLecturaNombre, esParteSinPersona, esRolNombrado, norm } from "@/lib/sections";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/records/[id] — edita un registro.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = recordInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { asignadoId, ayudanteId, fecha, sala, asignacion, tipo, sectionId, minutos, cantico } = parsed.data;
  if (ayudanteId && ayudanteId === asignadoId)
    return fail("El ayudante no puede ser la misma persona que el asignado", 422);

  const exists = await prisma.record.findUnique({ where: { id }, include: { section: true } });
  if (!exists) return fail("Registro no encontrado", 404);
  if ((exists.soloAdmin || exists.section?.soloAdmin) && !isAdmin(session))
    return fail("Solo el administrador puede editar esta asignación", 403);

  // "Lectura de la Biblia": como mucho una por sala ese día (regla por nombre).
  if (esLecturaNombre(asignacion)) {
    const dupLect = await prisma.record.findFirst({
      where: { fecha: new Date(fecha), sala: sala ?? null, asignacion: { equals: asignacion.trim(), mode: "insensitive" }, id: { not: id } },
    });
    if (dupLect) return fail(`Ya hay una Lectura de la Biblia en ${sala ?? "esa sala"} ese día`, 409);
  }

  // Partes fijas (Canción/Palabras sin persona, o roles): persona opcional.
  let personaOpcional = esParteSinPersona(asignacion) || esRolNombrado(asignacion);
  if (sectionId) {
    const sec = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sec) return fail("Sección inexistente", 422);
    personaOpcional = personaOpcional || sec.sinPersona;
    if (sec.unaPorSala) {
      const dup = await prisma.record.findFirst({
        where: { fecha: new Date(fecha), sectionId, sala: sala ?? null, id: { not: id } },
      });
      if (dup) return fail(`En "${sec.nombre}" ya hay alguien asignado en ${sala ?? "esa sala"} ese día`, 409);
    }
    if (norm(sec.nombre) === norm(SECCION_TESOROS)) {
      const rows = await prisma.record.findMany({ where: { fecha: new Date(fecha), sectionId, id: { not: id } }, select: { asignacion: true } });
      const names = new Set(rows.map((r) => norm(r.asignacion)));
      if (!names.has(norm(asignacion)) && names.size >= TESOROS_MAX)
        return fail(`Máximo ${TESOROS_MAX} asignaciones en ${sec.nombre}`, 409);
    }
  }

  const finalAsignado = asignadoId ?? null;
  if (!personaOpcional && !finalAsignado) return fail("Selecciona el asignado", 422);
  const ids = [...(finalAsignado ? [finalAsignado] : []), ...(ayudanteId ? [ayudanteId] : [])];
  if (ids.length) {
    const count = await prisma.person.count({ where: { id: { in: ids } } });
    if (count !== ids.length) return fail("Persona referida inexistente", 422);
  }

  const record = await prisma.record.update({
    where: { id },
    data: {
      asignadoId: finalAsignado,
      ayudanteId: personaOpcional ? null : ayudanteId ?? null,
      fecha: new Date(fecha),
      sala: sala ?? null,
      asignacion,
      ...(tipo ? { tipo } : {}),
      sectionId: sectionId ?? null,
      minutos: minutos ?? null,
      cantico: cantico ?? null,
    },
    include: recordInclude,
  });
  return ok(serializeRecord(record));
}

// DELETE /api/records/[id]
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const rec = await prisma.record.findUnique({ where: { id }, include: { section: true } });
  if (rec && (rec.soloAdmin || rec.section?.soloAdmin) && !isAdmin(session))
    return fail("Solo el administrador puede borrar esta asignación", 403);
  await prisma.record.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
