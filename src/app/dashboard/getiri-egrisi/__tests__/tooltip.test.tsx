/**
 * NoktaTooltip sözleşmesi. Gerçek bir çökme buradan geldi: Nelson-Siegel
 * grafiğinde imleç EĞRİNİN üstüne gelince Recharts tooltip'e {kalanVadeYil,
 * egri} taşıyan bir nokta veriyor -- getiri/ISIN yok. Eski kod koşulsuz
 * p.getiri.toFixed() çağırdığı için bileşen çöküp hata ekranını açıyordu.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoktaTooltip, KarsilastirmaTooltip } from "../getiri-egrisi-client";

const sar = (p: Record<string, unknown>) => [{ payload: p }];

describe("NoktaTooltip", () => {
  it("eğri noktasında (getiri/ISIN yok) çökmez", () => {
    expect(() =>
      render(<NoktaTooltip active payload={sar({ kalanVadeYil: 4.2, egri: 37.8 })} />),
    ).not.toThrow();
    expect(screen.getByText(/Kalan vade: 4,?\.?20 yıl|Kalan vade: 4.20 yıl/)).toBeInTheDocument();
  });

  it("saçılım noktasında ISIN, getiri ve z-skorunu basar", () => {
    render(
      <NoktaTooltip
        active
        payload={sar({ isin: "TRT051033T12", kalanVadeYil: 7.08, getiri: 33.85, zSkoru: -1.75 })}
      />,
    );
    expect(screen.getByText("TRT051033T12")).toBeInTheDocument();
    expect(screen.getByText("Getiri: %33.85")).toBeInTheDocument();
    expect(screen.getByText("Z-skoru: -1.75")).toBeInTheDocument();
  });

  it("eğri ile saçılım aynı yükteyken ISIN'li kaydı seçer", () => {
    // ComposedChart'ta eğri serisi saçılımdan ÖNCE tanımlı: yükün başında
    // ISIN'siz eğri noktası geliyor. Kağıdın üstündeyken ISIN görünmeliydi.
    render(
      <NoktaTooltip
        active
        payload={[
          { payload: { kalanVadeYil: 7.08, egri: 36.1 } },
          { payload: { isin: "TRT051033T12", kalanVadeYil: 7.08, getiri: 33.85, zSkoru: -1.75 } },
        ]}
      />,
    );
    expect(screen.getByText("TRT051033T12")).toBeInTheDocument();
    expect(screen.getByText("Getiri: %33.85")).toBeInTheDocument();
  });

  it("yükte SADECE eğri varken bile x'e en yakın kağıdın ISIN'ini bulur", () => {
    // Gercek davranis: Recharts bu grafiklerde Scatter serilerini paylasimli
    // tooltip yukune KOYMUYOR, yalnizca uyarlanan egri geliyor. ISIN'i x
    // eksenindeki konuma gore veri kumesinden bulmak zorundayiz.
    const noktalar = [
      { isin: "TRT150328T24", kalanVadeYil: 1.52, getiri: 39.67, zSkoru: 1.24 },
      { isin: "TRT160431T35", kalanVadeYil: 4.61, getiri: 37.85, zSkoru: 0.42 },
      { isin: "TRT051033T12", kalanVadeYil: 7.08, getiri: 33.85, zSkoru: -1.75 },
    ];
    render(
      <NoktaTooltip
        active
        label={4.6}
        noktalar={noktalar}
        payload={sar({ kalanVadeYil: 4.6, egri: 37.62 })}
      />,
    );
    expect(screen.getByText("TRT160431T35")).toBeInTheDocument();
    expect(screen.getByText("Getiri: %37.85")).toBeInTheDocument();
    expect(screen.getByText("Eğri: %37.62")).toBeInTheDocument();
  });

  it("hiçbir kağıda yakın değilse kağıt uydurmaz", () => {
    const noktalar = [{ isin: "TRT150328T24", kalanVadeYil: 1.52, getiri: 39.67 }];
    render(
      <NoktaTooltip
        active
        label={5.5}
        noktalar={noktalar}
        payload={sar({ kalanVadeYil: 5.5, egri: 36.4 })}
      />,
    );
    expect(screen.queryByText("TRT150328T24")).not.toBeInTheDocument();
    expect(screen.getByText("Eğri: %36.40")).toBeInTheDocument();
  });

  it("boş/eksik yükte hiçbir şey render etmez", () => {
    const { container: a } = render(<NoktaTooltip active payload={[]} />);
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(<NoktaTooltip active payload={sar({})} />);
    expect(b).toBeEmptyDOMElement();
  });
});

describe("KarsilastirmaTooltip", () => {
  const yuk = [
    { name: "08.09.2026", value: 38.42, color: "#1", payload: { isin: "TRT051033T12", senetTanimi: "Sabit Kuponlu Devlet Tahvili", kalanVadeYil: 7.08, getiri: 38.42 } },
    { name: "01.09.2026", value: 37.55, color: "#2", payload: { isin: "TRT051033T12", kalanVadeYil: 7.08, getiri: 37.55 } },
  ];

  it("noktanın ISIN'ini ve kağıt tipini gösterir", () => {
    render(<KarsilastirmaTooltip active payload={yuk} referansAdi="08.09.2026" />);
    expect(screen.getByText("TRT051033T12")).toBeInTheDocument();
    expect(screen.getByText("Sabit Kuponlu Devlet Tahvili")).toBeInTheDocument();
    expect(screen.getByText("Kalan vade: 7.08 yıl")).toBeInTheDocument();
  });

  it("her günün getirisini ve referansa göre farkını bps olarak verir", () => {
    render(<KarsilastirmaTooltip active payload={yuk} referansAdi="08.09.2026" />);
    expect(screen.getByText("%38.42")).toBeInTheDocument();
    // 37.55 - 38.42 = -0.87 puan = -87 bp
    expect(screen.getByText("%37.55 (-87 bp)")).toBeInTheDocument();
  });

  it("ISIN taşımayan ilk seride bile ISIN'i olan yükten alır", () => {
    const karisik = [{ name: "eğri", value: 38, color: "#0", payload: { kalanVadeYil: 7.08 } }, ...yuk];
    render(<KarsilastirmaTooltip active payload={karisik} referansAdi="08.09.2026" />);
    expect(screen.getByText("TRT051033T12")).toBeInTheDocument();
  });

  it("yük boşsa hiçbir şey render etmez", () => {
    const { container } = render(<KarsilastirmaTooltip active payload={[]} referansAdi="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
