// Generador del Word (.docx) con el formato oficial S-140. Replica la plantilla
// real: página Carta, fuente Arial, colores por sección y la tabla a 5 columnas
// (hora · título · etiqueta de rol · Sala auxiliar · Auditorio principal).
//
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
const GRIS = "575A5D"; // Tesoros + bullets del inicio
const DORADO = "BE8900"; // Seamos mejores maestros
const VINO = "7E0024"; // Nuestra vida cristiana + sus bullets
const WHITE = "FFFFFF";
const BORDER = "B7B7B7";

// ── Anchos de columna (twips, de w:tblGrid de la plantilla) ──
const W_HORA = 617;
const W_TITULO = 3108;
const W_LABEL = 1456;
const W_AUX = 2340;
const W_PRIN = 2443;
const W_TOTAL = W_HORA + W_TITULO + W_LABEL + W_AUX + W_PRIN; // 9964

const FONT = "Arial";
const thin = { style: BorderStyle.SINGLE, size: 2, color: BORDER };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

type RunOpts = { bold?: boolean; italics?: boolean; color?: string; size?: number };
const run = (text: string, o: RunOpts = {}) =>
  new TextRun({ text, bold: o.bold, italics: o.italics, color: o.color, size: o.size ?? 18, font: FONT });

const para = (children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
  new Paragraph({ children, alignment: align, spacing: { before: 10, after: 10 } });

interface CellOpts {
  span?: number;
  fill?: string;
  valign?: "top" | "center" | "bottom";
  borders?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
const cell = (runs: TextRun[], o: CellOpts = {}) =>
  new TableCell({
    children: [para(runs, o.align)],
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.CENTER,
    borders: o.borders === false ? noBorders : cellBorders,
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
  });

const HORA = () => cell([run("0:00", { size: 16 })], { align: AlignmentType.LEFT });

// Contenido del título de una parte: prefijo (número "N. " o bullet "• " de
// color) + título + duración.
function tituloRuns(opts: {
  numero?: number | null;
  bullet?: "gris" | "vino" | null;
  titulo: string;
  minutos?: number | null;
}): TextRun[] {
  const runs: TextRun[] = [];
  if (opts.numero != null) runs.push(run(`${opts.numero}. `, { bold: true }));
  else if (opts.bullet) runs.push(run("• ", { bold: true, color: opts.bullet === "gris" ? GRIS : VINO }));
  runs.push(run(opts.titulo));
  const m = minsLabel(opts.minutos ?? null);
  if (m) runs.push(run(` ${m}`));
  return runs;
}

// Fila de encabezado de sección: título con relleno de color (blanco) + las dos
// etiquetas de sala (sin relleno).
function sectionHeaderRow(titulo: string, fill: string): TableRow {
  return new TableRow({
    children: [
      cell([run(titulo, { bold: true, color: WHITE, size: 20 })], { span: 3, fill, valign: VerticalAlign.CENTER }),
      cell([run("Sala auxiliar", { bold: true, size: 16 })], { valign: VerticalAlign.BOTTOM, align: AlignmentType.CENTER }),
      cell([run("Auditorio principal", { bold: true, size: 16 })], { valign: VerticalAlign.BOTTOM, align: AlignmentType.CENTER }),
    ],
  });
}

// Fila "sin persona" (Canción / Palabras): hora + título (•) a todo el ancho,
// opcionalmente con "Oración: nombre" a la derecha (canción).
function bulletRow(
  titulo: string,
  bullet: "gris" | "vino",
  opts: { minutos?: number | null; oracion?: string | null } = {},
): TableRow {
  if (opts.oracion !== undefined) {
    // Canción: título (span título+label) + "Oración: nombre" (span aux+prin)
    return new TableRow({
      children: [
        HORA(),
        cell(tituloRuns({ bullet, titulo, minutos: opts.minutos }), { span: 2 }),
        cell(opts.oracion ? [run("Oración: ", { bold: true }), run(opts.oracion)] : [run("Oración:", { bold: true })], {
          span: 2,
        }),
      ],
    });
  }
  // Palabras: título a todo el ancho restante (span 4)
  return new TableRow({
    children: [HORA(), cell(tituloRuns({ bullet, titulo, minutos: opts.minutos }), { span: 4 })],
  });
}

// Parte numerada con UN solo responsable (discurso, perlas, discurso de Vida):
// el nombre va en "Auditorio principal" (derecha); "Sala auxiliar" queda vacía.
function singleRow(numero: number, titulo: string, minutos: number | null, nombre: string | null): TableRow {
  return new TableRow({
    children: [
      HORA(),
      cell(tituloRuns({ numero, titulo, minutos }), { span: 2 }),
      cell([run("")]),
      cell(nombre ? [run(nombre)] : [run("")]),
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
      cell(tituloRuns({ numero, titulo, minutos })),
      cell([run(label, { italics: true, size: 16 })], { valign: VerticalAlign.CENTER }),
      cell(aux ? [run(aux)] : [run("")]),
      cell(prin ? [run(prin)] : [run("")]),
    ],
  });
}

const slot = (s: { est: string | null; ay: string | null }): string => {
  if (!s.est && !s.ay) return "";
  if (s.est && s.ay) return `${s.est} / ${s.ay}`;
  return s.est ?? s.ay ?? "";
};

// Encabezado de la semana (congregación, título, semana|relato, presidente,
// consejero) como tabla sin bordes de 2 columnas.
function weekHeader(w: ProgramWeek): Table {
  const mk = (left: TextRun[], right: TextRun[]) =>
    new TableRow({
      children: [
        cell(left, { borders: false }),
        cell(right, { borders: false, align: AlignmentType.LEFT }),
      ],
    });
  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: [4982, 4982],
    layout: TableLayoutType.FIXED,
    borders: {
      top: noBorders.top,
      bottom: noBorders.bottom,
      left: noBorders.left,
      right: noBorders.right,
      insideHorizontal: noBorders.top,
      insideVertical: noBorders.left,
    },
    rows: [
      mk(
        [run(w.congregacion, { bold: true, size: 26 })],
        [run("Programa para la reunión de entre semana", { size: 18 })],
      ),
      mk(
        [run(`${w.semana}${w.relato ? ` | ${w.relato}` : ""}`, { bold: true, size: 20 })],
        [run("Presidente: ", { bold: true }), run(w.presidente ?? "")],
      ),
      mk(
        [run("")],
        [run("Consejero de la sala auxiliar: ", { bold: true }), run(consejeroTexto(w))],
      ),
    ],
  });
}

// Cuerpo de la semana (las 3 secciones) como tabla de 5 columnas.
function weekBody(w: ProgramWeek): Table {
  const rows: TableRow[] = [];

  // Apertura: Canción + Oración inicial, Palabras de introducción.
  rows.push(bulletRow(`Canción ${w.cancionInicio ?? ""}`.trim(), "gris", { oracion: w.oracionInicio }));
  rows.push(bulletRow("Palabras de introducción", "gris", { minutos: 1 }));

  // TESOROS DE LA BIBLIA
  rows.push(sectionHeaderRow("TESOROS DE LA BIBLIA", GRIS));
  if (w.tesoros.discurso)
    rows.push(singleRow(w.tesoros.discurso.numero, w.tesoros.discurso.titulo, w.tesoros.discurso.minutos, w.tesoros.discurso.nombre));
  if (w.tesoros.perlas)
    rows.push(singleRow(w.tesoros.perlas.numero, "Busquemos perlas escondidas", w.tesoros.perlas.minutos, w.tesoros.perlas.nombre));
  if (w.tesoros.lectura)
    rows.push(
      dualRow(w.tesoros.lectura.numero, "Lectura de la Biblia", w.tesoros.lectura.minutos, "Estudiante:", w.tesoros.lectura.aux, w.tesoros.lectura.prin),
    );

  // SEAMOS MEJORES MAESTROS
  rows.push(sectionHeaderRow("SEAMOS MEJORES MAESTROS", DORADO));
  for (const p of w.seamos) {
    rows.push(dualRow(p.numero, p.titulo, p.minutos, "Estudiante/Ayudante:", slot(p.aux), slot(p.prin)));
  }

  // NUESTRA VIDA CRISTIANA
  rows.push(sectionHeaderRow("NUESTRA VIDA CRISTIANA", VINO));
  // La canción de apertura de Nuestra vida no lleva oración al lado (a todo el ancho).
  rows.push(bulletRow(`Canción ${w.vida.cancion ?? ""}`.trim(), "vino"));
  for (const d of w.vida.discursos) rows.push(singleRow(d.numero, d.titulo, d.minutos, d.nombre));
  if (w.vida.estudio) {
    const condLect = [w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ");
    rows.push(
      new TableRow({
        children: [
          HORA(),
          cell(tituloRuns({ numero: w.vida.estudio.numero, titulo: "Estudio bíblico de la congregación", minutos: w.vida.estudio.minutos })),
          cell([run("Conductor/Lector:", { italics: true, size: 16 })]),
          cell(condLect ? [run(condLect)] : [run("")], { span: 2 }),
        ],
      }),
    );
  }
  rows.push(bulletRow("Palabras de conclusión", "vino", { minutos: 3 }));
  rows.push(bulletRow(`Canción ${w.vida.cancionFinal ?? ""}`.trim(), "vino", { oracion: w.vida.oracionFinal }));

  return new Table({
    width: { size: W_TOTAL, type: WidthType.DXA },
    columnWidths: [W_HORA, W_TITULO, W_LABEL, W_AUX, W_PRIN],
    layout: TableLayoutType.FIXED,
    rows,
  });
}

export async function buildDocx(weeks: ProgramWeek[]): Promise<Buffer> {
  const children: (Table | Paragraph)[] = [];
  weeks.forEach((w, i) => {
    if (i > 0) children.push(new Paragraph({ children: [], pageBreakBefore: true }));
    children.push(weekHeader(w));
    children.push(new Paragraph({ children: [], spacing: { after: 40 } }));
    children.push(weekBody(w));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
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
