/**
 * Sayı ve yüzde biçimlendirme — TEK KAYNAK.
 *
 * Neden merkezi: her sayfa kendi yardımcısını yazmıştı ve iki farklı gelenek
 * yan yana çıkıyordu. `toFixed()` yerelden bağımsız NOKTA üretiyor (`%35.12`),
 * `toLocaleString("tr-TR")` ise VİRGÜL (`281,9`) -- aynı tablo satırında ikisi
 * birden görünüyordu. Buradaki fonksiyonların hepsi tr-TR: ondalık ayracı
 * virgül, binlik ayracı nokta.
 *
 * Yüzde işareti ÖNDE (`%35,12`) -- Türkçe yazım kuralı ve uygulamanın
 * tablolarındaki mevcut gelenek.
 */

/** Veri olmadığında tablolarda ve kartlarda gösterilen işaret. */
export const BOS = "–";

function sayiyaCevir(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Ondalık basamağı sabit sayı: `1.234,50`. */
export function sayi(v: number | string | null | undefined, ondalik = 2): string {
  const n = sayiyaCevir(v);
  return n == null
    ? BOS
    : n.toLocaleString("tr-TR", { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik });
}

/** En fazla `ondalik` basamak, gereksiz sıfır yazmaz: `1.234,5` / `1.235`. */
export function sayiEsnek(v: number | string | null | undefined, ondalik = 2): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : n.toLocaleString("tr-TR", { maximumFractionDigits: ondalik });
}

/** Yüzde, işaret ÖNDE ve ondalık VİRGÜLLE: `%35,12`. */
export function yuzde(v: number | string | null | undefined, ondalik = 2): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : `%${sayi(n, ondalik)}`;
}

/** İşaretli baz puan: `+86 bps` / `-364 bps`. */
export function bps(v: number | string | null | undefined, ondalik = 0): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : `${n >= 0 ? "+" : ""}${sayi(n, ondalik)} bps`;
}

/**
 * Para birimi kısaltmaları. Uygulamada aynı büyüklük üç ayrı birimle
 * yazılıyordu ("725 Mn TL", "40,0 Milyon", "40.000 Bin TL") -- sözlük burada
 * tekilleştirildi.
 */
export function milyonTl(v: number | string | null | undefined, ondalik = 0): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : `${sayi(n, ondalik)} Mn TL`;
}

export function milyarTl(v: number | string | null | undefined, ondalik = 1): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : `${sayi(n, ondalik)} Mlr TL`;
}

/** Ham TL tutarı: `245.848.127 TL`. */
export function tl(v: number | string | null | undefined, ondalik = 0): string {
  const n = sayiyaCevir(v);
  return n == null ? BOS : `${sayi(n, ondalik)} TL`;
}
