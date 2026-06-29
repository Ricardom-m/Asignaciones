// Generador del Word (.docx) replicando el formato oficial S-140 con anchos
// MEDIDOS (render Chrome, mismas fuentes que Word):
//  - Encabezado en tabla propia [3124, 4397, 2443]: el título Cambria 16.5pt cabe
//    en una línea (col2+col3 = 6840 ≈ 4.75") y la columna de VALOR (2443, la última)
//    alinea con "Auditorio principal" del cuerpo (también la última, 2443).
//  - Cuerpo [617, 2952, 1475, 2477, 2443]: barra = col1+2+3 = 5044; el título de
//    asignación cabe (2952 ≈ 2.05") y la etiqueta de rol (col3) a 7.5pt no se corta.
//  - Etiquetas en gris 575A5D NEGRITA; cuerpo negro normal; bullet de color; regla
//    fina; las semanas fluyen (sin salto de página); pie "S-140-S  11/23".
// Solo se usa en el servidor (ruta /api/export). Devuelve un Buffer.

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
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

const GRIS = "575A5D";
const DORADO = "BE8900";
const VINO = "7E0024";
const WHITE = "FFFFFF";
const BODY = "Calibri";
const TITLE_FONT = "Cambria";

const HEAD_COLS = [3124, 4397, 2443]; // valor (col3=2443) alinea con cuerpo col5
const BODY_COLS = [617, 2952, 1475, 2477, 2443]; // barra = col1+2+3 = 5044
const W_TOTAL = 9964;
const SZ_ROL = 14; // etiqueta de rol del cuerpo (Estudiante/Ayudante): 7pt para que NO se corte el ":"

const NIL = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const noBorders = { top: NIL, bottom: NIL, left: NIL, right: NIL };
const tableBorders = { ...noBorders, insideHorizontal: NIL, insideVertical: NIL };
// Regla bajo el encabezado: gris OSCURO 575A5D (como el oficial), sz18 → se ve marcada.
const HEADER_RULE = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 18, color: GRIS } as const;

type VAlign = "top" | "center" | "bottom";
const gris = (text: string, size = 16) => new TextRun({ text, color: GRIS, size, bold: true, font: BODY });
const negro = (text: string, size = 22, italics = false) => new TextRun({ text, size, italics, font: BODY });
const neg = (text: string, size: number) => new TextRun({ text, bold: true, size, font: BODY });
const blanco = (text: string) => new TextRun({ text, bold: true, color: WHITE, size: 20, font: BODY });
const bullet = (color: string) => new TextRun({ text: "•  ", color, size: 22, bold: true, font: BODY });
const titulo = () => new TextRun({ text: "Programa para la reunión de entre semana", bold: true, size: 33, font: TITLE_FONT, characterSpacing: -4 });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType], before = 0) =>
  new Paragraph({ children, alignment: align, spacing: { before, after: 0, line: 240 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: VAlign;
  rule?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  padTop?: number; // baja la línea base (etiquetas chicas alineadas con nombres de 11pt)
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align, o.padTop ?? 0)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    borders: o.rule ? { ...noBorders, bottom: HEADER_RULE } : noBorders,
    margins: { top: 0, bottom: 0, left: 40, right: 40 },
  });

const contentRow = (children: TableCell[]) => new TableRow({ height: { value: 288, rule: HeightRule.ATLEAST }, children });
const spacer = (h: number, span = 5) =>
  new TableRow({
    height: { value: h, rule: HeightRule.EXACT },
    children: [new TableCell({ children: [new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 80 } })], columnSpan: span, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } })],
  });
const gapPara = (after: number) => new Paragraph({ children: [new TextRun({ text: "", size: 2, font: BODY })], spacing: { before: 0, after, line: 40, lineRule: "exact" } });

const HORA = () => cell([gris("0:00", 18)], { align: AlignmentType.LEFT, padTop: 30 });
const slot = (s: { est: string | null; ay: string | null }): string => (s.est && s.ay ? `${s.est} / ${s.ay}` : s.est ?? s.ay ?? "");

// Barra de sección con etiquetas de sala (Tesoros, Seamos).
function sectionHeaderRow(t: string, fill: string): TableRow {
  return contentRow([
    cell([blanco(t)], { span: 3, fill, valign: VerticalAlign.CENTER }),
    cell([gris("Sala auxiliar", 18)], { valign: VerticalAlign.BOTTOM }),
    cell([gris("Auditorio principal", 18)], { valign: VerticalAlign.BOTTOM }),
  ]);
}
// Barra a todo el ancho, sin etiquetas de sala (Nuestra vida cristiana no se divide).
function fullBarRow(t: string, fill: string): TableRow {
  return contentRow([cell([blanco(t)], { span: 5, fill, valign: VerticalAlign.CENTER })]);
}

function bulletRow(t: string, color: string, opts: { minutos?: number | null; oracion?: string | null } = {}): TableRow {
  const runs: TextRun[] = [bullet(color), negro(t)];
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(negro(` ${m}`));
  if (opts.oracion !== undefined) {
    return contentRow([HORA(), cell(runs, { span: 2 }), cell([gris("Oración:")], { align: AlignmentType.RIGHT, padTop: 45 }), cell(opts.oracion ? [negro(opts.oracion)] : [negro("")])]);
  }
  return contentRow([HORA(), cell(runs, { span: 4 })]);
}

function tituloRuns(numero: number, t: string, minutos: number | null): TextRun[] {
  const runs: TextRun[] = [negro(`${numero}. ${t}`)];
  const m = minsLabel(minutos);
  if (m) runs.push(negro(` ${m}`));
  return runs;
}

function singleRow(numero: number, t: string, minutos: number | null, nombre: string | null): TableRow {
  return contentRow([HORA(), cell(tituloRuns(numero, t, minutos), { span: 3 }), cell(nombre ? [negro(nombre)] : [negro("")])]);
}

function dualRow(numero: number, t: string, minutos: number | null, label: string, aux: string | null, prin: string | null): TableRow {
  return contentRow([
    HORA(),
    cell(tituloRuns(numero, t, minutos)),
    cell([gris(label, SZ_ROL)], { align: AlignmentType.RIGHT, padTop: 60 }),
    cell(aux ? [negro(aux)] : [negro("")]),
    cell(prin ? [negro(prin)] : [negro("")]),
  ]);
}

// Encabezado (tabla propia): la columna de valor (col3) alinea con Auditorio principal.
function headerTable(w: ProgramWeek): Table {
  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: HEAD_COLS,
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: [
      contentRow([
        cell([neg(w.congregacion, 22)], { rule: true, valign: VerticalAlign.BOTTOM }),
        cell([titulo()], { span: 2, rule: true, align: AlignmentType.RIGHT, valign: VerticalAlign.BOTTOM }),
      ]),
      spacer(144, 3),
      contentRow([
        cell([neg(`${w.semana}${w.relato ? ` | ${w.relato}` : ""}`, 22)], { valign: VerticalAlign.BOTTOM }),
        cell([gris("Presidente:")], { align: AlignmentType.RIGHT, padTop: 45 }),
        cell([negro(w.presidente ?? "")]),
      ]),
      contentRow([
        cell([negro("")]),
        cell([gris("Consejero de la sala auxiliar:")], { align: AlignmentType.RIGHT, padTop: 45 }),
        cell([negro(consejeroTexto(w), 22, !!w.nota)]),
      ]),
    ],
  });
}

function bodyTable(w: ProgramWeek): Table {
  const rows: TableRow[] = [];
  rows.push(bulletRow(`Canción ${w.cancionInicio ?? ""}`.trim(), GRIS, { oracion: w.oracionInicio }));
  rows.push(bulletRow("Palabras de introducción", GRIS, { minutos: 1 }));

  rows.push(spacer(126));
  rows.push(sectionHeaderRow("TESOROS DE LA BIBLIA", GRIS));
  if (w.tesoros.discurso) rows.push(singleRow(w.tesoros.discurso.numero, w.tesoros.discurso.titulo, w.tesoros.discurso.minutos, w.tesoros.discurso.nombre));
  if (w.tesoros.perlas) rows.push(singleRow(w.tesoros.perlas.numero, "Busquemos perlas escondidas", w.tesoros.perlas.minutos, w.tesoros.perlas.nombre));
  if (w.tesoros.lectura) rows.push(dualRow(w.tesoros.lectura.numero, "Lectura de la Biblia", w.tesoros.lectura.minutos, "Estudiante:", w.tesoros.lectura.aux, w.tesoros.lectura.prin));

  rows.push(spacer(126));
  rows.push(sectionHeaderRow("SEAMOS MEJORES MAESTROS", DORADO));
  for (const p of w.seamos) rows.push(dualRow(p.numero, p.titulo, p.minutos, "Estudiante/Ayudante:", slot(p.aux), slot(p.prin)));

  rows.push(spacer(126));
  rows.push(fullBarRow("NUESTRA VIDA CRISTIANA", VINO));
  rows.push(bulletRow(`Canción ${w.vida.cancion ?? ""}`.trim(), VINO));
  for (const d of w.vida.discursos) rows.push(singleRow(d.numero, d.titulo, d.minutos, d.nombre));
  if (w.vida.estudio) {
    const cl = [w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ");
    rows.push(contentRow([HORA(), cell(tituloRuns(w.vida.estudio.numero, "Estudio bíblico de la congregación", w.vida.estudio.minutos), { span: 2 }), cell([gris("Conductor/Lector:")], { align: AlignmentType.RIGHT, padTop: 45 }), cell(cl ? [negro(cl)] : [negro("")])]));
  }
  rows.push(bulletRow("Palabras de conclusión", VINO, { minutos: 3 }));
  rows.push(bulletRow(`Canción ${w.vida.cancionFinal ?? ""}`.trim(), VINO, { oracion: w.vida.oracionFinal }));

  return new Table({ width: { size: W_TOTAL, type: WidthType.DXA }, columnWidths: BODY_COLS, layout: TableLayoutType.FIXED, borders: tableBorders, rows });
}

export async function buildDocx(weeks: ProgramWeek[]): Promise<Buffer> {
  const children: (Table | Paragraph)[] = [];
  weeks.forEach((w, i) => {
    if (i > 0) children.push(gapPara(300)); // las semanas fluyen (sin salto de página)
    children.push(headerTable(w));
    children.push(gapPara(120)); // espacio encabezado → 1ª línea (separa las tablas)
    children.push(bodyTable(w));
  });

  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "S-140-S  11/23", size: 20, font: BODY })] })] });

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1009, right: 1140, bottom: 720, left: 1140, header: 720, footer: 720 } } },
        footers: { default: footer, even: footer, first: footer },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
