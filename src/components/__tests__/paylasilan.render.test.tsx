/**
 * Paylaşılan sunum bileşenlerinin render testleri. Bu üçü sayfaların çoğunda
 * kullanıldığı için buradaki bir regresyon tek yerde değil her yerde kırılır.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OzetSerit } from "../ozet-serit";
import { BosDurum } from "../bos-durum";
import { ZamanAraligiSecici, araligaGoreBaslangic, zamanaGoreSuz } from "../zaman-araligi";

describe("OzetSerit", () => {
  it("etiket, değer ve alt bilgiyi basar", () => {
    render(
      <OzetSerit
        alanlar={[
          { etiket: "Bileşik getiri", deger: "%41.71", altBilgi: "Valör: 08.09.2026" },
          { etiket: "Dönem kuponu", deger: "%19.02" },
        ]}
      />,
    );
    expect(screen.getByText("Bileşik getiri")).toBeInTheDocument();
    expect(screen.getByText("%41.71")).toBeInTheDocument();
    expect(screen.getByText("Valör: 08.09.2026")).toBeInTheDocument();
    expect(screen.getByText("%19.02")).toBeInTheDocument();
  });

  it("alan yoksa hiç render etmez (boş çerçeve bırakmaz)", () => {
    const { container } = render(<OzetSerit alanlar={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("yardım metnini title olarak taşır", () => {
    render(<OzetSerit alanlar={[{ etiket: "DV01", deger: "0.0080", yardim: "1 bp fiyat etkisi" }]} />);
    expect(screen.getByTitle("1 bp fiyat etkisi")).toBeInTheDocument();
  });

  it("dar ekranda kırpmak yerine yatay kaydırır", () => {
    const { container } = render(<OzetSerit alanlar={[{ etiket: "a", deger: "1" }]} />);
    expect(container.firstElementChild).toHaveClass("overflow-x-auto");
  });
});

describe("BosDurum", () => {
  it("başlığı ve açıklamayı gösterir", () => {
    render(<BosDurum baslik="TLREF oranı verisi yok" aciklama="Seri henüz aktarılmadı." />);
    expect(screen.getByText("TLREF oranı verisi yok")).toBeInTheDocument();
    expect(screen.getByText("Seri henüz aktarılmadı.")).toBeInTheDocument();
  });

  it("açıklama verilmezse sadece başlığı gösterir", () => {
    render(<BosDurum baslik="Veri yok" />);
    expect(screen.getByText("Veri yok")).toBeInTheDocument();
  });
});

describe("ZamanAraligiSecici", () => {
  it("verilen seçenekleri TR etiketleriyle basar", () => {
    render(<ZamanAraligiSecici deger="ytd" onChange={() => {}} secenekler={["1a", "ytd", "tum"]} />);
    expect(screen.getByRole("button", { name: "1 Ay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yılbaşından" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tümü" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3 yıl" })).not.toBeInTheDocument();
  });

  it("tıklanınca seçilen aralığı bildirir", async () => {
    const onChange = vi.fn();
    render(<ZamanAraligiSecici deger="ytd" onChange={onChange} secenekler={["1a", "ytd"]} />);
    await userEvent.click(screen.getByRole("button", { name: "1 Ay" }));
    expect(onChange).toHaveBeenCalledWith("1a");
  });
});

describe("zamanaGoreSuz / araligaGoreBaslangic", () => {
  it("'tum' hiçbir kaydı elemez", () => {
    const veri = [{ tarih: "2019-01-01" }, { tarih: "2026-09-01" }];
    expect(zamanaGoreSuz(veri, "tum")).toHaveLength(2);
    expect(araligaGoreBaslangic("tum")).toBeNull();
  });

  it("'ytd' yılbaşından önceki kayıtları eler", () => {
    const yil = new Date().getFullYear();
    const veri = [{ tarih: `${yil - 1}-12-31` }, { tarih: `${yil}-01-01` }];
    expect(zamanaGoreSuz(veri, "ytd").map((r) => r.tarih)).toEqual([`${yil}-01-01`]);
    expect(araligaGoreBaslangic("ytd")).toBe(`${yil}-01-01`);
  });

  it("kısa aralıklar uzun aralıkların alt kümesidir", () => {
    const veri = Array.from({ length: 40 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { tarih: d.toISOString().slice(0, 10) };
    });
    expect(zamanaGoreSuz(veri, "1a").length).toBeLessThanOrEqual(zamanaGoreSuz(veri, "6a").length);
    expect(zamanaGoreSuz(veri, "6a").length).toBeLessThanOrEqual(zamanaGoreSuz(veri, "1y").length);
    expect(zamanaGoreSuz(veri, "1y").length).toBeLessThanOrEqual(veri.length);
  });
});
