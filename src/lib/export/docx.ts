// Generador del Word (.docx) replicando el formato oficial S-140 (calibrado
// contra el render del PDF y del .docx oficiales):
//  - Encabezado en tabla propia (título Cambria ~16.5pt a ~70% para que NO se
//    parta en 2 líneas) + cuerpo en tabla de 5 columnas (barra de sección = 5044).
//  - Las semanas FLUYEN (sin salto de página por semana): ~2 por hoja como el oficial.
//  - Alturas: contenido 288 (mín.), top-align; barras 288; espaciadores finos 126/144.
//  - Pie "S-140-S  11/23" (10pt). Cuerpo negro normal (Calibri); etiquetas gris
//    575A5D pequeñas a la derecha; bullet "•" de color; nota en cursiva.
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

// ── Colores ───────────────────────────────────────────────
const GRIS = "575A5D";
const GRIS_REGLA = "A6A6A6";
const DORADO = "BE8900";
const VINO = "7E0024";
const WHITE = "FFFFFF";
const BODY = "Calibri";
const TITLE_FONT = "Cambria";

// ── Grids (twips) ─────────────────────────────────────────
const HEAD_COLS = [3100, 3864, 3000]; // título = col2+col3 = 6864 (~69%)
const BODY_COLS = [617, 2971, 1456, 2477, 2443]; // barra de sección = col1+2+3 = 5044
const W_TOTAL = 9964;

// ── Bordes ────────────────────────────────────────────────
const NIL = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const noBorders = { top: NIL, bottom: NIL, left: NIL, right: NIL };
const tableBorders = { ...noBorders, insideHorizontal: NIL, insideVertical: NIL };
const HEADER_RULE = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 18, color: GRIS_REGLA } as const;

type VAlign = "top" | "center" | "bottom";
// ── Runs ──────────────────────────────────────────────────
const gris = (text: string, size = 16) => new TextRun({ text, color: GRIS, size, font: BODY });
const negro = (text: string, size = 22, italics = false) => new TextRun({ text, size, italics, font: BODY });
const neg = (text: string, size: number) => new TextRun({ text, bold: true, size, font: BODY });
const blanco = (text: string) => new TextRun({ text, bold: true, color: WHITE, size: 20, font: BODY });
const bullet = (color: string) => new TextRun({ text: "•  ", color, size: 22, bold: true, font: BODY });
const titulo = () => new TextRun({ text: "Programa para la reunión de entre semana", bold: true, size: 33, font: TITLE_FONT, characterSpacing: -4 });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
  new Paragraph({ children, alignment: align, spacing: { before: 0, after: 0, line: 240 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: VAlign;
  rule?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    borders: o.rule ? { ...noBorders, bottom: HEADER_RULE } : noBorders,
    margins: { top: 0, bottom: 0, left: 60, right: 60 },
  });

const contentRow = (children: TableCell[]) => new TableRow({ height: { value: 288, rule: HeightRule.ATLEAST }, children });
const spacer = (h: number, span = 5) =>
  new TableRow({
    height: { value: h, rule: HeightRule.EXACT },
    children: [new TableCell({ children: [new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 80 } })], columnSpan: span, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } })],
  });
const gapPara = (after: number) => new Paragraph({ children: [new TextRun({ text: "", size: 2, font: BODY })], spacing: { before: 0, after, line: 40, lineRule: "exact" } });

const HORA = () => cell([gris("0:00", 18)], { align: AlignmentType.LEFT });
const slot = (s: { est: string | null; ay: string | null }): string => (s.est && s.ay ? `${s.est} / ${s.ay}` : s.est ?? s.ay ?? "");

function sectionHeaderRow(t: string, fill: string): TableRow {
  return contentRow([
    cell([blanco(t)], { span: 3, fill, valign: VerticalAlign.CENTER }),
    cell([gris("Sala auxiliar", 18)], { valign: VerticalAlign.BOTTOM }),
    cell([gris("Auditorio principal", 18)], { valign: VerticalAlign.BOTTOM }),
  ]);
}

function bulletRow(t: string, color: string, opts: { minutos?: number | null; oracion?: string | null } = {}): TableRow {
  const runs: TextRun[] = [bullet(color), negro(t)];
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(negro(`   ${m}`));
  if (opts.oracion !== undefined) {
    return contentRow([HORA(), cell(runs, { span: 2 }), cell([gris("Oración:")], { align: AlignmentType.RIGHT }), cell(opts.oracion ? [negro(opts.oracion)] : [negro("")])]);
  }
  return contentRow([HORA(), cell(runs, { span: 4 })]);
}

function tituloRuns(numero: number, t: string, minutos: number | null): TextRun[] {
  const runs: TextRun[] = [negro(`${numero}. ${t}`)];
  const m = minsLabel(minutos);
  if (m) runs.push(negro(`   ${m}`));
  return runs;
}

// Discurso/perlas/discurso de Vida: título hasta Sala auxiliar; nombre en Auditorio principal.
function singleRow(numero: number, t: string, minutos: number | null, nombre: string | null): TableRow {
  return contentRow([HORA(), cell(tituloRuns(numero, t, minutos), { span: 3 }), cell(nombre ? [negro(nombre)] : [negro("")])]);
}

function dualRow(numero: number, t: string, minutos: number | null, label: string, aux: string | null, prin: string | null): TableRow {
  return contentRow([
    HORA(),
    cell(tituloRuns(numero, t, minutos)),
    cell([gris(label)], { align: AlignmentType.RIGHT }),
    cell(aux ? [negro(aux)] : [negro("")]),
    cell(prin ? [negro(prin)] : [negro("")]),
  ]);
}

// Encabezado (tabla propia): congregación + título (regla gruesa), semana,
// Presidente y Consejero (etiqueta gris a la derecha, valor negro).
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
        cell([gris("Presidente:")], { align: AlignmentType.RIGHT }),
        cell([negro(w.presidente ?? "")]),
      ]),
      contentRow([
        cell([negro("")]),
        cell([gris("Consejero de la sala auxiliar:")], { align: AlignmentType.RIGHT }),
        cell([negro(consejeroTexto(w), 22, !!w.nota)]),
      ]),
    ],
  });
}

// Cuerpo (tabla propia de 5 columnas).
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
  rows.push(sectionHeaderRow("NUESTRA VIDA CRISTIANA", VINO));
  rows.push(bulletRow(`Canción ${w.vida.cancion ?? ""}`.trim(), VINO));
  for (const d of w.vida.discursos) rows.push(singleRow(d.numero, d.titulo, d.minutos, d.nombre));
  if (w.vida.estudio) {
    const cl = [w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ");
    rows.push(contentRow([HORA(), cell(tituloRuns(w.vida.estudio.numero, "Estudio bíblico de la congregación", w.vida.estudio.minutos)), cell([gris("Conductor/Lector:")], { align: AlignmentType.RIGHT }), cell(cl ? [negro(cl)] : [negro("")], { span: 2 })]));
  }
  rows.push(bulletRow("Palabras de conclusión", VINO, { minutos: 3 }));
  rows.push(bulletRow(`Canción ${w.vida.cancionFinal ?? ""}`.trim(), VINO, { oracion: w.vida.oracionFinal }));

  return new Table({ width: { size: W_TOTAL, type: WidthType.DXA }, columnWidths: BODY_COLS, layout: TableLayoutType.FIXED, borders: tableBorders, rows });
}

export async function buildDocx(weeks: ProgramWeek[]): Promise<Buffer> {
  const children: (Table | Paragraph)[] = [];
  weeks.forEach((w, i) => {
    if (i > 0) children.push(gapPara(300)); // separación entre semanas (fluyen, sin salto de página)
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
