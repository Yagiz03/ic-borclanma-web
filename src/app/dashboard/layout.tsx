import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { GeciciHesapUyarisi } from "@/components/gecici-hesap-uyarisi";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  return <AppShell ustBant={user.is_anonymous ? <GeciciHesapUyarisi /> : null}>{children}</AppShell>;
}
