@AGENTS.md

# Türkiye Tahvil ve Bono Terminali — proje kuralları

Genel bakış, mimari ve sayfa listesi için `README.md`.

## Dokunmadan önce oku

- **`src/lib/bond-math/`** — `tahvil_fiyatlama.py`'nin portu. Buradaki hesap
  mantığı, karşılığı olan golden test güncellenmeden DEĞİŞTİRİLMEZ. Fixture'lar
  Python'un gerçek çıktısından üretilir; TS sonucu 8-12 ondalık basamağa kadar
  ona eşit olmalı. Aynı kural `rv-analiz.ts`, `takas-repo.ts`, `tufe-zincir.ts`
  ve `ihale-emir.ts` için de geçerli.
- **Veri eksikse önce senkron listesine bak.** Supabase'de bir kolon/tablo boş
  görünüyorsa neredeyse her zaman sebebi, Python tarafındaki
  `supabase_yukle.py::SENKRON_TABLOLARI` listesinde o kolonun/tablonun
  olmamasıdır — kod tarafında değil. Bu hata bu projede birden fazla kez çıktı.

## Supabase

- Bu depo **yalnızca public anon** anahtarını kullanır. `service_role` anahtarı
  yalnızca GitHub Actions secret'ında durur; buraya asla girmez.
- PostgREST tek sorguda **en fazla 1000 satır** döner. Daha büyük tablolarda
  `lib/supabase-sayfali.ts::tumSatirlariGetir` kullanılmalı — düz `.select()`
  sessizce keser (TCMB grafiklerinde yaşandı).
- Tarih kolonları `text` ve iki biçim karışık ("DD.MM.YYYY" ve ISO). Metin
  olarak sıralamak kronolojik olarak YANLIŞ; hep `lib/tarih.ts` kullan.
- Kullanıcıya özel tablolar RLS ile korunur; değiştirdikten sonra `npm run rls`.

## Next.js / React

- Varsayılan sunucu bileşeni; `"use client"` yalnızca etkileşim gerektiğinde.
- React Compiler lint kuralları açık ve **hata** seviyesinde:
  - Efekt gövdesinde senkron `setState` yok (zamanlayıcı/olay içinden olur).
  - `Date.now()` render sırasında saf değil — `new Date().getTime()` kullan.
  - `useMemo` bağımlılığı olacak Date/dizi/nesne render'da yeniden
    üretilmemeli; ISO string gibi ilkel bir değere bağla.
  - **Elle `useMemo` yazmadan önce iki kez düşün.** Derleyici zaten memoluyor;
    elle yazılan memo bazen doğrulanamayıp `Compilation Skipped: Existing
    memoization could not be preserved` hatası veriyor ve o bileşen HİÇ
    optimize edilmeden geçiyor — yani elle memo, tersine sonuç doğuruyor.
    Bu hatayı görürsen çözüm `useMemo`yu kaldırıp düz hesaplamaya dönmek
    (getiri eğrisi eksen hesabında ve `spreadVerisi` çevresinde yaşandı).
- Grafiklerde renkler CSS değişkenlerinden (`var(--chart-N)`) gelir, sabit
  hex değil — koyu mod bozulmasın diye.
- Grid/flex çocuklarında geniş içerik (tablo, grafik) varsa `min-w-0`; yoksa
  kap içeriğe göre büyüyüp taşar.

## Veri gösterimi

- **İtfa olmuş kağıtlar listelenmez.** Kağıt seçtiren her yüzey (DİBS Detay,
  Karşılaştır, Pricing, P&L formu, global arama) vadesi geçmişleri süzer.
  İzleme listesi istisna: kullanıcının kendi eklediği kayıt sessizce yok
  sayılmaz, ana listeden çıkıp altta "itfa olduğu için düştü" satırında
  çıkarılabilir olarak durur.
- Sayı/yüzde biçimlendirmesi `lib/bicim.ts`, grafik ekseni `lib/eksen.ts`
  üzerinden. Bileşen içinde yeni bir `toFixed`/`toLocaleString` yardımcısı
  yazma — biçim tutarsızlığı bu şekilde başlamıştı.

## Doğrulama

Göndermeden önce: `npm run build` (tip kontrolü dahil), `npm test`,
`npx eslint src`. Build çıktısını `grep`'e boğma — çıkış kodunu kontrol et
(`npm run build > /dev/null 2>&1 && echo OK || echo KIRIK`); aksi halde tip
hatası veren bir derlemeyi başarılı sanabiliyorsun.

Deploy beklerken `curl | grep` kullanıyorsan, aradığın dizenin YALNIZCA yeni
sürümde bulunduğundan emin ol ve sunucudan gelen HTML'de gerçekten var olsun —
istemcide çizilen şeyler (Recharts eksen etiketleri, koşullu render edilen
bildirimler) sunucu HTML'inde yoktur, döngü sonsuza kadar bekler. Görsel bir değişiklik yaptıysan canlıda/preview'da gerçek
veriyle bak — ekran görüntüsü olmadan "çalışıyor" deme.
