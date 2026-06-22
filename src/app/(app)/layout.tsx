import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ensureMeetingWindowThrottled } from "@/lib/meetings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Mantiene llenas las fechas de reunión: como mucho una vez cada 3 días al
  // abrir la app (no en cada navegación). Silencioso si falla.
  await ensureMeetingWindowThrottled().catch(() => {});

  return (
    <AppShell
      user={{
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? "",
        isAdmin: !!session.user.isAdmin,
      }}
    >
      {children}
    </AppShell>
  );
}
