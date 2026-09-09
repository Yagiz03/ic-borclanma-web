"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * İşlem günü seçici.
 *
 * Neden ayrı bir bileşen: bu alanlar ham `<select>` idi ve içlerinde 1677
 * (getiri eğrisi) / 338 (özel sektör) seçenek vardı -- masaüstünde belirli bir
 * güne kaydırarak ulaşmak pratikte imkânsızdı. Burada kullanıcı ay ay
 * geziniyor, yalnızca VERİ OLAN günler tıklanabiliyor; en sık yapılan işlem
 * (bir önceki/sonraki işlem gününe geçmek) ise ok tuşlarıyla tek tıkta.
 *
 * Takvim ızgarası Pzt-Cum: BIST hafta sonu kapalı, altı sütun boşa gidiyordu.
 */

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_BASLIKLARI = ["Pzt", "Sal", "Çar", "Per", "Cum"];

const trTarih = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" });

export function IslemGunuSecici({
  tarihler,
  deger,
  onChange,
  etiket = "Tarih",
  id,
}: {
  /** Seçilebilir günler (ISO YYYY-MM-DD). Sıra önemsiz. */
  tarihler: string[];
  deger: string;
  onChange: (tarih: string) => void;
  etiket?: string;
  id?: string;
}) {
  const [acik, setAcik] = useState(false);
  // Panel açıldığında hangi ay gösteriliyor (seçili günün ayından başlar).
  const [gosterilenAy, setGosterilenAy] = useState(() => deger.slice(0, 7));
  const kokRef = useRef<HTMLDivElement>(null);

  const artan = useMemo(() => [...tarihler].sort(), [tarihler]);
  const kume = useMemo(() => new Set(artan), [artan]);
  const sira = useMemo(() => artan.indexOf(deger), [artan, deger]);

  useEffect(() => {
    if (!acik) return;
    function disariTiklama(e: MouseEvent) {
      if (kokRef.current && !kokRef.current.contains(e.target as Node)) setAcik(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAcik(false);
    }
    document.addEventListener("mousedown", disariTiklama);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", disariTiklama);
      document.removeEventListener("keydown", esc);
    };
  }, [acik]);

  const [yil, ay] = gosterilenAy.split("-").map(Number);
  const ayinGunSayisi = new Date(Date.UTC(yil, ay, 0)).getUTCDate();
  const ilkGunHaftaIcinde = (new Date(Date.UTC(yil, ay - 1, 1)).getUTCDay() + 6) % 7;

  const hucreler: (number | null)[] = [];
  for (let i = 0; i < Math.min(ilkGunHaftaIcinde, 5); i++) hucreler.push(null);
  for (let g = 1; g <= ayinGunSayisi; g++) {
    const haftaGunu = (ilkGunHaftaIcinde + g - 1) % 7;
    if (haftaGunu < 5) hucreler.push(g);
  }

  const ayDegistir = (delta: number) => {
    const d = new Date(Date.UTC(yil, ay - 1 + delta, 1));
    setGosterilenAy(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const gunAtla = (delta: number) => {
    const yeni = artan[sira + delta];
    if (yeni) {
      onChange(yeni);
      setGosterilenAy(yeni.slice(0, 7));
    }
  };

  // Panelde gezinilen ayda hiç işlem günü yoksa kullanıcıya söyle.
  const aydaVeriVar = artan.some((t) => t.startsWith(gosterilenAy));

  return (
    <div className="space-y-1.5">
      {etiket && (
        <label className="block text-xs text-muted-foreground" htmlFor={id}>
          {etiket}
        </label>
      )}
      <div ref={kokRef} className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={() => gunAtla(-1)}
          disabled={sira <= 0}
          aria-label="Önceki işlem günü"
          className="flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          id={id}
          type="button"
          onClick={() => {
            setGosterilenAy(deger.slice(0, 7));
            setAcik((v) => !v);
          }}
          aria-haspopup="dialog"
          aria-expanded={acik}
          className="font-figures flex h-9 min-w-36 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted"
        >
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {deger ? trTarih(deger) : "—"}
        </button>

        <button
          type="button"
          onClick={() => gunAtla(1)}
          disabled={sira < 0 || sira >= artan.length - 1}
          aria-label="Sonraki işlem günü"
          className="flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>

        {acik && (
          <div
            role="dialog"
            aria-label="İşlem günü seç"
            className="absolute top-11 left-0 z-50 w-72 rounded-xl border border-border bg-popover p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => ayDegistir(-1)}
                aria-label="Önceki ay"
                className="rounded-md p-1 hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-medium">
                {AY_ADLARI[ay - 1]} {yil}
              </span>
              <button
                type="button"
                onClick={() => ayDegistir(1)}
                aria-label="Sonraki ay"
                className="rounded-md p-1 hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-5 gap-1 text-center text-[11px] text-muted-foreground">
              {GUN_BASLIKLARI.map((g) => (
                <span key={g}>{g}</span>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-1">
              {hucreler.map((g, i) => {
                if (g == null) return <span key={`bos-${i}`} />;
                const iso = `${gosterilenAy}-${String(g).padStart(2, "0")}`;
                const varMi = kume.has(iso);
                const seciliMi = iso === deger;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!varMi}
                    onClick={() => {
                      onChange(iso);
                      setAcik(false);
                    }}
                    title={varMi ? trTarih(iso) : "Bu gün işlem yok"}
                    className={`font-figures h-8 rounded-md text-xs transition-colors ${
                      seciliMi
                        ? "bg-primary font-semibold text-primary-foreground"
                        : varMi
                          ? "hover:bg-muted"
                          : "cursor-not-allowed text-muted-foreground/35"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            {!aydaVeriVar && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Bu ayda işlem günü yok.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                const sonuncu = artan[artan.length - 1];
                onChange(sonuncu);
                setGosterilenAy(sonuncu.slice(0, 7));
                setAcik(false);
              }}
              className="mt-2 w-full rounded-md border border-input py-1.5 text-xs hover:bg-muted"
            >
              En son işlem gününe git
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
