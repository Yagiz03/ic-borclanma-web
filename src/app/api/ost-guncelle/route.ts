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
/** Günlük veri penceresinin açıldığı an: 12:16 UTC = 15:16 TR (update-ost.yml
 *  cron'uyla aynı; BIST'in 14:00 ara bülteni ~15:15 TR'de yayımlanıyor).
 *  Bu saatten SONRA başarılı bir çalışma olduysa günün verisi alınmış
 *  demektir -- tekrar tetiklemek gereksiz. */
const PENCERE_UTC_SAAT = 12;
const PENCERE_UTC_DAKIKA = 16;

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
      {
        hata: "Sunucuda GITHUB_DISPATCH_TOKEN tanımlı değil — tetikleme kapalı.",
        // GEÇİCİ TEŞHİS: sadece anahtar İSİMLERİ (değer yok) -- isim yanlış mı
        // yoksa değişken bu ortama (Production) hiç tanımlanmamış mı ayırt
        // etmek için. Teşhis bitince kaldırılacak.
        teshis: {
          benzerAnahtarlar: Object.keys(process.env).filter((k) => /GIT|HUB|DISPATCH|TOKEN|PAT/i.test(k)),
          ortam: process.env.VERCEL_ENV ?? null,
        },
      },
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

  return Response.json({
    durum: "baslatildi",
    mesaj: "Güncelleme başlatıldı. Veriler 2-3 dakika içinde tazelenir.",
  });
}
