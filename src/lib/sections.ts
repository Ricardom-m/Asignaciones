// Constantes de secciones con comportamiento especial (compartidas cliente/servidor).

export const norm = (s: string) => s.trim().toLowerCase();

export const SECCION_INICIO = "Inicio";
export const SECCION_TESOROS = "Tesoros de la Biblia";
export const SECCION_VIDA = "Nuestra vida cristiana";

// "Lectura de la Biblia": como mucho una por sala (regla por nombre, no por sección).
export const LECTURA_NOMBRE = "Lectura de la Biblia";
export const PARTE_PERLAS = "Busquemos perlas escondidas";

// Orden canónico dentro de Tesoros: discurso (0) → perlas (1) → lectura (2).
export const tesorosRank = (asignacion: string) => {
  const a = norm(asignacion);
  if (a === norm(LECTURA_NOMBRE)) return 2;
  if (a === norm(PARTE_PERLAS)) return 1;
  return 0;
};

// ── Partes fijas (Inicio y Nuestra vida cristiana) ────────
// Unas no llevan persona (Canción, Palabras de introducción) y otras llevan
// un Nombrado (Presidente, Consejero, Oración) o un Conductor/Lector (Estudio).
export const PARTE_CANCION = "Canción";
export const PARTE_PALABRAS = "Palabras de introducción";
export const PARTE_PRESIDENTE = "Presidente";
export const PARTE_CONSEJERO = "Consejero de la sala auxiliar";
export const PARTE_ORACION = "Oración";
export const PARTE_ESTUDIO = "Estudio bíblico de congregación";
export const PARTE_PALABRAS_CONCLUSION = "Palabras de conclusión";
export const PARTE_NECESIDADES = "Necesidades de la congregación";
export const PALABRAS_MIN = 1; // duración fija de "Palabras de introducción"

export interface ParteFija { value: string; minutos: number | null; orden: number; nombrado: boolean }

// Partes que se auto-generan por sección al abrir la fecha (nombre → lista con orden).
export const PARTES_FIJAS: Record<string, ParteFija[]> = {
  [SECCION_INICIO]: [
    { value: PARTE_PRESIDENTE, minutos: null, orden: 0, nombrado: true },
    { value: PARTE_CONSEJERO, minutos: null, orden: 1, nombrado: true },
    { value: PARTE_ORACION, minutos: null, orden: 2, nombrado: true },
    { value: PARTE_CANCION, minutos: null, orden: 3, nombrado: false },
    { value: PARTE_PALABRAS, minutos: PALABRAS_MIN, orden: 4, nombrado: false },
  ],
  // Nuestra vida cristiana: Canción al inicio, Oración penúltima y Canción al
  // final; en medio van las partes que agregue el usuario.
  [SECCION_VIDA]: [
    { value: PARTE_CANCION, minutos: null, orden: 0, nombrado: false },
    { value: PARTE_ORACION, minutos: null, orden: 900, nombrado: true },
    { value: PARTE_CANCION, minutos: null, orden: 1000, nombrado: false },
  ],
};

// Partes de Inicio (solo pueden existir esas 5, ver validación del servidor).
export const PARTES_INICIO = PARTES_FIJAS[SECCION_INICIO];
export const esParteInicio = (a: string) => PARTES_INICIO.some((p) => norm(p.value) === norm(a));
// Posición canónica dentro de Inicio (para el render).
export const inicioRank = (a: string) => {
  const i = PARTES_INICIO.findIndex((p) => norm(p.value) === norm(a));
  return i === -1 ? 99 : i;
};

// Partes que NO llevan persona (programa, no asignación a alguien).
export const esParteSinPersona = (a: string) => {
  const n = norm(a);
  return n === norm(PARTE_CANCION) || n === norm(PARTE_PALABRAS);
};
// Partes fijas con Nombrado en línea (Presidente/Consejero/Oración).
export const esRolNombrado = (a: string) => {
  const n = norm(a);
  return n === norm(PARTE_PRESIDENTE) || n === norm(PARTE_CONSEJERO) || n === norm(PARTE_ORACION);
};
export const esCancion = (a: string) => norm(a) === norm(PARTE_CANCION);
export const esEstudio = (a: string) => norm(a) === norm(PARTE_ESTUDIO);
export const esNecesidades = (a: string) => norm(a) === norm(PARTE_NECESIDADES);
export const esLecturaNombre = (a: string) => norm(a) === norm(LECTURA_NOMBRE);

// Orden canónico dentro de "Nuestra vida cristiana":
// Canción(inicio) → [partes del usuario] → Estudio → Palabras de conclusión → Oración → Canción(final).
export const vidaRank = (rec: { asignacion: string; orden: number }) => {
  const a = norm(rec.asignacion);
  if (esCancion(a)) return rec.orden < 500 ? 0 : 10000; // inicio vs final por su orden sembrado
  if (a === norm(PARTE_ORACION)) return 9000;
  if (a === norm(PARTE_PALABRAS_CONCLUSION)) return 8100;
  if (a === norm(PARTE_ESTUDIO)) return 8000;
  return 100 + rec.orden; // partes del usuario, en su propio orden
};

// Máximo de asignaciones (nombres distintos) en Tesoros de la Biblia.
export const TESOROS_MAX = 3;

// Sugerencias "Frecuentes" curadas por sección: aparecen aunque no haya
// registros previos, con su duración típica (editable al usarlas).
export const SUGERENCIAS_CURADAS: Record<string, { value: string; minutos: number }[]> = {
  [SECCION_TESOROS]: [{ value: PARTE_PERLAS, minutos: 10 }],
  [SECCION_VIDA]: [
    { value: PARTE_ESTUDIO, minutos: 30 },
    { value: PARTE_NECESIDADES, minutos: 15 },
  ],
};
