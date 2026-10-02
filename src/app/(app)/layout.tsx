import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { COMMON_NAV, NAV } from "@/lib/nav";
import { apiGet, requireSession } from "@/lib/server";

// Todo lo que esta dentro de (app) exige sesion y se dibuja con el menu del rol del usuario
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const me = await apiGet<{ name: string }>("/users/me");

  return (
    <AppShell name={me.name} role={session.role} items={NAV[session.role]} common={COMMON_NAV}>
      {children}
    </AppShell>
  );
}
