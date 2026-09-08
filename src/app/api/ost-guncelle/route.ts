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

const REPO = "Yagiz03/ic-borclanma-dashboard";
const WORKFLOW = "update-ost.yml";
const GH = "https://api.github.com";
/** İki tetikleme arasında beklenmesi gereken süre (dk). Endpoint herkese açık
 *  olduğu için kötüye kullanımı ve boşuna Actions dakikası harcanmasını
 *  engelliyor; ayrıca "zaten çalışıyor" durumunu kullanıcıya söylüyor. */
const BEKLEME_DK = 5;

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

  // Son çalışmaya bak: hâlâ sürüyorsa ya da az önce başladıysa yenisini açma.
  const sonlar = await fetch(
    `${GH}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
    { headers: baslıklar(token), cache: "no-store" },
  );
  if (sonlar.ok) {
    const { workflow_runs: kosular } = (await sonlar.json()) as {
      workflow_runs: { status: string; created_at: string; html_url: string }[];
    };
    const son = kosular?.[0];
    if (son) {
      if (son.status !== "completed") {
        return Response.json(
          { durum: "zaten_calisiyor", mesaj: "Güncelleme şu an zaten çalışıyor.", url: son.html_url },
          { status: 409 },
        );
      }
      const gecenDk = (Date.now() - new Date(son.created_at).getTime()) / 60_000;
      if (gecenDk < BEKLEME_DK) {
        return Response.json(
          {
            durum: "cok_erken",
            mesaj: `Az önce güncellendi. ${Math.ceil(BEKLEME_DK - gecenDk)} dk sonra tekrar deneyebilirsin.`,
            url: son.html_url,
          },
          { status: 429 },
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

  return Response.json({
    durum: "baslatildi",
    mesaj: "Güncelleme başlatıldı. Veriler 2-3 dakika içinde tazelenir.",
  });
}
