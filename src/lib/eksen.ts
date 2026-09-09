/**
 * Grafik ekseni için "yuvarlak" sınır ve aralık hesabı.
 *
 * Neden: eksenler `domain={["dataMin - 0.5", "dataMax + 0.5"]}` ile veriden
 * türetiliyordu ve Recharts bunu olduğu gibi kullanıp okunmaz değerler
 * üretiyordu -- ör. getiri ekseninde `33.35 · 35.35 · 37.35 · 39.35 · 40.43`
 * (son aralık diğerlerinin yarısı). Burada klasik "nice numbers" yaklaşımıyla
 * 1 / 2 / 2.5 / 5 / 10 katlarına yuvarlanmış bir adım seçiliyor.
 */

/** Verilen ham adımı, okunabilir bir "yuvarlak" adıma çeker. */
function yuvarlakAdim(ham: number): number {
  if (ham <= 0 || !Number.isFinite(ham)) return 1;
  const buyukluk = Math.pow(10, Math.floor(Math.log10(ham)));
  const oran = ham / buyukluk;
  const carpan = oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 2.5 ? 2.5 : oran <= 5 ? 5 : 10;
  return carpan * buyukluk;
}

export type EksenAyari = { domain: [number, number]; ticks: number[] };

/**
 * `degerler`i kapsayan, yuvarlak sınırlı ve eşit aralıklı bir eksen döner.
 * Veri yoksa ya da tek bir değer varsa etrafına makul bir pay bırakır.
 */
export function yumusakEksen(degerler: number[], hedefAdet = 5): EksenAyari | null {
  const gecerli = degerler.filter((v) => Number.isFinite(v));
  if (gecerli.length === 0) return null;

  let enAz = Math.min(...gecerli);
  let enCok = Math.max(...gecerli);

  // Tek değer (ya da tamamen düz seri): etrafında yapay bir aralık aç,
  // yoksa adım 0 çıkıp sonsuz döngüye/boş eksene yol açar.
  if (enAz === enCok) {
    const pay = Math.abs(enAz) > 0 ? Math.abs(enAz) * 0.05 : 1;
    enAz -= pay;
    enCok += pay;
  }

  const adim = yuvarlakAdim((enCok - enAz) / Math.max(hedefAdet - 1, 1));
  const alt = Math.floor(enAz / adim) * adim;
  const ust = Math.ceil(enCok / adim) * adim;

  const ticks: number[] = [];
  // Kayan nokta birikimini engellemek için çarparak üretiliyor.
  const adet = Math.round((ust - alt) / adim);
  for (let i = 0; i <= adet; i++) {
    ticks.push(Number((alt + i * adim).toFixed(10)));
  }
  return { domain: [alt, ust], ticks };
}
