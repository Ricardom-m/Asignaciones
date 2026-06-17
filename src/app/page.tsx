import { redirect } from "next/navigation";

// La raíz redirige a la primera pestaña; el middleware ya garantiza la sesión.
export default function Home() {
  redirect("/nuevo");
}
