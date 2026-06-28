// Generador del Word (.docx) replicando EXACTAMENTE la plantilla oficial S-140.
// Estilos extraídos del XML real (S-140_S.docx):
//  - Página Carta; fuente de cuerpo Calibri, título Cambria (16.5pt negrita).
//  - Bordes: SOLO línea inferior por fila (thinThickSmallGap, gris 575A5D); sin rejilla.
//  - Gris 575A5D negrita: etiquetas (Presidente/Consejero/Oración, Sala auxiliar/
//    Auditorio principal, Estudiante/Ayudante, Conductor/Lector, "0:00") y las
//    partes fijas pre-impresas (Canción, Palabras, Busquemos perlas) — estas con
//    el color de su sección (gris al inicio, vino en Nuestra vida).
//  - Negro 10pt sin negrita: discursos, Lectura, partes de Seamos, Estudio,
//    Necesidades, nombres, minutos y números.
// Solo se usa en el servidor (ruta /api/export). Devuelve un Buffer.

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { ProgramWeek } from "@/lib/export/program";
import { consejeroTexto, minsLabel } from "@/lib/export/program";

// ── Colores (verificados contra la plantilla) ─────────────
const GRIS = "575A5D"; // Tesoros + etiquetas + bullets del inicio
const DORADO = "BE8900"; // Seamos mejores maestros
const VINO = "7E0024"; // Nuestra vida cristiana + sus bullets/partes fijas
const WHITE = "FFFFFF";

const BODY = "Calibri";
const TITLE_FONT = "Cambria";

// ── Anchos de columna (twips, de w:tblGrid de la plantilla) ──
const W_HORA = 617;
const W_TITULO = 3108;
const W_LABEL = 1456;
const W_AUX = 2340;
const W_PRIN = 2443;
const W_TOTAL = W_HORA + W_TITULO + W_LABEL + W_AUX + W_PRIN; // 9964

// ── Bordes: solo línea inferior gris (como la plantilla) ──
const NIL = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const LINEA = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 18, color: GRIS } as const;
const rowBorders = { top: NIL, bottom: LINEA, left: NIL, right: NIL };
const noBorders = { top: NIL, bottom: NIL, left: NIL, right: NIL };

// ── Runs por tipo de texto ────────────────────────────────
const gris = (text: string, size = 16) => new TextRun({ text, bold: true, color: GRIS, size, font: BODY });
const negro = (text: string, size = 20) => new TextRun({ text, size, font: BODY });
const blanco = (text: string) => new TextRun({ text, bold: true, color: WHITE, size: 20, font: BODY });
const acento = (text: string, color: string, size = 18) => new TextRun({ text, bold: true, color, size, font: BODY });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
  new Paragraph({ children, alignment: align, spacing: { before: 8, after: 8, line: 240 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: "top" | "center" | "bottom";
  borders?: boolean; // false = sin bordes (encabezado de semana)
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.CENTER,
    borders: o.borders === false ? noBorders : rowBorders,
    margins: { top: 14, bottom: 14, left: 60, right: 60 },
  });

const HORA = () => cell([gris("0:00", 18)], { align: AlignmentType.LEFT });

const slot = (s: { est: string | null; ay: string | null }): string => {
  if (s.est && s.ay) return `${s.est} / ${s.ay}`;
  return s.est ?? s.ay ?? "";
};

// Fila de encabezado de sección: título con relleno de color (blanco) + las dos
// etiquetas de sala (gris, alineadas abajo).
function sectionHeaderRow(titulo: string, fill: string): TableRow {
  return new TableRow({
    children: [
      cell([blanco(titulo)], { span: 3, fill, valign: VerticalAlign.CENTER }),
      cell([gris("Sala auxiliar")], { valign: VerticalAlign.BOTTOM, align: AlignmentType.CENTER }),
      cell([gris("Auditorio principal")], { valign: VerticalAlign.BOTTOM, align: AlignmentType.CENTER }),
    ],
  });
}

// Fila "sin persona" (Canción / Palabras): el ítem va con el color de su sección
// (gris al inicio, vino en Nuestra vida). Opcionalmente "Oración: nombre" a la derecha.
function bulletRow(
  titulo: string,
  color: string,
  opts: { minutos?: number | null; oracion?: string | null } = {},
): TableRow {
  const runs = [acento("• ", color), acento(titulo, color)];
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(acento(`  ${m}`, color));
  if (opts.oracion !== undefined) {
    return new TableRow({
      children: [
        HORA(),
        cell(runs, { span: 2 }),
        cell(opts.oracion ? [gris("Oración: "), gris(opts.oracion)] : [gris("Oración:")], { span: 2 }),
      ],
    });
  }
  return new TableRow({ children: [HORA(), cell(runs, { span: 4 })] });
}

// Runs para una parte numerada: "N. " (negro) + título + "(X mins.)" (negro).
// `titColor` define si el título va en color/negrita (partes fijas) o negro normal.
function tituloRuns(numero: number, titulo: string, minutos: number | null, titColor?: string): TextRun[] {
  const runs: TextRun[] = [negro(`${numero}. `)];
  runs.push(titColor ? acento(titulo, titColor) : negro(titulo));
  const m = minsLabel(minutos);
  if (m) runs.push(negro(`  ${m}`));
  return runs;
}

// Parte numerada con UN solo responsable (discurso, perlas, discurso de Vida):
// el nombre va en "Auditorio principal" (derecha).
function singleRow(numero: number, titulo: string, minutos: number | null, nombre: string | null, titColor?: string): TableRow {
  return new TableRow({
    children: [
      HORA(),
      cell(tituloRuns(numero, titulo, minutos, titColor), { span: 2 }),
      cell([negro("")]),
      cell(nombre ? [negro(nombre)] : [negro("")]),
    ],
  });
}

// Parte numerada con etiqueta de rol y dos salas (Lectura, Seamos).
function dualRow(
  numero: number,
  titulo: string,
  minutos: number | null,
  label: string,
  aux: string | null,
  prin: string | null,
): TableRow {
  return new TableRow({
    children: [
      HORA(),
      cell(tituloRuns(numero, titulo, minutos)),
      cell([gris(label)], { valign: VerticalAlign.CENTER }),
      cell(aux ? [negro(aux)] : [negro("")]),
      cell(prin ? [negro(prin)] : [negro("")]),
    ],
  });
}

// Encabezado de la semana (congregación, título, semana|relato, presidente,
// consejero) como tabla sin bordes de 2 columnas.
function weekHeader(w: ProgramWeek): Table {
  const mk = (left: TextRun[], right: TextRun[]) =>
    new TableRow({
      children: [cell(left, { borders: false }), cell(right, { borders: false, align: AlignmentType.LEFT })],
    });
  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: [4982, 4982],
    layout: TableLayoutType.FIXED,
    borders: { top: NIL, bottom: NIL, left: NIL, right: NIL, insideHorizontal: NIL, insideVertical: NIL },
    rows: [
      mk(
        [new TextRun({ text: w.congregacion, bold: true, size: 24, font: BODY })],
        [new TextRun({ text: "Programa para la reunión de entre semana", bold: true, size: 33, font: TITLE_FONT })],
      ),
      mk(
        [new TextRun({ text: `${w.semana}${w.relato ? ` | ${w.relato}` : ""}`, bold: true, size: 22, font: BODY })],
        [gris("Presidente: "), gris(w.presidente ?? "")],
      ),
      mk([negro("", 22)], [gris("Consejero de la sala auxiliar: "), gris(consejeroTexto(w))]),
    ],
  });
}

// Cuerpo de la semana (las 3 secciones) como tabla de 5 columnas.
function weekBody(w: ProgramWeek): Table {
  const rows: TableRow[] = [];

  // Apertura (gris): Canción + Oración inicial, Palabras de introducción.
  rows.push(bulletRow(`Canción ${w.cancionInicio ?? ""}`.trim(), GRIS, { oracion: w.oracionInicio }));
  rows.push(bulletRow("Palabras de introducción", GRIS, { minutos: 1 }));

  // TESOROS DE LA BIBLIA
  rows.push(sectionHeaderRow("TESOROS DE LA BIBLIA", GRIS));
  if (w.tesoros.discurso)
    rows.push(singleRow(w.tesoros.discurso.numero, w.tesoros.discurso.titulo, w.tesoros.discurso.minutos, w.tesoros.discurso.nombre));
  if (w.tesoros.perlas)
    rows.push(singleRow(w.tesoros.perlas.numero, "Busquemos perlas escondidas", w.tesoros.perlas.minutos, w.tesoros.perlas.nombre, GRIS));
  if (w.tesoros.lectura)
    rows.push(dualRow(w.tesoros.lectura.numero, "Lectura de la Biblia", w.tesoros.lectura.minutos, "Estudiante:", w.tesoros.lectura.aux, w.tesoros.lectura.prin));

  // SEAMOS MEJORES MAESTROS
  rows.push(sectionHeaderRow("SEAMOS MEJORES MAESTROS", DORADO));
  for (const p of w.seamos) rows.push(dualRow(p.numero, p.titulo, p.minutos, "Estudiante/Ayudante:", slot(p.aux), slot(p.prin)));

  // NUESTRA VIDA CRISTIANA
  rows.push(sectionHeaderRow("NUESTRA VIDA CRISTIANA", VINO));
  rows.push(bulletRow(`Canción ${w.vida.cancion ?? ""}`.trim(), VINO));
  for (const d of w.vida.discursos) rows.push(singleRow(d.numero, d.titulo, d.minutos, d.nombre));
  if (w.vida.estudio) {
    const condLect = [w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ");
    rows.push(
      new TableRow({
        children: [
          HORA(),
          cell(tituloRuns(w.vida.estudio.numero, "Estudio bíblico de la congregación", w.vida.estudio.minutos)),
          cell([gris("Conductor/Lector:")]),
          cell(condLect ? [negro(condLect)] : [negro("")], { span: 2 }),
        ],
      }),
    );
  }
  rows.push(bulletRow("Palabras de conclusión", VINO, { minutos: 3 }));
  rows.push(bulletRow(`Canción ${w.vida.cancionFinal ?? ""}`.trim(), VINO, { oracion: w.vida.oracionFinal }));

  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: [W_HORA, W_TITULO, W_LABEL, W_AUX, W_PRIN],
    layout: TableLayoutType.FIXED,
    borders: { top: NIL, bottom: NIL, left: NIL, right: NIL, insideHorizontal: NIL, insideVertical: NIL },
    rows,
  });
}

export async function buildDocx(weeks: ProgramWeek[]): Promise<Buffer> {
  const children: (Table | Paragraph)[] = [];
  weeks.forEach((w, i) => {
    if (i > 0) children.push(new Paragraph({ children: [], pageBreakBefore: true }));
    children.push(weekHeader(w));
    children.push(new Paragraph({ children: [], spacing: { after: 30 } }));
    children.push(weekBody(w));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY, size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1009, right: 1140, bottom: 720, left: 1140 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
