// Constantes de secciones con comportamiento especial (compartidas cliente/servidor).

export const norm = (s: string) => s.trim().toLowerCase();

export const SECCION_INICIO = "Inicio";
export const SECCION_TESOROS = "Tesoros de la Biblia";

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

// ── Sección "Inicio" ──────────────────────────────────────
// Partes fijas; unas sin persona (Canción, Palabras) y otras con un Nombrado
// (Presidente, Consejero de la sala auxiliar, Oración).
export const PARTE_CANCION = "Canción";
export const PARTE_PALABRAS = "Palabras de introducción";
export const PARTE_PRESIDENTE = "Presidente";
export const PARTE_CONSEJERO = "Consejero de la sala auxiliar";
export const PARTE_ORACION = "Oración";
export const PALABRAS_MIN = 1; // duración fija de "Palabras de introducción"

// Orden y especificación de las partes de Inicio (sirve para sembrarlas y ordenarlas).
// Solo pueden existir estas 5 partes (no más).
export const PARTES_INICIO: { value: string; minutos: number | null; nombrado: boolean }[] = [
  { value: PARTE_PRESIDENTE, minutos: null, nombrado: true },
  { value: PARTE_CONSEJERO, minutos: null, nombrado: true },
  { value: PARTE_ORACION, minutos: null, nombrado: true },
  { value: PARTE_CANCION, minutos: null, nombrado: false },
  { value: PARTE_PALABRAS, minutos: PALABRAS_MIN, nombrado: false },
];

// Partes de Inicio que NO llevan persona.
export const esParteSinPersona = (a: string) => {
  const n = norm(a);
  return n === norm(PARTE_CANCION) || n === norm(PARTE_PALABRAS);
};
// ¿Es una de las 5 partes válidas de Inicio?
export const esParteInicio = (a: string) => PARTES_INICIO.some((p) => norm(p.value) === norm(a));
// ¿Es uno de los 3 roles de Inicio que llevan Nombrado (Presidente/Consejero/Oración)?
export const esRolInicio = (a: string) => esParteInicio(a) && !esParteSinPersona(a);
// Posición canónica dentro de Inicio (para el render).
export const inicioRank = (a: string) => {
  const i = PARTES_INICIO.findIndex((p) => norm(p.value) === norm(a));
  return i === -1 ? 99 : i;
};

export const esCancion = (a: string) => norm(a) === norm(PARTE_CANCION);
export const esLecturaNombre = (a: string) => norm(a) === norm(LECTURA_NOMBRE);

// Máximo de asignaciones (nombres distintos) en Tesoros de la Biblia.
export const TESOROS_MAX = 3;

// Sugerencias "Frecuentes" curadas por sección: aparecen aunque no haya
// registros previos, con su duración típica (editable al usarlas).
export const SUGERENCIAS_CURADAS: Record<string, { value: string; minutos: number }[]> = {
  [SECCION_TESOROS]: [{ value: PARTE_PERLAS, minutos: 10 }],
};
