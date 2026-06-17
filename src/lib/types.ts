// Tipos que comparten cliente y servidor (lo que devuelve la API en JSON).

export interface Role {
  id: string;
  nombre: string;
  color: string;
  active: boolean;
}

export interface Person {
  id: string;
  nombre: string;
  apellido: string;
  active: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface RecordItem {
  id: string;
  asignadoId: string;
  asignado: string; // nombre completo (derivado)
  ayudanteId: string | null;
  ayudante: string | null; // nombre completo (derivado) o null
  fecha: string; // YYYY-MM-DD
  sala: string | null;
  tipo: string; // "Asignado" cuando hay ayudante, "" si no (derivado)
  asignacion: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
