// Numeración de las partes del programa (formato S-140), compartida por el
// planificador y el export para que nunca digan cosas distintas.
//
// Reglas (confirmadas con el usuario):
//  - Tesoros ocupa SLOTS FIJOS: 1 = discurso, 2 = perlas, 3 = Lectura de la Biblia.
//    Los huecos se reservan aunque esas partes aún no se hayan agregado, porque la
//    Lectura siempre es la 3 en el programa oficial.
//  - "Seamos mejores maestros" arranca en 4 y crece según cuántas partes haya
//    (3, 4, 5…). Sala A y Sala B corren el mismo programa en paralelo, así que la
//    parte k-ésima de cada sala comparte número con la k-ésima de las demás.
//    El emparejamiento es POSICIONAL a propósito: no vale por nombre (puede haber
//    dos "Empiece conversaciones" en la misma sala) ni por `orden`, que es la
//    posición dentro de fecha+sección+SALA y por tanto cada sala lleva la suya.
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
  /**
   * id → identidad de la parte ("qué parte es", no "qué registro es"). Las dos
   * salas de una misma parte comparten slot. Es lo que hay que usar para aplicar
   * un cambio a la parte entera: agrupar por `orden` no vale, porque cada sala
   * lleva su propia secuencia.
   */
  slotPorId: Map<string, string>;
}

// Numera una sección que puede correr en paralelo en varias salas: dentro de cada
// sala las partes se ordenan con `cmp` y la posición k recibe `base + k`, de modo
// que las partes k-ésimas de Sala A y Sala B acaban con el mismo número.
// Devuelve cuántos números ha consumido (el máximo de partes de una sala).
function numerarEnParalelo(
  recs: RecordItem[],
  base: number,
  cmp: (a: RecordItem, b: RecordItem) => number,
  porId: Map<string, number>,
  slot: Map<string, string>,
  seccion: string,
): number {
  const porSala = new Map<string, RecordItem[]>();
  for (const r of recs) {
    const k = r.sala ?? "";
    porSala.set(k, [...(porSala.get(k) ?? []), r]);
  }
  let usados = 0;
  for (const grupo of porSala.values()) {
    grupo.sort(cmp);
    grupo.forEach((r, i) => {
      porId.set(r.id, base + i);
      slot.set(r.id, `${seccion}|${i}`); // misma posición en distinta sala = misma parte
    });
    usados = Math.max(usados, grupo.length);
  }
  return usados;
}

// `records` son los registros de UNA fecha (los de otras se ignoran).
export function numerar(records: RecordItem[]): Numeracion {
  const porId = new Map<string, number>();
  const slot = new Map<string, string>(); // id → "qué parte es", para detectar choques
  const deSeccion = (nombre: string) =>
    records.filter((r) => norm(r.section ?? "") === norm(nombre) && llevaNumero(r));

  // ── Tesoros: slots fijos 1/2/3 por el TIPO de parte, no por su posición ──
  for (const r of deSeccion(SECCION_TESOROS)) {
    const rank = tesorosRank(r.asignacion);
    porId.set(r.id, rank + 1);
    slot.set(r.id, `${SECCION_TESOROS}|${rank}`);
  }

  // ── Seamos: la parte k de cada sala comparte número ──
  const usados = numerarEnParalelo(
    deSeccion(SECCION_MAESTROS),
    PRIMER_NUMERO_SEAMOS,
    (a, b) => a.orden - b.orden,
    porId,
    slot,
    SECCION_MAESTROS,
  );

  // ── Nuestra vida: continúa donde acabó Seamos ──
  numerarEnParalelo(
    deSeccion(SECCION_VIDA),
    PRIMER_NUMERO_SEAMOS + usados,
    (a, b) => vidaRank(a) - vidaRank(b),
    porId,
    slot,
    SECCION_VIDA,
  );

  // ── El número fijado a mano manda sobre lo derivado ──
  for (const r of records) if (r.numero != null && llevaNumero(r)) porId.set(r.id, r.numero);

  // Un mismo número en dos partes DISTINTAS (dos salas de la MISMA parte comparten
  // slot y no cuentan) casi siempre viene de un número puesto a mano.
  const porNumero = new Map<number, Set<string>>();
  for (const r of records) {
    const n = porId.get(r.id);
    const k = slot.get(r.id);
    if (n == null || k == null) continue;
    porNumero.set(n, (porNumero.get(n) ?? new Set()).add(k));
  }
  const duplicados = new Set([...porNumero].filter(([, s]) => s.size > 1).map(([n]) => n));

  return { porId, duplicados, slotPorId: slot };
}
