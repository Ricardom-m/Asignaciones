import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UsuariosClient } from "./UsuariosClient";

// Solo administradores (correo en AUTHORIZED_EMAILS) pueden gestionar usuarios.
export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/inicio");
  return <UsuariosClient />;
}
