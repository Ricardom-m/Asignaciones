// Numeración de las partes del programa (formato S-140), compartida por el
// planificador y el export para que nunca digan cosas distintas.
//
// Reglas (confirmadas con el usuario):
//  - Tesoros ocupa SLOTS FIJOS: 1 = discurso, 2 = perlas, 3 = Lectura de la Biblia.
//    Los huecos se reservan aunque esas partes aún no se hayan agregado, porque la
//    Lectura siempre es la 3 en el programa oficial.
//  - "Seamos mejores maestros" arranca en 4 y crece según cuántas partes haya
//    (3, 4, 5…). Sala A y Sala B de una misma parte comparten número: se agrupan
//    por `orden`, que es lo que mueve el drag-and-drop.
//  - "Nuestra vida cristiana" sigue la cuenta donde la dejó Seamos.
//  - NO se numeran las partes fijas: Canción, Oración, Palabras de introducción y
//    de conclusión, Presidente y Consejero. Tampoco nada de la sección Inicio.
//  - `numero` en el registro es un valor FIJADO A MANO y manda sobre lo derivado.

import type { RecordItem } from "@/lib/types";
import {
  SECCION_INICIO,
  SECCION_MAESTROS,
  SECCION_TESOROS,
  SECCION_VIDA,
  esParteSinPersona,
  esRolNombrado,
  norm,
  tesorosRank,
  vidaRank,
} from "@/lib/sections";

export const PRIMER_NUMERO_SEAMOS = 4; // Tesoros reserva 1, 2 y 3

// Las partes fijas del programa no llevan número en el S-140.
export const llevaNumero = (r: RecordItem): boolean => {
  const sec = norm(r.section ?? "");
  if (sec === norm(SECCION_INICIO)) return false;
  return !esParteSinPersona(r.asignacion) && !esRolNombrado(r.asignacion);
};

export interface Numeracion {
  /** id del registro → número que le toca (derivado, o el fijado a mano). */
  porId: Map<string, number>;
  /** números usados por más de una parte distinta: señal de numeración rota. */
  duplicados: Set<number>;
}

// `records` son los registros de UNA fecha (los de otras se ignoran).
export function numerar(records: RecordItem[]): Numeracion {
  const porId = new Map<string, number>();
  const deSeccion = (nombre: string) =>
    records.filter((r) => norm(r.section ?? "") === norm(nombre) && llevaNumero(r));

  // ── Tesoros: slots fijos 1/2/3 por el tipo de parte, no por su posición ──
  for (const r of deSeccion(SECCION_TESOROS)) porId.set(r.id, tesorosRank(r.asignacion) + 1);

  // ── Seamos: un número por `orden`, compartido entre salas ──
  const seamos = deSeccion(SECCION_MAESTROS);
  const ordenes = [...new Set(seamos.map((r) => r.orden))].sort((a, b) => a - b);
  ordenes.forEach((orden, i) => {
    const n = PRIMER_NUMERO_SEAMOS + i;
    for (const r of seamos) if (r.orden === orden) porId.set(r.id, n);
  });

  // ── Nuestra vida: continúa donde acabó Seamos ──
  let siguiente = PRIMER_NUMERO_SEAMOS + ordenes.length;
  const vida = deSeccion(SECCION_VIDA).sort((a, b) => vidaRank(a) - vidaRank(b));
  // Las partes de Nuestra vida también pueden ir en dos salas; se agrupan igual.
  const vistos = new Map<number, number>(); // orden → número ya asignado
  for (const r of vida) {
    const ya = vistos.get(r.orden);
    if (ya != null) {
      porId.set(r.id, ya);
      continue;
    }
    vistos.set(r.orden, siguiente);
    porId.set(r.id, siguiente);
    siguiente++;
  }

  // ── El número fijado a mano manda sobre lo derivado ──
  for (const r of records) if (r.numero != null && llevaNumero(r)) porId.set(r.id, r.numero);

  // Un mismo número en dos partes DISTINTAS (no dos salas de la misma) es un error
  // que conviene enseñar: casi siempre viene de un número puesto a mano.
  const porNumero = new Map<number, Set<string>>();
  for (const r of records) {
    const n = porId.get(r.id);
    if (n == null) continue;
    const clave = `${norm(r.section ?? "")}|${r.orden}`;
    porNumero.set(n, (porNumero.get(n) ?? new Set()).add(clave));
  }
  const duplicados = new Set([...porNumero].filter(([, s]) => s.size > 1).map(([n]) => n));

  return { porId, duplicados };
}
