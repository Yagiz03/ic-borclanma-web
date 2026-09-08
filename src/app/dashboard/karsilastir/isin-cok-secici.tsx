"use client";

import { useMemo, useState } from "react";

type Secenek = { isin: string; etiket: string; bistVeriVarMi: boolean };

/**
 * Çoklu kağıt seçici. Liste 500+ kağıt olabildiği için bir arama kutusu var;
 * BIST'te hiç işlem görmemiş kağıtlar işaretleniyor (seçilebilirler ama
 * grafikte çıkmayacaklarını kullanıcı önceden görsün).
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
    if (!q) return secenekler;
    return secenekler.filter(
      (s) =>
        s.isin.toLocaleLowerCase("tr").includes(q) || s.etiket.toLocaleLowerCase("tr").includes(q),
    );
  }, [secenekler, sorgu]);

  const doluMu = secililer.length >= azamiSecim;

  function degistir(isin: string, secili: boolean) {
    const yeni = secili
      ? [...secililer, isin].slice(-azamiSecim)
      : secililer.filter((i) => i !== isin);
    onDegisim(yeni);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          placeholder="ISIN veya kağıt tipi ara…"
          aria-label="Kağıt ara"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
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
