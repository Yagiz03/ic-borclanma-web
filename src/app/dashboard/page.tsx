import { redirect } from "next/navigation";

// Orijinal Streamlit uygulamasında ayrı bir "Özet" sayfası yok --
// varsayılan açılış sayfası İhale Detay. /dashboard'a gelen istekler
// (giriş sonrası, logo tıklaması) doğrudan oraya yönlendirilir.
export default function DashboardKok() {
  redirect("/dashboard/ihale-detay");
}
