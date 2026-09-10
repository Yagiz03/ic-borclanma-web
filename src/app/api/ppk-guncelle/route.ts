/**
 * PPK karar farkı raporunu ELLE tetikler: ic-borclanma-dashboard
 * reposundaki "PPK karar farki" workflow'unu (ppk-karar-farki.yml)
 * workflow_dispatch ile çalıştırır.
 *
 * Workflow son iki karar metnini indirip fark PDF'ini üretiyor ve
 * "ppk-raporlari" Supabase Storage kovasına yüklüyor; sayfa kovadaki en
 * yeni dosyayı gösterdiği için başka bir adım gerekmiyor.
 *
 * Neden cron değil: PPK yılda 8 kez ve düzensiz aralıklarla toplanıyor --
 * karar günü tek tıkla tetiklemek günlük boş çalışmadan doğru.
 *
 * GITHUB_DISPATCH_TOKEN: /api/ost-guncelle ile AYNI Vercel ortam değişkeni
 * (Actions: write yetkili fine-grained PAT, aynı repo). Yalnızca sunucuda
 * okunur, tarayıcıya hiç gitmez.
 */

const REPO = "Yagiz03/ic-borclanma-dashboard";
const WORKFLOW = "ppk-karar-farki.yml";
const GH = "https://api.github.com";
/** Patlama koruması: endpoint herkese açık ve her çağrı bir Actions
 *  çalışması başlatıyor. GitHub'ın runs API'si yeni çalışmayı birkaç saniye
 *  gecikmeyle gösterdiği için "zaten çalışıyor" kontrolü tek başına yetmez. */
const PATLAMA_KORUMASI_SN = 45;

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
          { durum: "zaten_calisiyor", mesaj: "Rapor şu an zaten üretiliyor.", url: son.html_url },
          { status: 409 },
        );
      }
      const gecenSn = (Date.now() - new Date(son.created_at).getTime()) / 1000;
      if (gecenSn < PATLAMA_KORUMASI_SN) {
        return Response.json(
          {
            durum: "cok_sik",
            mesaj: "Az önce başlatıldı, birkaç saniye içinde çalışmaya başlar.",
            url: son.html_url,
          },
          { status: 429 },
        );
      }
    }
  }
  // "Bugün çalıştı, basma" kuralı YOK: OST'un aksine burada günlük bir veri
  // penceresi yok, karar metni TCMB'de gecikmeli görünebiliyor -- kullanıcı
  // aynı gün tekrar denemek isteyebilir.

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
    mesaj: "Rapor üretiliyor. 1-2 dakika sonra sayfayı yenile.",
  });
}
