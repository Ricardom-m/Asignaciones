import { z } from "zod";

// Fecha en formato YYYY-MM-DD (la que produce <input type="date">).
const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usa YYYY-MM-DD)");

// ── Roles ─────────────────────────────────────────────────
const HEX = /^#[0-9a-fA-F]{6}$/;
export const roleInput = z.object({
  nombre: z.string().trim().min(1, "El nombre del rol es obligatorio").max(40),
  color: z.string().regex(HEX, "Color inválido").optional(),
  active: z.boolean().optional(),
});
export type RoleInput = z.infer<typeof roleInput>;

// ── Secciones ─────────────────────────────────────────────
export const sectionInput = z.object({
  nombre: z.string().trim().min(1, "El nombre de la sección es obligatorio").max(60),
  orden: z.number().int().optional(),
  active: z.boolean().optional(),
  sinAyudante: z.boolean().optional(),
  unaPorSala: z.boolean().optional(),
  soloAdmin: z.boolean().optional(),
});
export type SectionInput = z.infer<typeof sectionInput>;

// ── Usuarios autorizados ──────────────────────────────────
export const userInput = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  nombre: z.string().trim().max(80).nullish(),
});
export type UserInput = z.infer<typeof userInput>;

// ── Reuniones ─────────────────────────────────────────────
export const meetingInput = z.object({
  fecha: fechaSchema,
  nota: z.string().trim().max(120).nullish(),
});
export type MeetingInput = z.infer<typeof meetingInput>;

export const meetingBulkInput = z.object({
  fechas: z.array(fechaSchema).min(1).max(60),
  nota: z.string().trim().max(120).nullish(),
});
export type MeetingBulkInput = z.infer<typeof meetingBulkInput>;

export const meetingConfigInput = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  weeks: z.number().int().min(1).max(26),
  congregacion: z.string().trim().max(120).nullish(),
});

// Detalle de una reunión (relato/lectura de la semana).
export const meetingDetailInput = z.object({
  fecha: fechaSchema,
  relato: z.string().trim().max(160).nullish(),
});
export type MeetingConfigInput = z.infer<typeof meetingConfigInput>;

export const purgeInput = z.object({
  past: z.boolean().optional(),
  ids: z.array(z.string()).max(500).optional(),
});

// ── Personas ──────────────────────────────────────────────
export const personInput = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(80),
  genero: z.enum(["H", "M"]).nullish(),
  roleIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});
export type PersonInput = z.infer<typeof personInput>;

// ── Registros ─────────────────────────────────────────────
export const recordInput = z.object({
  // Opcional: las partes de la sección "Inicio" no tienen persona. El servidor
  // exige el asignado para las demás secciones.
  asignadoId: z.string().min(1).nullish(),
  ayudanteId: z.string().min(1).nullish(),
  fecha: fechaSchema,
  sala: z.string().trim().max(80).nullish(),
  asignacion: z.string().trim().min(1, "La asignación es obligatoria").max(500),
  tipo: z.enum(["ASIGNACION", "NOMBRADO"]).optional(),
  sectionId: z.string().min(1).nullish(),
  minutos: z.number().int().min(1).max(600).nullish(),
  cantico: z.number().int().min(1).max(999).nullish(),
});
export type RecordInput = z.infer<typeof recordInput>;

// Reordenar / cambiar de sala (planificador): lote de {id, orden, sala}.
export const arrangeInput = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        orden: z.number().int().min(0),
        sala: z.string().trim().max(80).nullish(),
      }),
    )
    .min(1)
    .max(100),
});

// ── Importación del JSON de la app vieja (v1) ─────────────
// Tolerante: acepta el export { records, persons, exportedAt }.
const legacyPerson = z.object({
  id: z.string(),
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().default(""),
  createdAt: z.number().optional(),
});

const legacyRecord = z.object({
  id: z.string().optional(),
  asignadoId: z.string().optional(),
  asignado: z.string().optional(),
  ayudanteId: z.string().optional().nullable(),
  ayudante: z.string().optional().nullable(),
  fecha: z.string().optional(),
  sala: z.string().optional().nullable(),
  asignacion: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const importInput = z.object({
  persons: z.array(legacyPerson).default([]),
  records: z.array(legacyRecord).default([]),
});
export type ImportInput = z.infer<typeof importInput>;
export type LegacyPerson = z.infer<typeof legacyPerson>;
export type LegacyRecord = z.infer<typeof legacyRecord>;
