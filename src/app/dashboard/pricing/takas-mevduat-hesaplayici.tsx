"use client";

import { useMemo, useState } from "react";
import { takasHesapla, mevduatHesapla } from "@/lib/takas-repo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function pct(x: number): string {
  return `%${(x * 100).toFixed(4)}`;
}

function MetrikKart({ etiket, deger, yardim }: { etiket: string; deger: string; yardim?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="font-figures text-lg font-semibold">{deger}</p>
      {yardim && <p className="mt-1 text-xs text-muted-foreground">{yardim}</p>}
    </div>
  );
}

export function TakasMevduatHesaplayici() {
  const [gunTakas, setGunTakas] = useState(8);
  const [oranTakas, setOranTakas] = useState(40.4);
  const [gunMevduat, setGunMevduat] = useState(8);
  const [oranMevduat, setOranMevduat] = useState(40.4);

  const bugun = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const takasSonuc = useMemo(() => {
    if (!Number.isFinite(gunTakas) || gunTakas < 1) return null;
    return takasHesapla(gunTakas, oranTakas / 100, bugun);
  }, [gunTakas, oranTakas, bugun]);

  const mevduatSonuc = useMemo(() => {
    if (!Number.isFinite(gunMevduat) || gunMevduat < 1) return null;
    return mevduatHesapla(gunMevduat, oranMevduat / 100, bugun);
  }, [gunMevduat, oranMevduat, bugun]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Gün ve oran girerek O/N repo eşleniğini hesaplar. İş günü sayısı, hafta sonlarının yanında Türkiye
        resmi tatillerini (dini bayramlar dahil) de eler. Takas komisyonu: ≤8 gün için sabit 3,4776/100bin,
        üzerinde gün başına 0,40572/100bin. O/N eşleniğe günlük repo komisyonu (6,825×10⁻⁶) dahildir.
        Oranlar yıllık yüzde olarak girilir (ör. 40,4 = %40,4).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-base font-semibold">Takas → O/N</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gun-takas">Gün</Label>
                <Input
                  id="gun-takas"
                  type="number"
                  min={1}
                  max={3650}
                  value={gunTakas}
                  onChange={(e) => setGunTakas(Number(e.target.value))}
                  className="font-figures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oran-takas">Takas oranı (%)</Label>
                <Input
                  id="oran-takas"
                  inputMode="decimal"
                  value={oranTakas}
                  onChange={(e) => setOranTakas(Number(e.target.value.replace(",", ".")))}
                  className="font-figures"
                />
              </div>
            </div>
            {takasSonuc && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetrikKart etiket="Repo eşleniği" deger={pct(takasSonuc.onEslenik)} />
                  <MetrikKart
                    etiket="Net O/N eşlenik"
                    deger={pct(takasSonuc.netOnEslenik)}
                    yardim="Her gün O/N mevduat yapılıyormuş gibi -- komisyonsuz."
                  />
                  <MetrikKart etiket="Mevduat eşleniği" deger={pct(takasSonuc.mevduatEslenigi!)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Getiri (100 üzerinden): {takasSonuc.getiri.toFixed(6)} -- iş günü: {takasSonuc.isGunu} /{" "}
                  {gunTakas} takvim günü
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-base font-semibold">Mevduat → O/N</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gun-mevduat">Gün</Label>
                <Input
                  id="gun-mevduat"
                  type="number"
                  min={1}
                  max={3650}
                  value={gunMevduat}
                  onChange={(e) => setGunMevduat(Number(e.target.value))}
                  className="font-figures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oran-mevduat">Mevduat oranı (%)</Label>
                <Input
                  id="oran-mevduat"
                  inputMode="decimal"
                  value={oranMevduat}
                  onChange={(e) => setOranMevduat(Number(e.target.value.replace(",", ".")))}
                  className="font-figures"
                />
              </div>
            </div>
            {mevduatSonuc && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MetrikKart etiket="Repo eşleniği" deger={pct(mevduatSonuc.onEslenik)} />
                  <MetrikKart
                    etiket="Net O/N eşlenik"
                    deger={pct(mevduatSonuc.netOnEslenik)}
                    yardim="Her gün O/N mevduat yapılıyormuş gibi -- komisyonsuz."
                  />
                  <MetrikKart etiket="Takas eşleniği" deger={pct(mevduatSonuc.takasEslenigi!)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Getiri (100 üzerinden): {mevduatSonuc.getiri.toFixed(6)} -- iş günü: {mevduatSonuc.isGunu} /{" "}
                  {gunMevduat} takvim günü
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Hesap tarayıcıda anlık çalışır. PPK senaryolu rulo grafiği (Python&apos;daki &quot;Senaryo analizi&quot;
        bölümü) henüz portlanmadı.
      </p>
    </div>
  );
}
