/**
 * ic-borclanma-dashboard reposundaki bir GitHub Actions workflow'unu
 * workflow_dispatch ile ANINDA calistirir.
 *
 * Neden ortak: PPK karar farki ve Strateji fark raporu ayni sekilde
 * tetikleniyor -- "zaten calisiyor" kontrolu ve patlama korumasi da ayni.
 * (/api/ost-guncelle bunu KULLANMIYOR: orada ek olarak gunluk veri
 * penceresi kurali var -- "bugun guncellendi, basma".)
 *
 * GITHUB_DISPATCH_TOKEN: Vercel ortam degiskeni (Actions: write yetkili
 * fine-grained PAT). Yalnizca sunucuda okunur, tarayiciya hic gitmez.
 */

const REPO = "Yagiz03/ic-borclanma-dashboard";
const GH = "https://api.github.com";
/**
 * Patlama (burst) korumasi. Uc herkese acik ve her cagri bir Actions
 * calismasi baslatiyor. "Zaten calisiyor" kontrolu tek basina yetmez:
 * GitHub'in runs API'si yeni calismayi birkac saniye gecikmeyle
 * gosterdigi icin ayni anda gonderilen istekler onlarca calisma
 * baslatabilir. Ust uste basmak bu yuzden zararsiz: ikinci basis ya
 * "zaten calisiyor" ya da "az once baslatildi" cevabi aliyor.
 */
const PATLAMA_KORUMASI_SN = 45;

type Kosu = { id: number; status: string; conclusion: string | null; created_at: string; html_url: string };

function baslıklar(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function sonKosu(token: string, workflow: string): Promise<Kosu | null> {
  const y = await fetch(`${GH}/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=1`, {
    headers: baslıklar(token),
    cache: "no-store",
  });
  if (!y.ok) return null;
  const { workflow_runs: kosular } = (await y.json()) as { workflow_runs: Kosu[] };
  return kosular?.[0] ?? null;
}

/**
 * Son calismanin durumu. Tus bunu yokluyor: eskiden sabit surelerde
 * (25/45 sn) sayfa yenileniyordu, yani rapor 17. saniyede hazir olsa bile
 * bekliyordun. Yoklamayla rapor DUSTUGU an gorunuyor.
 *
 * `oncekiId`: tetiklemeden ONCEKI calismanin kimligi. GitHub'in runs API'si
 * yeni calismayi birkac saniye gecikmeyle gosterdigi icin, ayni kimligi
 * gorurken "bitti" demiyoruz -- yoksa tus bir onceki calismanin sonucuna
 * bakip hemen "hazir" derdi.
 */
export async function workflowDurumu(workflow: string, oncekiId: number | null): Promise<Response> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return Response.json({ durum: "bilinmiyor" });

  const son = await sonKosu(token, workflow);
  if (!son) return Response.json({ durum: "bilinmiyor" });
  if (oncekiId != null && son.id === oncekiId) {
    return Response.json({ durum: "bekliyor", kosuId: son.id });
  }
  return Response.json({
    durum: son.status === "completed" ? "bitti" : "calisiyor",
    sonuc: son.conclusion,
    kosuId: son.id,
    url: son.html_url,
  });
}

export async function workflowTetikle(
  workflow: string,
  mesajlar: { calisiyor: string; baslatildi: string },
): Promise<Response> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return Response.json(
      { hata: "Sunucuda GITHUB_DISPATCH_TOKEN tanımlı değil — tetikleme kapalı." },
      { status: 503 },
    );
  }

  const son = await sonKosu(token, workflow);
  {
    if (son) {
      if (son.status !== "completed") {
        return Response.json(
          { durum: "zaten_calisiyor", mesaj: mesajlar.calisiyor, url: son.html_url },
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

  const cevap = await fetch(`${GH}/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
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

  // oncekiKosuId: tus bunu yoklamada kullaniyor (bkz. workflowDurumu).
  return Response.json({
    durum: "baslatildi",
    mesaj: mesajlar.baslatildi,
    oncekiKosuId: son?.id ?? null,
  });
}
