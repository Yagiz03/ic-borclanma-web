#!/usr/bin/env node
/**
 * Sayfa duman (smoke) testi -- "build geçti ama sayfa boş" sınıfını yakalar.
 *
 * `npm run build` yalnızca DERLENİYOR mu diye bakar; bir Supabase sorgusu
 * düşerse ya da bir sütun adı değişirse sayfa derlenir, deploy olur ve
 * KULLANICIYA BOŞ (veya hata kutulu) gelir. Bu script her rotayı gerçekten
 * çekip üç şeyi doğruluyor:
 *   1. HTTP 200,
 *   2. sayfaya ÖZGÜ bir imza metni HTML'de var (yani içerik gerçekten
 *      basılmış, sadece kabuk değil),
 *   3. hata sınırı ("Bu sayfa yüklenemedi") ya da Next.js'in kendi hata
 *      ekranı YOK ve gövde makul büyüklükte.
 *
 * İmzalar sunucuda basılan metinlerden seçildi. Yalnızca istemcide üretilen
 * şeyler (Recharts eksen etiketleri, koşullu bildirimler) BİLEREK
 * kullanılmadı -- sunucu HTML'inde hiç görünmedikleri için testi sonsuza
 * kadar kırmızı yaparlardı.
 *
 * Kullanım:
 *   node scripts/duman-testi.mjs                     # canlı site
 *   node scripts/duman-testi.mjs http://localhost:3000
 */

const TEMEL = (process.argv[2] ?? "https://tahvil.vercel.app").replace(/\/$/, "");

/**
 * [rota, sayfaya özgü imza, en az kaç bayt gövde beklenir]
 *
 * imza `null` ise yalnızca "200 döndü ve hata ekranı yok" kontrol edilir --
 * /dashboard kendi içeriği olmayan bir yönlendirme kabuğu (İhale Detay'a
 * gider) ve Next bunu istemci tarafında yaptığı için sunucu HTML'inde hedef
 * sayfanın içeriği HENÜZ yok.
 */
const ROTALAR = [
  ["/dashboard", null, 8_000],
  ["/dashboard/ihale-detay", "Piyasadan İhale Yoluyla", 40_000],
  ["/dashboard/ihale-gunu", "İhale günü", 40_000],
  ["/dashboard/dibs-detay", "DİBS Detay", 40_000],
  ["/dashboard/getiri-egrisi", "Getiri eğrisi", 100_000],
  ["/dashboard/pricing", "Bono ve Getiri Hesaplayıcı", 20_000],
  ["/dashboard/tcmb", "TCMB", 100_000],
  ["/dashboard/hazine", "Borç Stoku", 20_000],
  ["/dashboard/takasbank-tpp", "Takasbank", 20_000],
  ["/dashboard/ozel-sektor", "Özel sektör", 100_000],
  ["/dashboard/strateji", "Borçlanma stratejisi", 8_000],
  ["/dashboard/takvim", "Takvim", 20_000],
  ["/dashboard/deneysel", "Deneysel", 100_000],
];

/** Sayfanın çöktüğünü gösteren işaretler. */
const HATA_IZLERI = [
  "Bu sayfa yüklenemedi", // src/app/dashboard/error.tsx
  "Application error",    // Next.js istemci hata ekranı
  "This page could not be found",
];

async function rotaKontrol([rota, imza, enAzBayt]) {
  const url = `${TEMEL}${rota}`;
  let yanit;
  try {
    yanit = await fetch(url, { redirect: "follow" });
  } catch (e) {
    return { rota, ok: false, neden: `istek başarısız: ${e.message}` };
  }

  const html = await yanit.text();
  const bayt = Buffer.byteLength(html);

  if (yanit.status !== 200) return { rota, ok: false, neden: `HTTP ${yanit.status}`, bayt };

  const hata = HATA_IZLERI.find((h) => html.includes(h));
  if (hata) return { rota, ok: false, neden: `hata ekranı: "${hata}"`, bayt };

  if (imza && !html.includes(imza)) {
    return { rota, ok: false, neden: `imza yok: "${imza}"`, bayt };
  }

  if (bayt < enAzBayt) {
    return { rota, ok: false, neden: `gövde çok küçük (${bayt} < ${enAzBayt} bayt)`, bayt };
  }

  return { rota, ok: true, bayt };
}

const sonuclar = await Promise.all(ROTALAR.map(rotaKontrol));

console.log(`Duman testi -- ${TEMEL}\n`);
for (const s of sonuclar) {
  const boyut = s.bayt != null ? `${(s.bayt / 1024).toFixed(0).padStart(5)} KB` : "     –   ";
  console.log(`${s.ok ? "✓" : "✗"} ${s.rota.padEnd(28)} ${boyut}  ${s.ok ? "" : s.neden}`);
}

const dusen = sonuclar.filter((s) => !s.ok);
console.log(`\n${sonuclar.length - dusen.length}/${sonuclar.length} sayfa geçti.`);
process.exit(dusen.length ? 1 : 0);
