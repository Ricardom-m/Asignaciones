// Constantes de secciones con comportamiento especial (compartidas cliente/servidor).

export const SECCION_INICIO = "Inicio";
export const SECCION_TESOROS = "Tesoros de la Biblia";

// Partes fijas de la sección "Inicio" (sin persona asignada).
export const PARTE_CANCION = "Canción";
export const PARTE_PALABRAS = "Palabras de instrucción";
export const PALABRAS_MIN = 1; // duración fija de "Palabras de instrucción"

// Máximo de asignaciones (nombres distintos) en Tesoros de la Biblia.
export const TESOROS_MAX = 3;

export const esCancion = (a: string) => a.trim().toLowerCase() === PARTE_CANCION.toLowerCase();
export const norm = (s: string) => s.trim().toLowerCase();
