import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const adSoyad = (user.user_metadata?.ad_soyad as string) ?? "";
  const email = (user.user_metadata?.email as string) ?? user.email ?? "";

  return (
    <AppShell adSoyad={adSoyad} email={email}>
      {children}
    </AppShell>
  );
}
