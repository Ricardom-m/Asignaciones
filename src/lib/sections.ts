// Constantes de secciones con comportamiento especial (compartidas cliente/servidor).

export const SECCION_INICIO = "Inicio";
export const SECCION_TESOROS = "Tesoros de la Biblia";

// "Lectura de la Biblia": como mucho una por sala (regla por nombre, no por sección).
export const LECTURA_NOMBRE = "Lectura de la Biblia";
export const PARTE_PERLAS = "Busquemos perlas escondidas";

// Orden canónico dentro de Tesoros: discurso (0) → perlas (1) → lectura (2).
export const tesorosRank = (asignacion: string) => {
  const a = asignacion.trim().toLowerCase();
  if (a === LECTURA_NOMBRE.toLowerCase()) return 2;
  if (a === PARTE_PERLAS.toLowerCase()) return 1;
  return 0;
};

// Partes fijas de la sección "Inicio" (sin persona asignada).
export const PARTE_CANCION = "Canción";
export const PARTE_PALABRAS = "Palabras de instrucción";
export const PALABRAS_MIN = 1; // duración fija de "Palabras de instrucción"

// Máximo de asignaciones (nombres distintos) en Tesoros de la Biblia.
export const TESOROS_MAX = 3;

export const norm = (s: string) => s.trim().toLowerCase();
export const esCancion = (a: string) => norm(a) === norm(PARTE_CANCION);
export const esLecturaNombre = (a: string) => norm(a) === norm(LECTURA_NOMBRE);

// Sugerencias "Frecuentes" curadas por sección: aparecen aunque no haya
// registros previos, con su duración típica (editable al usarlas).
export const SUGERENCIAS_CURADAS: Record<string, { value: string; minutos: number }[]> = {
  [SECCION_TESOROS]: [{ value: PARTE_PERLAS, minutos: 10 }],
};

