// Modelo de programa (formato oficial S-140) compartido por el Word y la vista
// previa/PDF. Toma los registros de UNA fecha y arma una estructura lista para
// renderizar: numeración continua, marcadores (•) y mapeo de salas.
//
// Reglas verificadas contra la plantilla real (S-140_S.docx) y los PDFs:
//  - Número (1..N continuo): cada parte "real" de Tesoros → Seamos → Nuestra vida
//    (discursos, perlas, lectura, partes de Seamos, Necesidades y el Estudio, que
//    lleva el último número). NO se numeran Canción, Oración ni "Palabras de…".
//  - Bullet "•": solo en Canción y "Palabras de introducción/conclusión".
//    Color por contexto: gris (#575A5D) al inicio, rojo/vino (#7E0024) en Nuestra vida.
//  - Salas: Sala B → "Sala auxiliar" (izquierda); Sala A → "Auditorio principal" (derecha).

import type { RecordItem } from "@/lib/types";
import { semanaRango } from "@/lib/client";
import {
  SECCION_INICIO,
  SECCION_TESOROS,
  SECCION_VIDA,
  PARTE_PRESIDENTE,
  PARTE_CONSEJERO,
  PARTE_ORACION,
  PARTE_PERLAS,
  norm,
  esCancion,
  esEstudio,
  esLecturaNombre,
  esParteSinPersona,
  vidaRank,
  tesorosRank,
} from "@/lib/sections";

export const SECCION_SEAMOS = "Seamos mejores maestros";

// Mapeo de salas (confirmado): Sala A = Auditorio principal; Sala B = Sala auxiliar.
const SALA_PRIN = "Sala A"; // Auditorio principal (columna derecha)
const SALA_AUX = "Sala B"; // Sala auxiliar (columna izquierda)

export interface SeamosPart {
  numero: number;
  titulo: string;
  minutos: number | null;
  aux: { est: string | null; ay: string | null }; // Sala auxiliar (izquierda)
  prin: { est: string | null; ay: string | null }; // Auditorio principal (derecha)
}

export interface VidaDiscurso {
  numero: number;
  titulo: string;
  minutos: number | null;
  nombre: string | null;
}

export interface ProgramWeek {
  fecha: string; // YYYY-MM-DD
  congregacion: string; // MAYÚSCULAS
  semana: string; // "1-7 DE JUNIO"
  relato: string; // "JEREMÍAS 1-3" (MAYÚSCULAS) o ""
  // Encabezado / Inicio
  presidente: string | null;
  consejero: string | null;
  nota: string | null; // p. ej. "Visita Superintendente" (Meeting.nota)
  oracionInicio: string | null;
  cancionInicio: number | null;
  // Tesoros de la Biblia
  tesoros: {
    discurso: { numero: number; titulo: string; minutos: number | null; nombre: string | null } | null;
    perlas: { numero: number; minutos: number | null; nombre: string | null } | null;
    lectura: { numero: number; minutos: number | null; aux: string | null; prin: string | null } | null;
  };
  // Seamos mejores maestros
  seamos: SeamosPart[];
  // Nuestra vida cristiana
  vida: {
    cancion: number | null;
    discursos: VidaDiscurso[]; // discursos + Necesidades (numerados)
    estudio: { numero: number; minutos: number | null; conductor: string | null; lector: string | null } | null;
    cancionFinal: number | null;
    oracionFinal: string | null;
  };
}

const cap = (s: string) => s.toLocaleUpperCase("es-MX");
const nombreAsignado = (r?: RecordItem | null) => (r && r.asignadoId ? r.asignado : null);
const nombreAyudante = (r?: RecordItem | null) => r?.ayudante ?? null;

export function buildProgram(
  fecha: string,
  records: RecordItem[],
  relato: string | null,
  nota: string | null,
  congregacion: string | null,
): ProgramWeek {
  const inSection = (name: string) => records.filter((r) => r.section && norm(r.section) === norm(name));
  const findByAsig = (recs: RecordItem[], name: string) => recs.find((r) => norm(r.asignacion) === norm(name));

  const inicio = inSection(SECCION_INICIO);
  const tesorosRecs = inSection(SECCION_TESOROS);
  const seamosRecs = inSection(SECCION_SEAMOS);
  const vidaRecs = inSection(SECCION_VIDA);

  // Contador continuo para la numeración.
  let n = 0;
  const next = () => ++n;

  // ── Inicio ──────────────────────────────────────────────
  const presidente = nombreAsignado(findByAsig(inicio, PARTE_PRESIDENTE));
  const consejero = nombreAsignado(findByAsig(inicio, PARTE_CONSEJERO));
  const oracionInicio = nombreAsignado(findByAsig(inicio, PARTE_ORACION));
  const cancionInicio = inicio.find((r) => esCancion(r.asignacion))?.cantico ?? null;

  // ── Tesoros de la Biblia ────────────────────────────────
  const discursoRec = tesorosRecs.find((r) => tesorosRank(r.asignacion) === 0);
  const perlasRec = tesorosRecs.find((r) => norm(r.asignacion) === norm(PARTE_PERLAS));
  const lecturaRecs = tesorosRecs.filter((r) => esLecturaNombre(r.asignacion));
  const lecturaAux = lecturaRecs.find((r) => r.sala === SALA_AUX);
  const lecturaPrin = lecturaRecs.find((r) => r.sala === SALA_PRIN) ?? lecturaRecs.find((r) => r.sala !== SALA_AUX);

  const discurso = discursoRec
    ? { numero: next(), titulo: discursoRec.asignacion, minutos: discursoRec.minutos, nombre: nombreAsignado(discursoRec) }
    : null;
  const perlas = perlasRec ? { numero: next(), minutos: perlasRec.minutos, nombre: nombreAsignado(perlasRec) } : null;
  const lectura = lecturaRecs.length
    ? {
        numero: next(),
        minutos: (lecturaPrin ?? lecturaAux ?? lecturaRecs[0]).minutos,
        aux: nombreAsignado(lecturaAux),
        prin: nombreAsignado(lecturaPrin),
      }
    : null;

  // ── Seamos mejores maestros (agrupado por orden, una fila por parte) ──
  const seamosByOrden = new Map<number, RecordItem[]>();
  for (const r of seamosRecs) {
    const arr = seamosByOrden.get(r.orden) ?? [];
    arr.push(r);
    seamosByOrden.set(r.orden, arr);
  }
  const seamos: SeamosPart[] = [...seamosByOrden.keys()]
    .sort((a, b) => a - b)
    .map((orden) => {
      const grp = seamosByOrden.get(orden)!;
      const aux = grp.find((r) => r.sala === SALA_AUX);
      const prin = grp.find((r) => r.sala === SALA_PRIN) ?? grp.find((r) => r.sala !== SALA_AUX);
      const any = prin ?? aux ?? grp[0];
      return {
        numero: next(),
        titulo: any.asignacion,
        minutos: any.minutos,
        aux: { est: nombreAsignado(aux), ay: nombreAyudante(aux) },
        prin: { est: nombreAsignado(prin), ay: nombreAyudante(prin) },
      };
    });

  // ── Nuestra vida cristiana ──────────────────────────────
  const cancionesVida = vidaRecs.filter((r) => esCancion(r.asignacion)).sort((a, b) => a.orden - b.orden);
  const cancion = cancionesVida[0]?.cantico ?? null;
  const cancionFinal = cancionesVida.length > 1 ? cancionesVida[cancionesVida.length - 1].cantico ?? null : null;
  const oracionFinal = nombreAsignado(findByAsig(vidaRecs, PARTE_ORACION));
  const estudioRec = vidaRecs.find((r) => esEstudio(r.asignacion));

  // Discursos del medio (incluye "Necesidades"): todo lo que no sea canción,
  // oración, estudio ni "Palabras de…". Se ordenan con vidaRank.
  const middle = vidaRecs
    .filter(
      (r) =>
        !esCancion(r.asignacion) &&
        !esEstudio(r.asignacion) &&
        norm(r.asignacion) !== norm(PARTE_ORACION) &&
        !esParteSinPersona(r.asignacion),
    )
    .sort((a, b) => vidaRank(a) - vidaRank(b));
  const discursos: VidaDiscurso[] = middle.map((r) => ({
    numero: next(),
    titulo: r.asignacion,
    minutos: r.minutos,
    nombre: nombreAsignado(r),
  }));
  // El Estudio bíblico siempre lleva el ÚLTIMO número.
  const estudio = estudioRec
    ? { numero: next(), minutos: estudioRec.minutos, conductor: nombreAsignado(estudioRec), lector: nombreAyudante(estudioRec) }
    : null;

  return {
    fecha,
    congregacion: congregacion ? cap(congregacion) : "",
    semana: cap(semanaRango(fecha)),
    relato: relato ? cap(relato) : "",
    presidente,
    consejero,
    nota: nota?.trim() || null,
    oracionInicio,
    cancionInicio,
    tesoros: { discurso, perlas, lectura },
    seamos,
    vida: { cancion, discursos, estudio, cancionFinal, oracionFinal },
  };
}

// Texto del Consejero combinando la nota: "N/A | Visita Superintendente".
export function consejeroTexto(w: ProgramWeek): string {
  const base = w.consejero ?? "N/A";
  return w.nota ? `${base} | ${w.nota}` : base;
}

// Duración formateada como en la plantilla: "(10 mins.)" / "(1 min.)".
export function minsLabel(min: number | null): string {
  if (min == null) return "";
  return `(${min} ${min === 1 ? "min." : "mins."})`;
}
