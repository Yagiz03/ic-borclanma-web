"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { emirOzetHesapla } from "@/lib/ihale-emir";

type Track = {
  id: string;
  isin: string;
  ihale_tarihi: string;
  en_dusuk_gerceklesen_fiyat: number | null;
  emirler: { id: string; fiyat: number; nominal: number }[];
};

const bugunIso = () => new Date().toISOString().slice(0, 10);

function paraFmt(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function YeniTakipFormu() {
  const router = useRouter();
  const [isin, setIsin] = useState("");
  const [tarih, setTarih] = useState(bugunIso());
  const [hata, setHata] = useState<string | null>(null);
  const [ekleniyor, startTransition] = useTransition();

  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!isin.trim()) {
      setHata("ISIN boş olamaz.");
      return;
    }
    setHata(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("auction_tracks").insert({
        user_id: user.id, isin: isin.trim().toUpperCase(), ihale_tarihi: tarih,
      });
      if (error) {
        setHata(error.message);
        return;
      }
      setIsin("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="mb-3 text-sm text-muted-foreground">
          İhaleye verdiğin fiyat/nominal emirlerini gir; sonuç açıklandıktan sonra &apos;en düşük gerçekleşen
          fiyatı&apos; (kesme fiyatı) girince -- çoklu fiyat ihalesi kuralıyla (fiyatı kesme fiyatına eşit/üstünde
          olan emirler kendi fiyatından gerçekleşir) hangi emrinin geldiğini ve gerçekleşenlerin ortalama fiyatını
          otomatik hesaplar.
        </p>
        <form onSubmit={ekle} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="yeni-isin">ISIN</Label>
            <Input id="yeni-isin" value={isin} onChange={(e) => setIsin(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="yeni-tarih">İhale tarihi</Label>
            <Input id="yeni-tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
          </div>
          <Button type="submit" disabled={ekleniyor}>
            <Plus className="size-4" /> Ekle
          </Button>
        </form>
        {hata && <p className="mt-2 text-sm text-destructive">{hata}</p>}
      </CardContent>
    </Card>
  );
}

function TakipKarti({ takip, oneri }: { takip: Track; oneri: number | null }) {
  const router = useRouter();
  const [emirFiyat, setEmirFiyat] = useState("");
  const [emirNominal, setEmirNominal] = useState("");
  const [kesmeFiyat, setKesmeFiyat] = useState(
    takip.en_dusuk_gerceklesen_fiyat != null ? String(takip.en_dusuk_gerceklesen_fiyat) : "",
  );
  const [, startTransition] = useTransition();

  function takipSil() {
    if (!confirm("Bu ihale takibini silmek istediğine emin misin?")) return;
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("auction_tracks").delete().eq("id", takip.id);
      router.refresh();
    });
  }

  function emirEkle(e: React.FormEvent) {
    e.preventDefault();
    const fiyat = Number(emirFiyat);
    const nominal = Number(emirNominal);
    if (!(fiyat > 0) || !(nominal > 0)) return;
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("auction_orders").insert({ track_id: takip.id, fiyat, nominal });
      setEmirFiyat("");
      setEmirNominal("");
      router.refresh();
    });
  }

  function emirSil(id: string) {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("auction_orders").delete().eq("id", id);
      router.refresh();
    });
  }

  function kesmeKaydet() {
    const deger = Number(kesmeFiyat);
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("auction_tracks")
        .update({ en_dusuk_gerceklesen_fiyat: deger > 0 ? deger : null })
        .eq("id", takip.id);
      router.refresh();
    });
  }

  const ozet = emirOzetHesapla(takip.emirler, takip.en_dusuk_gerceklesen_fiyat ?? null);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-semibold">{takip.isin}</span>
            <span className="ml-2 text-sm text-muted-foreground">
              İhale tarihi: {new Date(takip.ihale_tarihi).toLocaleDateString("tr-TR")}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={takipSil} aria-label="Takibi sil">
            <Trash2 className="size-4" />
          </Button>
        </div>

        <form onSubmit={emirEkle} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`fiyat-${takip.id}`}>Emir fiyatı</Label>
            <Input
              id={`fiyat-${takip.id}`} inputMode="decimal" value={emirFiyat}
              onChange={(e) => setEmirFiyat(e.target.value)} className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`nominal-${takip.id}`}>Nominal</Label>
            <Input
              id={`nominal-${takip.id}`} inputMode="decimal" value={emirNominal}
              onChange={(e) => setEmirNominal(e.target.value)} className="w-32"
            />
          </div>
          <Button type="submit" variant="secondary">
            <Plus className="size-4" /> Emir ekle
          </Button>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`kesme-${takip.id}`}>En düşük gerçekleşen fiyat (kesme fiyatı)</Label>
            <Input
              id={`kesme-${takip.id}`} inputMode="decimal" value={kesmeFiyat}
              onChange={(e) => setKesmeFiyat(e.target.value)} className="w-32"
            />
          </div>
          <Button onClick={kesmeKaydet} variant="secondary">Kaydet</Button>
        </div>
        {oneri != null && oneri !== takip.en_dusuk_gerceklesen_fiyat && (
          <p className="text-xs text-muted-foreground">
            İhale sonuçlarında bu ISIN için resmi &quot;en düşük gerçekleşen fiyat&quot;{" "}
            <b className="text-foreground">{oneri.toFixed(3)}</b> olarak bulundu -- yukarıya yazıp
            &quot;Kaydet&quot;e basabilirsin.
          </p>
        )}

        {takip.emirler.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz emir eklenmedi.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Fiyat</th>
                    <th className="px-3 py-2 font-medium">Nominal</th>
                    <th className="px-3 py-2 font-medium">Durum</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ozet.emirler.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="font-figures px-3 py-2">{e.fiyat.toFixed(3)}</td>
                      <td className="font-figures px-3 py-2">{paraFmt(e.nominal)}</td>
                      <td className="px-3 py-2">
                        {e.geldi === true ? (
                          <span className="text-emerald-600">✅ Geldi</span>
                        ) : e.geldi === false ? (
                          <span className="text-destructive">❌ Gelmedi</span>
                        ) : (
                          <span className="text-muted-foreground">– Sonuç bekliyor</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => emirSil(e.id)} aria-label="Emri sil">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Toplam talep</p>
                <p className="font-figures font-semibold">{paraFmt(ozet.toplamTalep)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Toplam gerçekleşen</p>
                <p className="font-figures font-semibold">
                  {ozet.toplamGerceklesen != null ? paraFmt(ozet.toplamGerceklesen) : "–"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Gerçekleşme oranı</p>
                <p className="font-figures font-semibold">
                  {ozet.gerceklesmeOrani != null ? `%${ozet.gerceklesmeOrani.toFixed(1)}` : "–"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Ort. gerçekleşen fiyat</p>
                <p className="font-figures font-semibold">
                  {ozet.ortGerceklesenFiyat != null ? ozet.ortGerceklesenFiyat.toFixed(3) : "–"}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function EmirlerimTab({ takipler, kesmeOnerileri }: { takipler: Track[]; kesmeOnerileri: Record<string, number> }) {
  return (
    <div className="space-y-4">
      <YeniTakipFormu />
      {takipler.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz takip edilen bir ihale emri yok.</p>
      ) : (
        takipler.map((t) => <TakipKarti key={t.id} takip={t} oneri={kesmeOnerileri[t.isin] ?? null} />)
      )}
    </div>
  );
}
