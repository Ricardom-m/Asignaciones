// Tipos que comparten cliente y servidor (lo que devuelve la API en JSON).

export interface Role {
  id: string;
  nombre: string;
  color: string;
  active: boolean;
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
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
