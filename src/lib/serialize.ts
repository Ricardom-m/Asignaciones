import type {
  Person as PrismaPerson,
  Record as PrismaRecord,
  Role as PrismaRole,
  Meeting as PrismaMeeting,
  AllowedUser as PrismaAllowedUser,
} from "@prisma/client";
import type { Person, RecordItem, Role, Meeting, AllowedUser } from "@/lib/types";

type RecordWithPeople = PrismaRecord & {
  asignado: PrismaPerson;
  ayudante: PrismaPerson | null;
};

const fullName = (p: PrismaPerson) => `${p.nombre} ${p.apellido}`.trim();

// Una fecha @db.Date vuelve como Date a medianoche UTC → tomamos solo YYYY-MM-DD.
const toYMD = (d: Date) => d.toISOString().slice(0, 10);

export function serializeRole(r: PrismaRole): Role {
  return { id: r.id, nombre: r.nombre, color: r.color, active: r.active };
}

export function serializeMeeting(m: PrismaMeeting): Meeting {
  return { id: m.id, fecha: toYMD(m.fecha), nota: m.nota };
}

export function serializeAllowedUser(u: PrismaAllowedUser): AllowedUser {
  return { id: u.id, email: u.email, nombre: u.nombre, createdAt: u.createdAt.toISOString() };
}

export function serializePerson(p: PrismaPerson & { roles?: PrismaRole[] }): Person {
  return {
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    genero: p.genero,
    active: p.active,
    roles: (p.roles ?? []).map(serializeRole),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeRecord(r: RecordWithPeople): RecordItem {
  return {
    id: r.id,
    asignadoId: r.asignadoId,
    asignado: r.asignado ? fullName(r.asignado) : "—",
    ayudanteId: r.ayudanteId,
    ayudante: r.ayudante ? fullName(r.ayudante) : null,
    fecha: toYMD(r.fecha),
    sala: r.sala,
    tipo: r.ayudanteId ? "Asignado" : "",
    asignacion: r.asignacion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// Include estándar para traer las personas relacionadas en una consulta.
export const recordInclude = { asignado: true, ayudante: true } as const;
