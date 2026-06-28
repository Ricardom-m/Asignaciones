// Vista previa del programa con el formato oficial S-140 (HTML/CSS). Mismo espec
// exacto que el Word (src/lib/export/docx.ts): Calibri/Cambria, gris 575A5D en
// etiquetas y partes fijas (color de sección), negro en el contenido, y solo
// línea inferior por fila. Sirve de revisión en pantalla y para el PDF (imprimir).

import { Fragment } from "react";
import type { ProgramWeek, SeamosPart } from "@/lib/export/program";
import { consejeroTexto, minsLabel } from "@/lib/export/program";

const GRIS = "#575A5D";
const VINO = "#7E0024";

// "N. titulo  (X mins.)" — número/título/min en negro; el título en color si es
// una parte fija (perlas).
function NumTitulo({ numero, titulo, minutos, color }: { numero: number; titulo: string; minutos: number | null; color?: string }) {
  const m = minsLabel(minutos);
  return (
    <>
      <span>{numero}. </span>
      <span style={color ? { color, fontWeight: 700 } : undefined}>{titulo}</span>
      {m && <span>{"  " + m}</span>}
    </>
  );
}

// Ítem fijo (Canción/Palabras) con bullet, todo en el color de su sección.
function Bullet({ titulo, minutos, color }: { titulo: string; minutos?: number | null; color: string }) {
  const m = minsLabel(minutos ?? null);
  return (
    <span style={{ color, fontWeight: 700 }}>
      • {titulo}
      {m && "  " + m}
    </span>
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
          <div className="ps-gris">
            <b>Presidente:</b> {w.presidente ?? ""}
          </div>
          <div className="ps-gris">
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
              <Bullet titulo={`Canción ${w.cancionInicio ?? ""}`.trim()} color={GRIS} />
            </td>
            <td colSpan={2} className="ps-gris">
              <b>Oración:</b> {w.oracionInicio ?? ""}
            </td>
          </tr>
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={4}>
              <Bullet titulo="Palabras de introducción" minutos={1} color={GRIS} />
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
                <NumTitulo numero={w.tesoros.discurso.numero} titulo={w.tesoros.discurso.titulo} minutos={w.tesoros.discurso.minutos} />
              </td>
              <td />
              <td>{w.tesoros.discurso.nombre ?? ""}</td>
            </tr>
          )}
          {w.tesoros.perlas && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td colSpan={2}>
                <NumTitulo numero={w.tesoros.perlas.numero} titulo="Busquemos perlas escondidas" minutos={w.tesoros.perlas.minutos} color={GRIS} />
              </td>
              <td />
              <td>{w.tesoros.perlas.nombre ?? ""}</td>
            </tr>
          )}
          {w.tesoros.lectura && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td>
                <NumTitulo numero={w.tesoros.lectura.numero} titulo="Lectura de la Biblia" minutos={w.tesoros.lectura.minutos} />
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
                <NumTitulo numero={p.numero} titulo={p.titulo} minutos={p.minutos} />
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
              <Bullet titulo={`Canción ${w.vida.cancion ?? ""}`.trim()} color={VINO} />
            </td>
          </tr>
          {w.vida.discursos.map((d) => (
            <tr key={d.numero}>
              <td className="ps-hora">0:00</td>
              <td colSpan={2}>
                <NumTitulo numero={d.numero} titulo={d.titulo} minutos={d.minutos} />
              </td>
              <td />
              <td>{d.nombre ?? ""}</td>
            </tr>
          ))}
          {w.vida.estudio && (
            <tr>
              <td className="ps-hora">0:00</td>
              <td>
                <NumTitulo numero={w.vida.estudio.numero} titulo="Estudio bíblico de la congregación" minutos={w.vida.estudio.minutos} />
              </td>
              <td className="ps-rol">Conductor/Lector:</td>
              <td colSpan={2}>{[w.vida.estudio.conductor, w.vida.estudio.lector].filter(Boolean).join(" / ")}</td>
            </tr>
          )}
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={4}>
              <Bullet titulo="Palabras de conclusión" minutos={3} color={VINO} />
            </td>
          </tr>
          <tr>
            <td className="ps-hora">0:00</td>
            <td colSpan={2}>
              <Bullet titulo={`Canción ${w.vida.cancionFinal ?? ""}`.trim()} color={VINO} />
            </td>
            <td colSpan={2} className="ps-gris">
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
