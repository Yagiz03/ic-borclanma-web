/**
 * İki satırlı tablo sütun başlığı: üstte ad, altında birim.
 *
 * Başlıklar `whitespace-nowrap` olduğu için "TOPLAM GERÇEKLEŞME (MN TL)" gibi
 * uzun bir başlık tek satırda 217 piksel yer kaplıyor ve altındaki kısa sayıyı
 * ("74.427") o genişliğe zorluyordu. Birim ikinci satıra alınınca sütunun
 * genişliğini iki satırdan GENİŞ OLANI belirliyor -- tablo daralıyor, ISIN ve
 * senet tanımı gibi metin sütunlarına yer kalıyor.
 */
export function KolonBasligi({ ust, alt }: { ust: string; alt?: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span>{ust}</span>
      {alt && (
        <span className="text-[10px] font-normal tracking-normal normal-case opacity-70">
          {alt}
        </span>
      )}
    </span>
  );
}
