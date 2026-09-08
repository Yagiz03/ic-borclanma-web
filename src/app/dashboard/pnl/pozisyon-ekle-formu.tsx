"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";

const bugunIso = () => new Date().toISOString().slice(0, 10);

export function PozisyonEkleFormu({ isinler }: { isinler: { isin: string; etiket: string }[] }) {
  const router = useRouter();
  const [isin, setIsin] = useState(isinler[0]?.isin ?? "");
  const [nominal, setNominal] = useState("");
  const [fiyat, setFiyat] = useState("");
  const [tarih, setTarih] = useState(bugunIso());
  const [not_, setNot] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [ekleniyor, setEkleniyor] = useState(false);

  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    const nominalSayi = Number(nominal);
    const fiyatSayi = Number(fiyat);
    if (!isin || !(nominalSayi > 0) || !(fiyatSayi > 0)) {
      setHata("Nominal ve alış fiyatı sıfırdan büyük olmalı.");
      return;
    }
    setEkleniyor(true);
    setHata(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEkleniyor(false);
      return;
    }
    const { error } = await supabase.from("positions").insert({
      user_id: user.id,
      isin,
      nominal: nominalSayi,
      alis_fiyati: fiyatSayi,
      alis_tarihi: tarih,
      not_,
    });
    setEkleniyor(false);
    if (error) {
      setHata(error.message);
      return;
    }
    setNominal("");
    setFiyat("");
    setNot("");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={ekle} className="space-y-4">
          <div className="space-y-2">
            <Label>ISIN</Label>
            <Combobox
              value={isin}
              onChange={setIsin}
              placeholder="ISIN veya kağıt adı yazın..."
              emptyText="Eşleşen kağıt yok."
              options={isinler.map((i) => ({ value: i.isin, label: `${i.isin} — ${i.etiket}`, keywords: i.isin }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="nominal">Nominal</Label>
              <Input id="nominal" inputMode="decimal" value={nominal} onChange={(e) => setNominal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiyat">Alış fiyatı (temiz)</Label>
              <Input id="fiyat" inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarih">Alış tarihi</Label>
              <Input id="tarih" type="date" max={bugunIso()} value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="not">Not (opsiyonel)</Label>
              <Input id="not" value={not_} onChange={(e) => setNot(e.target.value)} />
            </div>
          </div>
          {hata && <p className="text-sm text-destructive">{hata}</p>}
          <Button type="submit" disabled={ekleniyor}>
            {ekleniyor ? "Ekleniyor..." : "Ekle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
