import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OzetSerit } from "@/components/ozet-serit";
import { BosDurum } from "@/components/bos-durum";
import { KolonBasligi } from "@/components/kolon-basligi";
import { SenetBadge } from "@/components/senet-badge";
import { MobilKartListesi } from "@/components/mobil-kart-listesi";
import { bps, sayi, yuzde } from "@/lib/bicim";

/**
 * Tasarım referans sayfası (kitchen sink).
 *
 * Amaç: renk/tipografi/tablo değişikliklerini TEK ekranda doğrulamak.
 * Gerçek sayfalar Supabase'e gidiyor, akıyor (Suspense) ve yüklenmesi
 * saniyeler sürüyor -- bir tablo başlığının tonunu görmek için sırayla üç
 * sayfa açmak gerekiyordu. Burada veri sabit, sayfa anında açılıyor.
 *
 * Örnek satırlar GERÇEK kağıtlardan ama SABİT: bu sayfa veri doğruluğu için
 * değil, görünüm için. Bir bileşenin görünümü değiştiğinde burada da
 * değişmeli; değişmiyorsa bileşen atlanmış demektir.
 */
export const metadata = { title: "Tasarım referansı" };

const SATIRLAR = [
  { isin: "TRT051033T12", tanim: "Sabit Kuponlu Devlet Tahvili", vade: 7.08, getiri: 33.85, z: -1.75, tutar: 980 },
  { isin: "TRT120929T12", tanim: "Sabit Kuponlu Devlet Tahvili", vade: 3.01, getiri: 38.85, z: 0.42, tutar: 2000 },
  { isin: "TRB100227T13", tanim: "Hazine Bonosu", vade: 0.42, getiri: 37.1, z: 1.24, tutar: 1500 },
];

function Bolum({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{baslik}</h2>
        {aciklama && <p className="text-sm text-muted-foreground">{aciklama}</p>}
      </div>
      {children}
    </section>
  );
}

export default function TasarimPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tasarım referansı</h1>
        <p className="text-sm text-muted-foreground">
          Paylaşılan bileşenlerin tamamı, sabit örnek veriyle. Renk veya tipografi değişikliğini
          burada tek ekranda doğrula.
        </p>
      </div>

      <Bolum
        baslik="Yüzey katmanları"
        aciklama="Sayfa zemini → kart → tablo başlığı. Üçü birbirinden ayrışmalı."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4 text-sm">Sayfa zemini</div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm">Kart / tablo yüzeyi</div>
          <div className="rounded-lg border border-border bg-[var(--tablo-baslik)] p-4 text-sm">Tablo başlığı</div>
        </div>
      </Bolum>

      <Bolum baslik="Özet şerit" aciklama="Metrik satırı — gradyan üst çizgi ve hizalı rakamlar.">
        <OzetSerit
          alanlar={[
            { etiket: "Bileşik getiri", deger: yuzde(33.85), altBilgi: "Valör: 09.09.2026" },
            { etiket: "Temiz fiyat", deger: sayi(85.3, 3) },
            { etiket: "Tail", deger: bps(13), yardim: "En yüksek ile ortalama arasındaki fark" },
            { etiket: "Kağıt sayısı", deger: "3" },
          ]}
        />
      </Bolum>

      <Bolum baslik="Kart" aciklama="Başlık ağırlığı elle yazılan bölüm başlıklarıyla aynı olmalı.">
        <Card>
          <CardHeader>
            <CardTitle>Kart başlığı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Kart içeriği.</p>
          </CardContent>
        </Card>
      </Bolum>

      <Bolum
        baslik="Tablo"
        aciklama="Gri başlık şeridi, dikey ayraçlar, iki satırlı birim başlıkları, hizalı rakamlar."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISIN</TableHead>
                <TableHead>Senet</TableHead>
                <TableHead className="text-right">
                  <KolonBasligi ust="Vade" alt="yıl" />
                </TableHead>
                <TableHead className="text-right">
                  <KolonBasligi ust="Getiri" alt="Bileşik" />
                </TableHead>
                <TableHead className="text-right">
                  <KolonBasligi ust="Tutar" alt="Mn TL" />
                </TableHead>
                <TableHead className="text-right">Z-skoru</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SATIRLAR.map((r) => (
                <TableRow key={r.isin}>
                  <TableCell className="font-figures">{r.isin}</TableCell>
                  <TableCell><SenetBadge tanim={r.tanim} /></TableCell>
                  <TableCell className="font-figures text-right">{sayi(r.vade)}</TableCell>
                  <TableCell className="font-figures text-right">{yuzde(r.getiri)}</TableCell>
                  <TableCell className="font-figures text-right">{sayi(r.tutar, 1)}</TableCell>
                  <TableCell className="font-figures text-right">{sayi(r.z)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Bolum>

      <Bolum baslik="Mobil kart listesi" aciklama="Geniş tabloların dar ekran karşılığı.">
        <MobilKartListesi
          kartlar={SATIRLAR.map((r) => ({
            baslik: r.isin,
            altBaslik: r.tanim,
            alanlar: [
              { etiket: "Vade (yıl)", deger: sayi(r.vade) },
              { etiket: "Getiri", deger: yuzde(r.getiri) },
              { etiket: "Tutar (Mn TL)", deger: sayi(r.tutar, 1) },
              { etiket: "Z-skoru", deger: sayi(r.z) },
            ],
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Yalnızca dar ekranda görünür — pencereyi daraltarak kontrol et.
        </p>
      </Bolum>

      <Bolum baslik="Boş durum">
        <BosDurum
          baslik="Bu ISIN için ihale kaydı bulunamadı."
          aciklama="HMB duyuru arşivinde bu kağıda ait bir ihale sonucu yok."
        />
      </Bolum>

      <Bolum baslik="Sayı biçimleri" aciklama="Hepsi tr-TR: binlik nokta, ondalık virgül.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yardımcı</TableHead>
                <TableHead>Çağrı</TableHead>
                <TableHead className="text-right">Sonuç</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["sayi", "sayi(1234.5)", sayi(1234.5)],
                ["sayi", "sayi(85.3, 3)", sayi(85.3, 3)],
                ["yuzde", "yuzde(33.85)", yuzde(33.85)],
                ["bps", "bps(-87)", bps(-87)],
                ["sayi", "sayi(null)", sayi(null)],
              ].map(([ad, cagri, sonuc]) => (
                <TableRow key={String(cagri)}>
                  <TableCell>{ad}</TableCell>
                  <TableCell className="font-figures">{cagri}</TableCell>
                  <TableCell className="font-figures text-right">{sonuc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Bolum>
    </div>
  );
}
