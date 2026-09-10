"use client";

import { useMemo, useState } from "react";

type Secenek = { isin: string; etiket: string; bistVeriVarMi: boolean };

/**
 * Çoklu kağıt seçici. Liste 500+ kağıt olabildiği için bir arama kutusu var.
 *
 * İki tasarım kararı, ikisi de yaşanan sorunlardan:
 *  - SEÇİLENLER ÜSTTE, silinebilir etiketler olarak. Önceden seçili kağıtlar
 *    yalnızca listedeki işaretli kutulardan görülüyordu; 500 satırlık listede
 *    neyi karşılaştırdığını görmek için kaydırmak gerekiyordu.
 *  - BIST'te işlem görmemiş ("veri yok") kağıtlar listenin SONUNA. Bunlar
 *    grafikte hiç çıkmıyor ama sayıca çoğunlukta olduklari için listenin
 *    görünen kısmını tamamen dolduruyorlardı.
 */
export function IsinCokSecici({
  secenekler,
  secililer,
  azamiSecim,
  onDegisim,
}: {
  secenekler: Secenek[];
  secililer: string[];
  azamiSecim: number;
  onDegisim: (yeni: string[]) => void;
}) {
  const [sorgu, setSorgu] = useState("");

  const suzulmus = useMemo(() => {
    const q = sorgu.trim().toLocaleLowerCase("tr");
    const eslesen = q
      ? secenekler.filter(
          (s) =>
            s.isin.toLocaleLowerCase("tr").includes(q) ||
            s.etiket.toLocaleLowerCase("tr").includes(q),
        )
      : secenekler;
    // Grafikte gorunen kagitlar once; "veri yok" olanlar listeyi doldurmasin.
    return [...eslesen].sort((a, b) =>
      a.bistVeriVarMi === b.bistVeriVarMi ? a.isin.localeCompare(b.isin) : a.bistVeriVarMi ? -1 : 1,
    );
  }, [secenekler, sorgu]);

  const etiketBul = (isin: string) => secenekler.find((s) => s.isin === isin)?.etiket ?? "";

  const doluMu = secililer.length >= azamiSecim;

  function degistir(isin: string, secili: boolean) {
    const yeni = secili
      ? [...secililer, isin].slice(-azamiSecim)
      : secililer.filter((i) => i !== isin);
    onDegisim(yeni);
  }

  return (
    <div className="space-y-2">
      <input
        value={sorgu}
        onChange={(e) => setSorgu(e.target.value)}
        placeholder="ISIN veya kağıt tipi ara…"
        aria-label="Kağıt ara"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <div className="flex flex-wrap items-center gap-2">
        {secililer.map((isin) => (
          <span
            key={isin}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pl-2.5 pr-1.5 text-xs"
          >
            <span className="font-figures">{isin}</span>
            <span className="max-w-[10rem] truncate text-muted-foreground">{etiketBul(isin)}</span>
            <button
              type="button"
              onClick={() => degistir(isin, false)}
              aria-label={`${isin} seçimini kaldır`}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <span className="text-xs text-muted-foreground">
          {secililer.length}/{azamiSecim} seçili
        </span>
        {secililer.length > 0 && (
          <button
            type="button"
            onClick={() => onDegisim([])}
            className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-muted"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
        {suzulmus.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">Eşleşen kağıt yok.</p>
        ) : (
          suzulmus.map((s) => {
            const secili = secililer.includes(s.isin);
            return (
              <label
                key={s.isin}
                className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted ${
                  !secili && doluMu ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={secili}
                  disabled={!secili && doluMu}
                  onChange={(e) => degistir(s.isin, e.target.checked)}
                  className="accent-primary"
                />
                <span className="font-figures">{s.isin}</span>
                <span className="truncate text-xs text-muted-foreground">{s.etiket}</span>
                {!s.bistVeriVarMi && (
                  <span
                    className="ml-auto shrink-0 text-xs text-muted-foreground"
                    title="BIST ikincil piyasada işlem görmemiş — grafikte çıkmaz."
                  >
                    veri yok
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
