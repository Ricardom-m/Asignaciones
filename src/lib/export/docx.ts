// Generador del Word (.docx) replicando el formato oficial S-140 con sus medidas
// reales (extraídas del XML de S-140_S.docx y calibradas contra el render del PDF):
//  - UNA tabla por semana; grid [617, 2971, 1456, 2477, 2443] (barra de sección = 5044).
//  - Alturas: filas de contenido 288 (mín.); barras 288; filas espaciadoras finas
//    144/126 (exactas) entre el encabezado y la 1ª línea y antes de cada barra.
//  - Pie de página "S-140-S  11/23" (10pt). Título Cambria 16.5pt; barras 10pt blanco.
//  - Cuerpo negro normal (Calibri); etiquetas gris 575A5D pequeñas a la derecha;
//    bullet "•" de color; "N/A | Visita Superintendente" (nota) en cursiva.
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

// ── Grid de columnas (twips): barra de sección = col1+2+3 = 5044 ──
const COLS = [617, 2971, 1456, 2477, 2443];
const W_TOTAL = COLS.reduce((a, b) => a + b, 0); // 9964

// ── Bordes ────────────────────────────────────────────────
const NIL = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const noBorders = { top: NIL, bottom: NIL, left: NIL, right: NIL };
const tableBorders = { ...noBorders, insideHorizontal: NIL, insideVertical: NIL };
const HEADER_RULE = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 18, color: GRIS_REGLA } as const;

// ── Runs ──────────────────────────────────────────────────
const gris = (text: string, size = 16) => new TextRun({ text, color: GRIS, size, font: BODY });
const negro = (text: string, size = 22, italics = false) => new TextRun({ text, size, italics, font: BODY });
const neg = (text: string, size: number) => new TextRun({ text, bold: true, size, font: BODY });
const blanco = (text: string) => new TextRun({ text, bold: true, color: WHITE, size: 20, font: BODY });
const bullet = (color: string) => new TextRun({ text: "•  ", color, size: 22, bold: true, font: BODY });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
  new Paragraph({ children, alignment: align, spacing: { before: 0, after: 0, line: 240 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: "top" | "center" | "bottom";
  rule?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.CENTER,
    borders: o.rule ? { ...noBorders, bottom: HEADER_RULE } : noBorders,
    margins: { top: 8, bottom: 8, left: 60, right: 60 },
  });

const contentRow = (children: TableCell[]) => new TableRow({ height: { value: 288, rule: HeightRule.ATLEAST }, children });
const spacer = (h: number) =>
  new TableRow({
    height: { value: h, rule: HeightRule.EXACT },
    children: [
      new TableCell({
        children: [new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 120 } })],
        columnSpan: 5,
        borders: noBorders,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    ],
  });

const HORA = () => cell([gris("0:00", 18)], { align: AlignmentType.LEFT });
const slot = (s: { est: string | null; ay: string | null }): string => (s.est && s.ay ? `${s.est} / ${s.ay}` : s.est ?? s.ay ?? "");

function sectionHeaderRow(titulo: string, fill: string): TableRow {
  return contentRow([
    cell([blanco(titulo)], { span: 3, fill, valign: VerticalAlign.CENTER }),
    cell([gris("Sala auxiliar", 18)], { valign: VerticalAlign.BOTTOM }),
    cell([gris("Auditorio principal", 18)], { valign: VerticalAlign.BOTTOM }),
  ]);
}

function bulletRow(titulo: string, color: string, opts: { minutos?: number | null; oracion?: string | null } = {}): TableRow {
  const runs: TextRun[] = [bullet(color), negro(titulo)];
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(negro(`   ${m}`));
  if (opts.oracion !== undefined) {
    return contentRow([
      HORA(),
      cell(runs, { span: 2 }),
      cell([gris("Oración:")], { align: AlignmentType.RIGHT }),
      cell(opts.oracion ? [negro(opts.oracion)] : [negro("")]),
    ]);
  }
  return contentRow([HORA(), cell(runs, { span: 4 })]);
}

function tituloRuns(numero: number, titulo: string, minutos: number | null): TextRun[] {
  const runs: TextRun[] = [negro(`${numero}. ${titulo}`)];
  const m = minsLabel(minutos);
  if (m) runs.push(negro(`   ${m}`));
  return runs;
}

function singleRow(numero: number, titulo: string, minutos: number | null, nombre: string | null): TableRow {
  // El título abarca hasta la columna de Sala auxiliar (el discurso es de una
  // sola sala); el nombre va en Auditorio principal. Así no se parte en 2 líneas.
  return contentRow([
    HORA(),
    cell(tituloRuns(numero, titulo, minutos), { span: 3 }),
    cell(nombre ? [negro(nombre)] : [negro("")]),
  ]);
}

function dualRow(numero: number, titulo: string, minutos: number | null, label: string, aux: string | null, prin: string | null): TableRow {
  return contentRow([
    HORA(),
    cell(tituloRuns(numero, titulo, minutos)),
    cell([gris(label)], { align: AlignmentType.RIGHT }),
    cell(aux ? [negro(aux)] : [negro("")]),
    cell(prin ? [negro(prin)] : [negro("")]),
  ]);
}

// Tabla única por semana (encabezado + cuerpo) con alturas y espaciadores reales.
function weekTable(w: ProgramWeek): Table {
  const rows: TableRow[] = [];

  // Encabezado
  rows.push(
    contentRow([
      cell([neg(w.congregacion, 22)], { span: 2, rule: true, valign: VerticalAlign.BOTTOM }),
      cell([new TextRun({ text: "Programa para la reunión de entre semana", bold: true, size: 33, font: TITLE_FONT })], {
        span: 3,
        rule: true,
        align: AlignmentType.RIGHT,
        valign: VerticalAlign.BOTTOM,
      }),
    ]),
  );
  rows.push(spacer(144));
  rows.push(
    contentRow([
      cell([neg(`${w.semana}${w.relato ? ` | ${w.relato}` : ""}`, 22)], { span: 2, valign: VerticalAlign.BOTTOM }),
      cell([gris("Presidente:")], { span: 2, align: AlignmentType.RIGHT }),
      cell([negro(w.presidente ?? "")]),
    ]),
  );
  rows.push(
    contentRow([
      cell([negro("")], { span: 2 }),
      cell([gris("Consejero de la sala auxiliar:")], { span: 2, align: AlignmentType.RIGHT, valign: VerticalAlign.TOP }),
      cell([negro(consejeroTexto(w), 22, !!w.nota)], { valign: VerticalAlign.TOP }),
    ]),
  );
  rows.push(spacer(144));

  // Apertura
  rows.push(bulletRow(`Canción ${w.cancionInicio ?? ""}`.trim(), GRIS, { oracion: w.oracionInicio }));
  rows.push(bulletRow("Palabras de introducción", GRIS, { minutos: 1 }));

  // TESOROS
  rows.push(spacer(126));
  rows.push(sectionHeaderRow("TESOROS DE LA BIBLIA", GRIS));
  if (w.tesoros.discurso) rows.push(singleRow(w.tesoros.discurso.numero, w.tesoros.discurso.titulo, w.tesoros.discurso.minutos, w.tesoros.discurso.nombre));
  if (w.tesoros.perlas) rows.push(singleRow(w.tesoros.perlas.numero, "Busquemos perlas escondidas", w.tesoros.perlas.minutos, w.tesoros.perlas.nombre));
  if (w.tesoros.lectura) rows.push(dualRow(w.tesoros.lectura.numero, "Lectura de la Biblia", w.tesoros.lectura.minutos, "Estudiante:", w.tesoros.lectura.aux, w.tesoros.lectura.prin));

  // SEAMOS
  rows.push(spacer(126));
  rows.push(sectionHeaderRow("SEAMOS MEJORES MAESTROS", DORADO));
  for (const p of w.seamos) rows.push(dualRow(p.numero, p.titulo, p.minutos, "Estudiante/Ayudante:", slot(p.aux), slot(p.prin)));

  // NUESTRA VIDA
  rows.push(spacer(126));
  rows.push(sectionHeaderRow("NUESTRA VIDA CRISTIANA", VINO));
  rows.push(bulletRow(`Canción ${w.vida.cancion ?? ""}`.trim(), VINO));
  for (const d of w.vida.discursos) rows.push(singleRow(d.numero, d.titulo, d.minutos, d.nombre));
  if (w.vida.estudio) {
    const condLect = [w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ");
    rows.push(
      contentRow([
        HORA(),
        cell(tituloRuns(w.vida.estudio.numero, "Estudio bíblico de la congregación", w.vida.estudio.minutos)),
        cell([gris("Conductor/Lector:")], { align: AlignmentType.RIGHT }),
        cell(condLect ? [negro(condLect)] : [negro("")], { span: 2 }),
      ]),
    );
  }
  rows.push(bulletRow("Palabras de conclusión", VINO, { minutos: 3 }));
  rows.push(bulletRow(`Canción ${w.vida.cancionFinal ?? ""}`.trim(), VINO, { oracion: w.vida.oracionFinal }));

  return new Table({ width: { size: W_TOTAL, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, borders: tableBorders, rows });
}

export async function buildDocx(weeks: ProgramWeek[]): Promise<Buffer> {
  const children: (Table | Paragraph)[] = [];
  weeks.forEach((w, i) => {
    if (i > 0) children.push(new Paragraph({ children: [], pageBreakBefore: true }));
    children.push(weekTable(w));
  });

  const footer = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "S-140-S  11/23", size: 20, font: BODY })] })],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY, size: 22 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1009, right: 1140, bottom: 720, left: 1140, header: 720, footer: 720 } },
        },
        footers: { default: footer, even: footer, first: footer },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
