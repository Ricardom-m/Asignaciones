import { redirect } from "next/navigation";

// La raíz redirige al dashboard; el middleware ya garantiza la sesión.
export default function Home() {
  redirect("/inicio");
}
