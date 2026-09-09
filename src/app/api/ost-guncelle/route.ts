/**
 * Özel sektör (OST) veri güncellemesini ELLE tetikler: ic-borclanma-dashboard
 * reposundaki "OST veri guncelleme" workflow'unu (update-ost.yml)
 * workflow_dispatch ile çalıştırır.
 *
 * Neden gerekiyor: workflow'un kendi cron'u 15:16 TR'ye ayarlı ama GitHub'ın
 * `schedule:` tetikleyicisi "best effort" -- bu repoda gözlenen gecikme
 * saatlerce olabiliyor, bazen gün tamamen atlanıyor. workflow_dispatch ise
 * ANINDA çalışıyor.
 *
 * GITHUB_DISPATCH_TOKEN: Vercel ortam değişkeni (Actions: write yetkili bir
 * fine-grained PAT). Yalnızca sunucuda okunur, tarayıcıya hiç gitmez.
 */

import { revalidateTag } from "next/cache";
import { VERI_ETIKETI } from "@/lib/veri-onbellek";

const REPO = "Yagiz03/ic-borclanma-dashboard";
const WORKFLOW = "update-ost.yml";
const GH = "https://api.github.com";
/** Günlük veri penceresinin açıldığı an: 12:16 UTC = 15:16 TR (update-ost.yml
 *  cron'uyla aynı; BIST'in 14:00 ara bülteni ~15:15 TR'de yayımlanıyor).
 *  Bu saatten SONRA başarılı bir çalışma olduysa günün verisi alınmış
 *  demektir -- tekrar tetiklemek gereksiz. */
const PENCERE_UTC_SAAT = 12;
const PENCERE_UTC_DAKIKA = 16;
/**
 * Patlama (burst) koruması. Endpoint herkese açık ve her çağrı bir GitHub
 * Actions çalışması başlatıyor. "Zaten çalışıyor" kontrolü tek başına yetmez:
 * GitHub'ın runs API'si yeni çalışmayı birkaç saniye gecikmeyle gösterdiği
 * için aynı anda gönderilen onlarca istek onlarca çalışma başlatabilir.
 * Son çalışmadan bu yana bu kadar saniye geçmediyse yenisi açılmıyor.
 *
 * Kullanıcıya dönük bekleme kuralı DEĞİL (o kaldırılmıştı) -- sadece
 * saniyeler mertebesinde bir yarış penceresini kapatıyor.
 */
const PATLAMA_KORUMASI_SN = 45;

/** Bugünkü veri penceresinin başlangıcı (UTC). Henüz o saate gelinmediyse
 *  null döner -- o zaman "bugün güncellendi" kuralı işletilmez. */
function bugunkuPencereBaslangici(simdi: Date): Date | null {
  const pencere = new Date(simdi);
  pencere.setUTCHours(PENCERE_UTC_SAAT, PENCERE_UTC_DAKIKA, 0, 0);
  return simdi >= pencere ? pencere : null;
}

function baslıklar(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function POST() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return Response.json(
      { hata: "Sunucuda GITHUB_DISPATCH_TOKEN tanımlı değil — tetikleme kapalı." },
      { status: 503 },
    );
  }

  // Son çalışmaya bak: hâlâ sürüyorsa ya da günün verisi alınmışsa yenisini açma.
  const sonlar = await fetch(
    `${GH}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
    { headers: baslıklar(token), cache: "no-store" },
  );
  if (sonlar.ok) {
    const { workflow_runs: kosular } = (await sonlar.json()) as {
      workflow_runs: {
        status: string;
        conclusion: string | null;
        created_at: string;
        html_url: string;
      }[];
    };
    const son = kosular?.[0];
    if (son) {
      if (son.status !== "completed") {
        return Response.json(
          { durum: "zaten_calisiyor", mesaj: "Güncelleme şu an zaten çalışıyor.", url: son.html_url },
          { status: 409 },
        );
      }
      const gecenSn = (Date.now() - new Date(son.created_at).getTime()) / 1000;
      if (gecenSn < PATLAMA_KORUMASI_SN) {
        return Response.json(
          {
            durum: "cok_sik",
            mesaj: "Güncelleme az önce başlatıldı, birkaç saniye içinde çalışmaya başlar.",
            url: son.html_url,
          },
          { status: 429 },
        );
      }

      // Günün verisi zaten alınmışsa (15:16 TR'den sonra başarıyla çalışmış)
      // tekrar tetiklemeye gerek yok.
      const pencere = bugunkuPencereBaslangici(new Date());
      if (pencere && son.conclusion === "success" && new Date(son.created_at) >= pencere) {
        return Response.json(
          {
            durum: "bugun_guncellendi",
            mesaj: "Bugün güncellendi, basma.",
            url: son.html_url,
          },
          { status: 409 },
        );
      }

    }
  }

  const cevap = await fetch(`${GH}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...baslıklar(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });

  if (!cevap.ok) {
    const govde = await cevap.text();
    return Response.json(
      { hata: `GitHub tetiklemeyi reddetti (${cevap.status}). ${govde.slice(0, 200)}` },
      { status: 502 },
    );
  }

  // Sunucu önbelleği temizleniyor: workflow bitip Supabase'e yazdıktan sonra
  // sayfa hâlâ eski kopyayı sunarsa butona basmak hiçbir şey yapmamış gibi
  // görünürdü. (Workflow birkaç dakika sürdüğü için sayfa yenilendiğinde
  // önbellek zaten yeniden dolacak.)
  revalidateTag(VERI_ETIKETI, "max");

  return Response.json({
    durum: "baslatildi",
    mesaj: "Güncelleme başlatıldı. Veriler 2-3 dakika içinde tazelenir.",
  });
}
