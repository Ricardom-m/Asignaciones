// Generador del Word (.docx) replicando el formato oficial S-140, calibrado
// contra el render real del PDF:
//  - Página Carta; cuerpo en Calibri NEGRO normal; título Cambria (serif) grande.
//  - Sin rejilla: el cuerpo NO lleva líneas; solo UNA regla gruesa (thinThickSmallGap
//    gris) bajo el encabezado (congregación + título).
//  - Gris 575A5D (pequeño): SOLO las etiquetas (Presidente/Consejero/Oración,
//    Sala auxiliar/Auditorio principal, Estudiante/Ayudante, Conductor/Lector, 0:00).
//  - Bullet "•" coloreado (gris al inicio, vino en Nuestra vida); el texto va negro.
//  - "N/A | Visita Superintendente" (nota) en cursiva.
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

// ── Colores ───────────────────────────────────────────────
const GRIS = "575A5D"; // etiquetas + bullets del inicio
const GRIS_REGLA = "A6A6A6"; // regla bajo el encabezado
const DORADO = "BE8900"; // Seamos
const VINO = "7E0024"; // Nuestra vida (bar + bullets)
const WHITE = "FFFFFF";
const BODY = "Calibri";
const TITLE_FONT = "Cambria";

// ── Anchos de columna (twips) ─────────────────────────────
const W_HORA = 617;
const W_TITULO = 3108;
const W_LABEL = 1456;
const W_AUX = 2340;
const W_PRIN = 2443;
const W_TOTAL = W_HORA + W_TITULO + W_LABEL + W_AUX + W_PRIN; // 9964

// ── Bordes ────────────────────────────────────────────────
const NIL = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const noBorders = { top: NIL, bottom: NIL, left: NIL, right: NIL };
const HEADER_RULE = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 18, color: GRIS_REGLA } as const;

// ── Runs ──────────────────────────────────────────────────
const gris = (text: string, size = 17) => new TextRun({ text, color: GRIS, size, font: BODY });
const negro = (text: string, size = 22, italics = false) => new TextRun({ text, size, italics, font: BODY });
const neg = (text: string, size: number) => new TextRun({ text, bold: true, size, font: BODY });
const blanco = (text: string) => new TextRun({ text, bold: true, color: WHITE, size: 22, font: BODY });
const bullet = (color: string) => new TextRun({ text: "•  ", color, size: 22, bold: true, font: BODY });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
  new Paragraph({ children, alignment: align, spacing: { before: 4, after: 4, line: 240 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: "top" | "center" | "bottom";
  rule?: boolean; // true = regla gruesa abajo (encabezado)
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.CENTER,
    borders: o.rule ? { ...noBorders, bottom: HEADER_RULE } : noBorders,
    margins: { top: 6, bottom: 6, left: 60, right: 60 },
  });

const HORA = () => cell([gris("0:00")], { align: AlignmentType.LEFT });

const slot = (s: { est: string | null; ay: string | null }): string => {
  if (s.est && s.ay) return `${s.est} / ${s.ay}`;
  return s.est ?? s.ay ?? "";
};

// Encabezado de sección: barra de color (texto blanco) + etiquetas de sala (gris).
function sectionHeaderRow(titulo: string, fill: string): TableRow {
  return new TableRow({
    children: [
      cell([blanco(titulo)], { span: 3, fill, valign: VerticalAlign.CENTER }),
      cell([gris("Sala auxiliar")], { valign: VerticalAlign.BOTTOM }),
      cell([gris("Auditorio principal")], { valign: VerticalAlign.BOTTOM }),
    ],
  });
}

// Fila de Canción/Palabras: "● titulo" (bullet de color, texto negro). Opcional
// "Oración:" (etiqueta gris, derecha) + nombre (negro) en las columnas de sala.
function bulletRow(
  titulo: string,
  color: string,
  opts: { minutos?: number | null; oracion?: string | null } = {},
): TableRow {
  const runs: TextRun[] = [bullet(color), negro(titulo)];
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(negro(`   ${m}`));
  if (opts.oracion !== undefined) {
    return new TableRow({
      children: [
        HORA(),
        cell(runs, { span: 2 }),
        cell([gris("Oración:")], { align: AlignmentType.RIGHT }),
        cell(opts.oracion ? [negro(opts.oracion)] : [negro("")]),
      ],
    });
  }
  return new TableRow({ children: [HORA(), cell(runs, { span: 4 })] });
}

// Runs de una parte numerada: "N. titulo  (X mins.)" (todo negro).
function tituloRuns(numero: number, titulo: string, minutos: number | null): TextRun[] {
  const runs: TextRun[] = [negro(`${numero}. ${titulo}`)];
  const m = minsLabel(minutos);
  if (m) runs.push(negro(`   ${m}`));
  return runs;
}

// Parte numerada con un solo responsable (discurso, perlas, discurso de Vida).
function singleRow(numero: number, titulo: string, minutos: number | null, nombre: string | null): TableRow {
  return new TableRow({
    children: [
      HORA(),
      cell(tituloRuns(numero, titulo, minutos), { span: 2 }),
      cell([negro("")]),
      cell(nombre ? [negro(nombre)] : [negro("")]),
    ],
  });
}

// Parte numerada con etiqueta de rol y dos salas (Lectura, Seamos).
function dualRow(numero: number, titulo: string, minutos: number | null, label: string, aux: string | null, prin: string | null): TableRow {
  return new TableRow({
    children: [
      HORA(),
      cell(tituloRuns(numero, titulo, minutos)),
      cell([gris(label)], { align: AlignmentType.RIGHT }),
      cell(aux ? [negro(aux)] : [negro("")]),
      cell(prin ? [negro(prin)] : [negro("")]),
    ],
  });
}

// Encabezado de la semana: congregación + título (con regla gruesa abajo),
// luego semana y Presidente/Consejero (etiqueta gris a la derecha, valor negro).
function weekHeader(w: ProgramWeek): Table {
  const notaItal = !!w.nota; // "N/A | Visita Superintendente" en cursiva
  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: [4400, 3000, 2564],
    layout: TableLayoutType.FIXED,
    borders: { top: NIL, bottom: NIL, left: NIL, right: NIL, insideHorizontal: NIL, insideVertical: NIL },
    rows: [
      new TableRow({
        children: [
          cell([neg(w.congregacion, 22)], { rule: true, valign: VerticalAlign.BOTTOM }),
          cell([new TextRun({ text: "Programa para la reunión de entre semana", bold: true, size: 36, font: TITLE_FONT })], {
            span: 2,
            rule: true,
            align: AlignmentType.RIGHT,
            valign: VerticalAlign.BOTTOM,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell([neg(`${w.semana}${w.relato ? ` | ${w.relato}` : ""}`, 24)]),
          cell([gris("Presidente:")], { align: AlignmentType.RIGHT }),
          cell([negro(w.presidente ?? "")]),
        ],
      }),
      new TableRow({
        children: [
          cell([negro("")]),
          cell([gris("Consejero de la sala auxiliar:")], { align: AlignmentType.RIGHT, valign: VerticalAlign.TOP }),
          cell([negro(consejeroTexto(w), 22, notaItal)], { valign: VerticalAlign.TOP }),
        ],
      }),
    ],
  });
}

// Cuerpo de la semana (las 3 secciones), tabla de 5 columnas, sin líneas.
function weekBody(w: ProgramWeek): Table {
  const rows: TableRow[] = [];

  rows.push(bulletRow(`Canción ${w.cancionInicio ?? ""}`.trim(), GRIS, { oracion: w.oracionInicio }));
  rows.push(bulletRow("Palabras de introducción", GRIS, { minutos: 1 }));

  rows.push(sectionHeaderRow("TESOROS DE LA BIBLIA", GRIS));
  if (w.tesoros.discurso) rows.push(singleRow(w.tesoros.discurso.numero, w.tesoros.discurso.titulo, w.tesoros.discurso.minutos, w.tesoros.discurso.nombre));
  if (w.tesoros.perlas) rows.push(singleRow(w.tesoros.perlas.numero, "Busquemos perlas escondidas", w.tesoros.perlas.minutos, w.tesoros.perlas.nombre));
  if (w.tesoros.lectura) rows.push(dualRow(w.tesoros.lectura.numero, "Lectura de la Biblia", w.tesoros.lectura.minutos, "Estudiante:", w.tesoros.lectura.aux, w.tesoros.lectura.prin));

  rows.push(sectionHeaderRow("SEAMOS MEJORES MAESTROS", DORADO));
  for (const p of w.seamos) rows.push(dualRow(p.numero, p.titulo, p.minutos, "Estudiante/Ayudante:", slot(p.aux), slot(p.prin)));

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
          cell([gris("Conductor/Lector:")], { align: AlignmentType.RIGHT }),
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
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
    children.push(weekBody(w));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY, size: 22 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1009, right: 1140, bottom: 720, left: 1140 } },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
