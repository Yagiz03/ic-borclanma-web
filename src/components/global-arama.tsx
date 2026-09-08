"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type AramaKagidi = { isin: string; tanim: string };

type Sonuc = {
  tur: "sayfa" | "kagit";
  etiket: string;
  altEtiket: string;
  hedef: string;
  /** Eşleşme için taranan metin (küçük harfe çevrilmiş). */
  anahtar: string;
};

// core/arama.py'deki KONU_INDEKSI'nin karşılığı: sayfa içi konu/sekme
// başlıkları. Streamlit belirli bir sekmeyi programatik seçemediği için orada
// sadece sayfaya atlanıyordu; burada sekmesi olan sayfalara doğrudan
// link verebiliyoruz (ör. Bono ve Getiri Hesaplayıcı ?tab=).
const KONULAR: { baslik: string; sayfa: string; sekme?: string; hedef: string }[] = [
  { baslik: "Piyasadan İhale Yoluyla İç Borçlanma İlerlemesi", sayfa: "İhale Detay", hedef: "/dashboard/ihale-detay" },
  { baslik: "Bu ay hangi kağıttan ne kadar geldi", sayfa: "İhale Detay", hedef: "/dashboard/ihale-detay" },
  { baslik: "Bu ay kalan ihaleler", sayfa: "İhale Detay", hedef: "/dashboard/ihale-detay" },
  { baslik: "Yılbaşından bu yana aylık ilerleme", sayfa: "İhale Detay", hedef: "/dashboard/ihale-detay" },
  { baslik: "TCMB Doğrudan Alım İhalesi", sayfa: "İhale Detay", hedef: "/dashboard/ihale-detay" },

  { baslik: "Tahmin", sayfa: "İhale günü", sekme: "Tahmin", hedef: "/dashboard/ihale-gunu?tab=tahmin" },
  { baslik: "Emirlerim", sayfa: "İhale günü", sekme: "Emirlerim", hedef: "/dashboard/ihale-gunu?tab=emirlerim" },
  { baslik: "İhale sonrası performans", sayfa: "İhale günü", sekme: "İhale sonrası performans", hedef: "/dashboard/ihale-gunu?tab=performans" },

  { baslik: "İhale geçmişi", sayfa: "DİBS Detay", sekme: "DİBS Detay", hedef: "/dashboard/dibs-detay?tab=detay" },
  { baslik: "BIST ikincil piyasa fiyatı", sayfa: "DİBS Detay", sekme: "DİBS Detay", hedef: "/dashboard/dibs-detay?tab=detay" },
  { baslik: "Düzenli İşlem Gören", sayfa: "DİBS Detay", sekme: "Düzenli İşlem Gören", hedef: "/dashboard/dibs-detay?tab=duzenli" },
  { baslik: "Karşılaştır", sayfa: "DİBS Detay", sekme: "Karşılaştır", hedef: "/dashboard/dibs-detay?tab=karsilastir" },

  { baslik: "Eğri karşılaştırması", sayfa: "Getiri eğrisi", hedef: "/dashboard/getiri-egrisi" },
  { baslik: "Relative value", sayfa: "Getiri eğrisi", hedef: "/dashboard/getiri-egrisi" },
  { baslik: "Nelson-Siegel", sayfa: "Getiri eğrisi", hedef: "/dashboard/getiri-egrisi" },

  { baslik: "ISIN Hesaplayıcı", sayfa: "Bono ve Getiri Hesaplayıcı", sekme: "ISIN Hesaplayıcı", hedef: "/dashboard/pricing?tab=hesaplayici" },
  { baslik: "Takas / Mevduat", sayfa: "Bono ve Getiri Hesaplayıcı", sekme: "Takas / Mevduat → O/N", hedef: "/dashboard/pricing?tab=takas" },
  { baslik: "Pozisyonlarım", sayfa: "Bono ve Getiri Hesaplayıcı", sekme: "P&L", hedef: "/dashboard/pricing?tab=pnl" },
  { baslik: "İzleme listesi", sayfa: "Bono ve Getiri Hesaplayıcı", sekme: "P&L", hedef: "/dashboard/pricing?tab=pnl" },

  { baslik: "DİBS piyasa değeri", sayfa: "TCMB", sekme: "DİBS Piyasa Değeri", hedef: "/dashboard/tcmb?tab=dibs" },
  { baslik: "TCMB APİ Portföyü", sayfa: "TCMB", sekme: "TCMB APİ Portföyü", hedef: "/dashboard/tcmb?tab=apiportfoyu" },
  { baslik: "TÜFE, M2, KFE ve Bono", sayfa: "TCMB", sekme: "TÜFE, M2, KFE ve Bono", hedef: "/dashboard/tcmb?tab=tufem2kfebono" },
  { baslik: "Repo faiz koridoru", sayfa: "TCMB", sekme: "Repo Faiz Koridoru", hedef: "/dashboard/tcmb?tab=koridor" },
  { baslik: "TLREF", sayfa: "TCMB", sekme: "TLREF", hedef: "/dashboard/tcmb?tab=tlref" },
  { baslik: "Dış denge", sayfa: "TCMB", sekme: "Dış Denge", hedef: "/dashboard/tcmb?tab=disdenge" },
  { baslik: "Net Rezerv", sayfa: "TCMB", sekme: "Net Rezerv", hedef: "/dashboard/tcmb?tab=rezerv" },
  { baslik: "Piyasa beklentileri", sayfa: "TCMB", sekme: "Piyasa Beklentileri", hedef: "/dashboard/tcmb?tab=beklenti" },
  { baslik: "PPK karar farkı", sayfa: "TCMB", sekme: "PPK Karar Farkı", hedef: "/dashboard/tcmb?tab=ppkfarki" },
  { baslik: "Enflasyon Raporu", sayfa: "TCMB", sekme: "Enflasyon Raporu", hedef: "/dashboard/tcmb?tab=enflasyonraporu" },

  { baslik: "Merkezi Yönetim Borç Stoku", sayfa: "Hazine", sekme: "Borç Stoku / Nakit", hedef: "/dashboard/hazine?tab=borcnakit" },
  { baslik: "Hazine Nakit Gerçekleşmeleri", sayfa: "Hazine", sekme: "Borç Stoku / Nakit", hedef: "/dashboard/hazine?tab=borcnakit" },
  { baslik: "İç Borç Çevirme Oranı", sayfa: "Hazine", sekme: "İç Borç Çevirme Oranı", hedef: "/dashboard/hazine?tab=cevirme" },
  { baslik: "Ortalama Vade / Maliyet", sayfa: "Hazine", sekme: "Ortalama Vade / Maliyet", hedef: "/dashboard/hazine?tab=vade" },
  { baslik: "İç Borçlanmanın Ortalama Vadesi / Maliyeti", sayfa: "Hazine", sekme: "Ortalama Vade / Maliyet", hedef: "/dashboard/hazine?tab=vade" },

  { baslik: "Gecelik (O/N)", sayfa: "TPP", sekme: "Gecelik (O/N)", hedef: "/dashboard/takasbank-tpp?tab=on" },
  { baslik: "Vade Yapısı", sayfa: "TPP", sekme: "Vade Yapısı", hedef: "/dashboard/takasbank-tpp?tab=egri" },

  { baslik: "Günlük işlemler", sayfa: "Özel sektör tahvilleri", sekme: "Günlük işlemler", hedef: "/dashboard/ozel-sektor?tab=gunluk" },
  { baslik: "İhraççı profili", sayfa: "Özel sektör tahvilleri", sekme: "İhraççı profili", hedef: "/dashboard/ozel-sektor?tab=ihracci" },

  { baslik: "Borçlanma stratejisi", sayfa: "Borçlanma stratejisi", hedef: "/dashboard/strateji" },
  { baslik: "Takvim", sayfa: "Takvim", hedef: "/dashboard/takvim" },
];

function kucult(s: string): string {
  return s.toLocaleLowerCase("tr");
}

export function GlobalArama({ kagitlar }: { kagitlar: AramaKagidi[] }) {
  const router = useRouter();
  const [acik, setAcik] = React.useState(false);
  const [sorgu, setSorgu] = React.useState("");
  const [vurgu, setVurgu] = React.useState(0);
  const kokRef = React.useRef<HTMLDivElement>(null);
  const girdiRef = React.useRef<HTMLInputElement>(null);

  const tumSonuclar = React.useMemo<Sonuc[]>(() => {
    const sayfalar: Sonuc[] = KONULAR.map((k) => ({
      tur: "sayfa",
      etiket: k.baslik,
      altEtiket: k.sekme ? `${k.sayfa} › ${k.sekme}` : k.sayfa,
      hedef: k.hedef,
      anahtar: kucult(`${k.baslik} ${k.sayfa} ${k.sekme ?? ""}`),
    }));
    const kagitSonuclari: Sonuc[] = kagitlar.map((k) => ({
      tur: "kagit",
      etiket: k.isin,
      altEtiket: k.tanim,
      hedef: `/dashboard/dibs-detay?isin=${k.isin}`,
      anahtar: kucult(`${k.isin} ${k.tanim}`),
    }));
    return [...sayfalar, ...kagitSonuclari];
  }, [kagitlar]);

  const sonuclar = React.useMemo(() => {
    const q = kucult(sorgu.trim());
    if (!q) return [];
    return tumSonuclar.filter((s) => s.anahtar.includes(q)).slice(0, 20);
  }, [tumSonuclar, sorgu]);

  React.useEffect(() => {
    function disariTiklama(e: MouseEvent) {
      if (kokRef.current && !kokRef.current.contains(e.target as Node)) setAcik(false);
    }
    function kisayol(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        girdiRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", disariTiklama);
    document.addEventListener("keydown", kisayol);
    return () => {
      document.removeEventListener("mousedown", disariTiklama);
      document.removeEventListener("keydown", kisayol);
    };
  }, []);

  // Kutuyu burada blur ETMİYORUZ: sonuç düğmesindeki onMouseDown zaten odağı
  // kutuda tutuyor, sorgu temizlenince liste de kapanıyor. (Ayrıca render
  // sırasında ref okumak React'in refs kuralını ihlal ediyordu.)
  const git = React.useCallback(
    (s: Sonuc) => {
      setSorgu("");
      setAcik(false);
      router.push(s.hedef);
    },
    [router],
  );

  return (
    // Sabit genişlik yerine ESNEK: satırda kalan boşluğu alıyor, yer daralınca
    // sabit genişlikli olsa alt satıra kayacakken burada küçülerek sekmelerle
    // aynı satırda kalıyor.
    <div ref={kokRef} className="relative ml-1 min-w-[7.5rem] max-w-72 flex-1 basis-32">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={girdiRef}
        value={sorgu}
        onChange={(e) => {
          setSorgu(e.target.value);
          setVurgu(0);
          setAcik(true);
        }}
        onFocus={() => setAcik(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setVurgu((v) => Math.min(v + 1, sonuclar.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setVurgu((v) => Math.max(v - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const s = sonuclar[vurgu];
            if (s) git(s);
          } else if (e.key === "Escape") {
            setAcik(false);
            girdiRef.current?.blur();
          }
        }}
        placeholder="Ara"
        aria-label="Sayfa veya kağıt ara"
        autoComplete="off"
        className="h-8 w-full rounded-full border border-input bg-background/60 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      {acik && sorgu.trim() !== "" && (
        <div className="absolute left-0 z-50 mt-1.5 max-h-96 w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {sonuclar.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Sonuç yok.</p>
          ) : (
            sonuclar.map((s, i) => (
              <button
                key={`${s.tur}-${s.etiket}-${s.hedef}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setVurgu(i)}
                onClick={() => git(s)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  i === vurgu ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className={cn("text-sm", s.tur === "kagit" && "font-figures font-medium")}>
                    {s.etiket}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{s.altEtiket}</span>
                </span>
                <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                  {s.tur === "kagit" ? "Kağıt" : "Sayfa"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
