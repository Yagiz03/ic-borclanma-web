# Türkiye Tahvil ve Bono Terminali

Türkiye Hazine iç borçlanma senetleri (DİBS) ve özel sektör tahvilleri (ÖST)
için ISIN-merkezli bir web terminali. Canlı: <https://tahvil.vercel.app>

Bu depo, aynı ürünün Streamlit sürümünün ([`ic-borclanma-dashboard`](https://github.com/Yagiz03/ic-borclanma-dashboard))
Next.js'e taşınmış hâlidir. Veri toplama katmanı hâlâ o depoda çalışır; burası
yalnızca okuma ve gösterme katmanıdır.

## Mimari

```
HMB / TCMB / BIST  →  ic-borclanma-dashboard (Python, gece GitHub Actions)
                          ├─ archive/*.csv        (ham veri, git'e commit'lenir)
                          ├─ ic_borclanma.db      (SQLite, Streamlit için)
                          └─ supabase_yukle.py    → Supabase Postgres
                                                        ↓
                                              BU DEPO (Next.js, Vercel)
```

Site hiçbir zaman dış bir siteye canlı istek atmaz; tüm veriyi Supabase'ten
okur. Sayfaların çoğu React Server Component'tir — veri sunucuda çekilir,
tarayıcıya yalnızca etkileşimli parçalar iner.

**Önemli:** Supabase'e yazan tek şey gece pipeline'ıdır (`service_role`
anahtarı GitHub Actions secret'ında durur). Bu depo yalnızca **public anon**
anahtarını kullanır. Tek istisna kullanıcıya özel tablolardır (aşağıya bakın).

## Sayfalar

- **İhale Detay** (açılış) — finansman programı ilerlemesi, bu ayın ihaleleri, kalan ihaleler, TCMB doğrudan alım grafikleri. Tabloda bir satıra tıklayınca o ihalenin HMB basın duyurusu (PDF) açılır.
- **DİBS Detay** — tek kağıdın künyesi, BIST fiyat/getiri grafikleri, ihale öncesi basın duyurusu, tüm ihale geçmişi (eski HMB arşivleri dahil), TCMB doğrudan alım geçmişi // alt sekmeler **Düzenli İşlem Gören**, **Karşılaştır**
- **Getiri eğrisi** — kalan vadeye göre bileşik getiri, geçmiş günlerle karşılaştırma, spread paneli, z-skoru ve Nelson-Siegel RV ekranları
- **Bono ve Getiri Hesaplayıcı** — sabit kuponlu/kuponsuz, TLREF'e endeksli, TÜFE'ye endeksli ve Değişken Faizli DİBS için fiyat ↔ getiri, kupon, birikmiş faiz, duration/DV01/konveksite; Takas/Mevduat → O/N // alt sekme **P&L** (ve **İzleme listesi**)
- **İhale günü** — ayın ihale dağılım tahmini, concession modeliyle getiri tahmini // **Emirlerim**, **İhale sonrası performans**
- **Özel sektör tahvilleri** — ÖST günlük işlemleri (anomali uyarılarıyla), ihraççı profili
- **TCMB** — DİBS piyasa değeri ve sahiplik oranları, APİ Portföyü, TÜFE/M2/KFE, repo faiz koridoru, TLREF, rezervler/dış denge, piyasa beklentileri, PPK karar farkı, Enflasyon Raporu
- **Hazine** — Borç Stoku/Nakit, İç Borç Çevirme Oranı, Ortalama Vade/Maliyet
- **TPP** — Takasbank Para Piyasası oran/hacim serisi ve vade yapısı
- **Borçlanma stratejisi** — HMB strateji duyurularının fark raporu (PDF)
- **Takvim** — TCMB + HMB ihraç takvimi + Fed/ECB/BOJ/BOE/ABD CPI-PPI

Panele girişte sağ üstte, o haftanın takvim olaylarını özetleyen 15 saniyelik
bir bildirim çıkar.

## Kod tabanı

```
src/app/dashboard/<sayfa>/   # her sayfa kendi klasöründe (page.tsx sunucu, *-client/-tab istemci)
src/components/              # sayfalar arası paylaşılan UI (ozet-serit, bos-durum, zaman-araligi, global-arama)
src/components/ui/           # shadcn tabanlı temel bileşenler
src/lib/                     # veri erişimi ve saf hesaplar
src/lib/bond-math/           # tahvil matematiği (Python portu -- aşağıya bakın)
src/lib/__tests__/           # golden ve birim testler + fixtures/
scripts/rls-dogrula.mjs      # RLS yalıtım kontrolü (npm run rls)
```

### Tahvil matematiği ve golden testler

`src/lib/bond-math/` Python'daki `tahvil_fiyatlama.py`'nin portudur:
`tahvil-fiyatlama.ts` sabit kuponlu/kuponsuz çekirdeği, `floater.ts` TLREF'e
endeksli / Değişken Faizli / TÜFE'ye endeksli formülleri.

Bu dosyalardaki hesap mantığı **golden test olmadan değiştirilmemeli**.
Fixture'lar Python'un GERÇEK çıktısından üretilir (`src/lib/__tests__/fixtures/`),
testler TS çıktısını 8-12 ondalık basamağa kadar ona karşı doğrular. Aynı
yaklaşım Nelson-Siegel, takas/repo, TLREF senaryosu ve ihale emir özeti için
de kullanılıyor.

### Kullanıcıya özel veri ve RLS

`watchlist`, `positions`, `auction_tracks`, `auction_orders` tabloları
`auth.uid()`'ye bağlıdır ve RLS ile korunur. Giriş/kayıt ekranı (`/giris`)
kodda duruyor ama **devrede değil**: açılış sayfası sessizce anonim (misafir)
oturum açıyor. Panel oturum zorunlu tutmaz — oturum kurulamazsa veriler yine
görünür, yalnızca kişisel özellikler kapanır ve bir uyarı şeridi çıkar.

`npm run rls` iki ayrı misafir oturumu açıp tabloların birbirinden gerçekten
yalıtıldığını doğrular (ağ gerektirir, `npm test`in parçası değildir).

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` iki değişken ister:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Elle veri güncelleme butonunun (Özel sektör sayfası) çalışması için Vercel'de
ayrıca `GITHUB_DISPATCH_TOKEN` tanımlıdır — Actions:write yetkili, yalnızca
sunucuda okunan bir fine-grained PAT.

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi + tip kontrolü |
| `npm test` | Vitest (golden + birim + bileşen render testleri) |
| `npm run lint` | ESLint (React Compiler kuralları dahil) |
| `npm run rls` | Supabase RLS yalıtım kontrolü |

## Bilinen sınırlar

- **Deneysel sayfası taşınmadı** (Trade Ekranı, Carry/Roll, İhale Konsesyonu).
- Bazı eski kağıtların ihale geçmişi eksik: HMB'nin makine okunabilir duyuru
  arşivi ~2019'da başlıyor, öncesi yalnızca HTML/OCR arşivlerinden geliyor ve
  o satırlarda oran/tutar dökümü yok ("arşiv" rozetiyle işaretli).
- `evds_seriler.tufe_duzey` (2003 tabanlı TÜFE) Ocak 2026'da durdu; güncel
  veri 2025 tabanlı seriden geliyor ve iki taban `tufe-zincir.ts` ile
  zincirleniyor.
- Gece pipeline'ı GitHub Actions `schedule` tetikleyicisine bağlı; bu
  tetikleyici saatlerce gecikebiliyor.
