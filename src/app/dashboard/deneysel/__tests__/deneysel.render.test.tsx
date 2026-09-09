/**
 * Deneysel sayfasının render testleri.
 *
 * Sayfanın iki ekranı da rv-analiz.ts'in ÇIKTISINI biçimlendiriyor; matematik
 * zaten golden testlerle doğrulanmış durumda. Buradaki testler farklı bir
 * riski kovalıyor: veri gelmediğinde/az geldiğinde sayfa BOŞ mu kalıyor,
 * yoksa ne olduğunu söyleyen bir kutu mu basıyor -- ve veri geldiğinde
 * gerçekten satır basıyor mu.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeneyselClient } from "../deneysel-client";

// Recharts jsdom'da 0x0 ölçüp hiçbir şey çizmiyor; grafik bu testlerin
// konusu değil, tablo/kart metni konusu.
vi.mock("../carry-roll-grafigi", () => ({
  CarryRollGrafigi: () => <div data-testid="carry-roll-grafigi" />,
}));

/** Nelson-Siegel uyarlaması için en az 5 kağıt gerekiyor; 6 üretiyoruz. */
function ornekVeri() {
  const isinler = [
    { isin: "TRB100227T13", vade: "10.02.2027", getiri: 37.1, kupon: null },
    { isin: "TRT060127T10", vade: "06.01.2027", getiri: 37.23, kupon: null },
    { isin: "TRT140727T14", vade: "14.07.2027", getiri: 38.7, kupon: 0.2 },
    { isin: "TRT150328T24", vade: "15.03.2028", getiri: 39.67, kupon: 0.21 },
    { isin: "TRT120929T12", vade: "12.09.2029", getiri: 38.85, kupon: 0.19 },
    { isin: "TRT051033T12", vade: "05.10.2033", getiri: 33.85, kupon: 0.16 },
  ];

  return {
    isinOzet: isinler.map((k) => ({
      isin: k.isin,
      senet_tanimi: k.kupon == null ? "Hazine Bonosu" : "Sabit Kuponlu Devlet Tahvili",
      vade_tarihi: k.vade,
      para_birimi: "TRY",
      tahmini_kupon_orani: k.kupon,
      ilk_valor_tarihi: "01.01.2026",
      ilk_ihrac_tarihi: null,
    })),
    bist: isinler.map((k) => ({
      tarih: "2026-09-08",
      isin: k.isin,
      kapanis_bilesik_getiri_pct: k.getiri,
      islem_hacmi_tl: 200_000_000,
    })),
    tlrefSonPct: 36.91,
  };
}

describe("DeneyselClient", () => {
  it("BIST verisi yoksa boş kutu basar, sessizce boş kalmaz", () => {
    render(<DeneyselClient isinOzet={[]} bist={[]} tlrefSonPct={null} />);
    expect(screen.getByText("BIST fiyat verisi bulunamadı.")).toBeInTheDocument();
  });

  it("TLREF yoksa Carry hesaplanamadığını söyler", () => {
    const { isinOzet, bist } = ornekVeri();
    render(<DeneyselClient isinOzet={isinOzet} bist={bist} tlrefSonPct={null} />);
    expect(screen.getByText("TLREF verisi yok")).toBeInTheDocument();
  });

  it("5'ten az kağıt varsa Nelson-Siegel uyarlanamadığını söyler", () => {
    const { isinOzet, bist, tlrefSonPct } = ornekVeri();
    render(
      <DeneyselClient
        isinOzet={isinOzet.slice(0, 3)}
        bist={bist.slice(0, 3)}
        tlrefSonPct={tlrefSonPct}
      />,
    );
    expect(screen.getByText("Bu tarihte yeterli ISIN yok")).toBeInTheDocument();
  });

  it("Trade Ekranı ya bir çift ya da 'sinyal yok' basar -- ikisi de içerik", () => {
    const { isinOzet, bist, tlrefSonPct } = ornekVeri();
    render(<DeneyselClient isinOzet={isinOzet} bist={bist} tlrefSonPct={tlrefSonPct} />);

    expect(screen.getByText("Bugün ne yapmalıyım")).toBeInTheDocument();

    const ciftVar = screen.queryByText("LONG (al)") != null;
    const sinyalYok = screen.queryByText(/strateji sinyal VERMİYOR/) != null;
    expect(ciftVar || sinyalYok).toBe(true);
  });

  it("Carry/Roll sekmesi kağıt başına satır ve toplam sayısını basar", async () => {
    const kullanici = userEvent.setup();
    const { isinOzet, bist, tlrefSonPct } = ornekVeri();
    render(<DeneyselClient isinOzet={isinOzet} bist={bist} tlrefSonPct={tlrefSonPct} />);

    await kullanici.click(screen.getByRole("tab", { name: "Carry/Roll Hesaplayıcı" }));

    expect(screen.getByText("En iyi Carry+Roll")).toBeInTheDocument();
    expect(screen.getByTestId("carry-roll-grafigi")).toBeInTheDocument();

    // Kupon/duration'ı olan kağıtlar tabloya giriyor; en az biri basılmalı.
    const satirlar = screen.getAllByRole("row");
    expect(satirlar.length).toBeGreaterThan(1);
  });

  it("hacim eşiği yükseltilince kağıt elenir", async () => {
    const kullanici = userEvent.setup();
    const { isinOzet, bist, tlrefSonPct } = ornekVeri();
    // Kuponlu (dolayısıyla Carry/Roll tablosuna giren) tek bir kağıdın
    // hacmini eşiğin altına indiriyoruz.
    const azHacimli = bist.map((r) =>
      r.isin === "TRT051033T12" ? { ...r, islem_hacmi_tl: 1_000_000 } : r,
    );

    render(<DeneyselClient isinOzet={isinOzet} bist={azHacimli} tlrefSonPct={tlrefSonPct} />);
    await kullanici.click(screen.getByRole("tab", { name: "Carry/Roll Hesaplayıcı" }));

    // Önce eşiksiz: kağıt LİSTEDE olmalı (yoksa aşağıdaki "yok" iddiası
    // hiçbir şey kanıtlamazdı).
    await kullanici.selectOptions(screen.getByLabelText("Min. günlük hacim"), "0");
    expect(screen.getByText("TRT051033T12")).toBeInTheDocument();

    // Sonra eşik yükseltilince eleniyor: 6 kağıttan 5'i kalıyor, Nelson-Siegel
    // yine uyarlanabiliyor ama elenen kağıt tabloda görünmemeli.
    await kullanici.selectOptions(screen.getByLabelText("Min. günlük hacim"), "250000000");
    expect(screen.queryByText("TRT051033T12")).not.toBeInTheDocument();
  });
});
