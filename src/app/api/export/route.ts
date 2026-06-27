import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, fail } from "@/lib/server";
import { recordInclude, serializeRecord } from "@/lib/serialize";
import type { RecordItem } from "@/lib/types";
import { buildProgram, type ProgramWeek } from "@/lib/export/program";
import { buildDocx } from "@/lib/export/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isYMD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// GET /api/export?fechas=YMD,YMD&format=json|docx
//     /api/export?desde=YMD&hasta=YMD&format=json|docx
// Devuelve el programa (formato S-140) de 1..N reuniones, en JSON (vista previa)
// o como archivo Word (.docx).
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const fechasParam = url.searchParams.get("fechas");
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");

  let where: { fecha: { in: Date[] } | { gte: Date; lte: Date } };
  if (fechasParam) {
    const list = fechasParam.split(",").filter(isYMD);
    if (!list.length) return fail("Indica fechas válidas (YYYY-MM-DD)", 422);
    where = { fecha: { in: list.map((d) => new Date(d)) } };
  } else if (desde && hasta && isYMD(desde) && isYMD(hasta)) {
    where = { fecha: { gte: new Date(desde), lte: new Date(hasta) } };
  } else {
    return fail("Indica 'fechas' o el rango 'desde'/'hasta'", 422);
  }

  const [recs, meets, config] = await Promise.all([
    prisma.record.findMany({ where, include: recordInclude, orderBy: [{ fecha: "asc" }, { orden: "asc" }] }),
    prisma.meeting.findMany({ where, select: { fecha: true, relato: true, nota: true } }),
    prisma.meetingConfig.findUnique({ where: { id: "default" }, select: { congregacion: true } }),
  ]);

  // Agrupa registros por fecha (YMD).
  const byFecha = new Map<string, RecordItem[]>();
  for (const r of recs.map(serializeRecord)) {
    const arr = byFecha.get(r.fecha);
    if (arr) arr.push(r);
    else byFecha.set(r.fecha, [r]);
  }

  // Detalle (relato/nota) por fecha.
  const detail = new Map<string, { relato: string | null; nota: string | null }>();
  for (const m of meets) detail.set(m.fecha.toISOString().slice(0, 10), { relato: m.relato, nota: m.nota });

  const congregacion = config?.congregacion ?? null;
  const fechas = [...byFecha.keys()].sort();
  const weeks: ProgramWeek[] = fechas.map((f) =>
    buildProgram(f, byFecha.get(f)!, detail.get(f)?.relato ?? null, detail.get(f)?.nota ?? null, congregacion),
  );

  if (format === "docx") {
    if (!weeks.length) return fail("No hay reuniones con datos en el rango seleccionado", 404);
    const buffer = await buildDocx(weeks);
    const filename = `Programa ${fechas[0]} a ${fechas[fechas.length - 1]}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ weeks });
}
