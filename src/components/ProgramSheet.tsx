// Vista previa del programa con el formato oficial S-140 (HTML/CSS). Sirve para
// revisar en pantalla y para generar el PDF con la impresión del navegador.
// Mismos datos y estructura que el Word (src/lib/export/docx.ts).

import { Fragment } from "react";
import type { ProgramWeek, SeamosPart } from "@/lib/export/program";
import { consejeroTexto, minsLabel } from "@/lib/export/program";

const GRIS = "#575A5D";
const VINO = "#7E0024";

function Marker({
  numero,
  bullet,
  titulo,
  minutos,
}: {
  numero?: number | null;
  bullet?: "gris" | "vino" | null;
  titulo: string;
  minutos?: number | null;
}) {
  const m = minsLabel(minutos ?? null);
  return (
    <>
      {numero != null && <b>{numero}. </b>}
      {bullet && <span style={{ color: bullet === "gris" ? GRIS : VINO, fontWeight: 700 }}>• </span>}
      {titulo}
      {m && ` ${m}`}
    </>
  );
}

const slot = (s: { est: string | null; ay: string | null }) => {
  if (s.est && s.ay) return `${s.est} / ${s.ay}`;
  return s.est ?? s.ay ?? "";
};

function Week({ w }: { w: ProgramWeek }) {
  return (
    <div className="ps-page">
      {/* Encabezado */}
      <div className="ps-head">
        <div className="ps-head-l">
          <div className="ps-cong">{w.congregacion}</div>
          <div className="ps-semana">
            {w.semana}
            {w.relato ? ` | ${w.relato}` : ""}
          </div>
        </div>
        <div className="ps-head-r">
          <div className="ps-title">Programa para la reunión de entre semana</div>
          <div>
            <b>Presidente:</b> {w.presidente ?? ""}
          </div>
          <div>
            <b>Consejero de la sala auxiliar:</b> {consejeroTexto(w)}
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <table className="ps-table">
        <colgroup>
          <col style={{ width: "6.2%" }} />
          <col style={{ width: "31.2%" }} />
          <col style={{ width: "14.6%" }} />
          <col style={{ width: "23.5%" }} />
          <col style={{ width: "24.5%" }} />
        </colgroup>
        <tbody>
          {/* Apertura */}
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={2}>
              <Marker bullet="gris" titulo={`Canción ${w.cancionInicio ?? ""}`.trim()} />
            </td>
            <td colSpan={2}>
              <b>Oración:</b> {w.oracionInicio ?? ""}
            </td>
          </tr>
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={4}>
              <Marker bullet="gris" titulo="Palabras de introducción" minutos={1} />
            </td>
          </tr>

          {/* TESOROS DE LA BIBLIA */}
          <tr>
            <td colSpan={3} className="ps-sec" style={{ background: GRIS }}>
              TESOROS DE LA BIBLIA
            </td>
            <td className="ps-salalbl">Sala auxiliar</td>
            <td className="ps-salalbl">Auditorio principal</td>
          </tr>
          {w.tesoros.discurso && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td colSpan={2}>
                <Marker numero={w.tesoros.discurso.numero} titulo={w.tesoros.discurso.titulo} minutos={w.tesoros.discurso.minutos} />
              </td>
              <td />
              <td>{w.tesoros.discurso.nombre ?? ""}</td>
            </tr>
          )}
          {w.tesoros.perlas && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td colSpan={2}>
                <Marker numero={w.tesoros.perlas.numero} titulo="Busquemos perlas escondidas" minutos={w.tesoros.perlas.minutos} />
              </td>
              <td />
              <td>{w.tesoros.perlas.nombre ?? ""}</td>
            </tr>
          )}
          {w.tesoros.lectura && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td>
                <Marker numero={w.tesoros.lectura.numero} titulo="Lectura de la Biblia" minutos={w.tesoros.lectura.minutos} />
              </td>
              <td className="ps-rol">Estudiante:</td>
              <td>{w.tesoros.lectura.aux ?? ""}</td>
              <td>{w.tesoros.lectura.prin ?? ""}</td>
            </tr>
          )}

          {/* SEAMOS MEJORES MAESTROS */}
          <tr>
            <td colSpan={3} className="ps-sec" style={{ background: "#BE8900" }}>
              SEAMOS MEJORES MAESTROS
            </td>
            <td className="ps-salalbl">Sala auxiliar</td>
            <td className="ps-salalbl">Auditorio principal</td>
          </tr>
          {w.seamos.map((p: SeamosPart) => (
            <tr key={p.numero}>
              <td className="ps-hora">0:00</td>
              <td>
                <Marker numero={p.numero} titulo={p.titulo} minutos={p.minutos} />
              </td>
              <td className="ps-rol">Estudiante/Ayudante:</td>
              <td>{slot(p.aux)}</td>
              <td>{slot(p.prin)}</td>
            </tr>
          ))}

          {/* NUESTRA VIDA CRISTIANA */}
          <tr>
            <td colSpan={5} className="ps-sec" style={{ background: VINO }}>
              NUESTRA VIDA CRISTIANA
            </td>
          </tr>
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={4}>
              <Marker bullet="vino" titulo={`Canción ${w.vida.cancion ?? ""}`.trim()} />
            </td>
          </tr>
          {w.vida.discursos.map((d) => (
            <tr key={d.numero}>
              <td className="ps-hora">0:00</td>
              <td colSpan={2}>
                <Marker numero={d.numero} titulo={d.titulo} minutos={d.minutos} />
              </td>
              <td />
              <td>{d.nombre ?? ""}</td>
            </tr>
          ))}
          {w.vida.estudio && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td>
                <Marker numero={w.vida.estudio.numero} titulo="Estudio bíblico de la congregación" minutos={w.vida.estudio.minutos} />
              </td>
              <td className="ps-rol">Conductor/Lector:</td>
              <td colSpan={2}>{[w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ")}</td>
            </tr>
          )}
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={4}>
              <Marker bullet="vino" titulo="Palabras de conclusión" minutos={3} />
            </td>
          </tr>
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={2}>
              <Marker bullet="vino" titulo={`Canción ${w.vida.cancionFinal ?? ""}`.trim()} />
            </td>
            <td colSpan={2}>
              <b>Oración:</b> {w.vida.oracionFinal ?? ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ProgramSheet({ weeks }: { weeks: ProgramWeek[] }) {
  return (
    <div className="ps-root">
      {weeks.map((w) => (
        <Fragment key={w.fecha}>
          <Week w={w} />
        </Fragment>
      ))}
    </div>
  );
}
