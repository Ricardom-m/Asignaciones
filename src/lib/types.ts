// Tipos que comparten cliente y servidor (lo que devuelve la API en JSON).

export interface Role {
  id: string;
  nombre: string;
  color: string;
  active: boolean;
}

export interface Section {
  id: string;
  nombre: string;
  orden: number;
  active: boolean;
  sinAyudante: boolean; // true = parte de una sola persona (sin ayudante)
}

export interface Meeting {
  id: string;
  fecha: string; // YYYY-MM-DD
  nota: string | null;
}

export interface AllowedUser {
  id: string;
  email: string;
  nombre: string | null;
  createdAt: string;
}

export interface MeetingConfig {
  weekdays: number[]; // 0=Dom … 6=Sáb
  weeks: number;
}

export type Genero = "H" | "M";

export interface Person {
  id: string;
  nombre: string;
  apellido: string;
  genero: Genero | null;
  active: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface RosterPerson {
  id: string;
  nombre: string; // nombre completo
  genero: Genero | null;
  roles: Role[];
  lastFecha: string | null; // última participación antes de la fecha objetivo
  daysSince: number | null;
  countMonth: number; // participaciones en el mes de la fecha objetivo
  countRecent: number; // participaciones en los últimos 60 días
  assignedOnTarget: boolean; // ya asignado(a) en la fecha objetivo
}

export type RecordTipo = "ASIGNACION" | "NOMBRADO";

export interface RecordItem {
  id: string;
  asignadoId: string;
  asignado: string; // nombre completo (derivado)
  ayudanteId: string | null;
  ayudante: string | null; // nombre completo (derivado) o null
  fecha: string; // YYYY-MM-DD
  sala: string | null;
  tipo: RecordTipo; // categoría: Asignación o Nombrado
  asignacion: string;
  minutos: number | null; // duración en minutos
  orden: number; // posición en el planificador
  sectionId: string | null;
  section: string | null; // nombre de la sección (derivado) o null
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
