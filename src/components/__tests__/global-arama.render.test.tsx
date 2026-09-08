/**
 * Global arama render/davranış testleri. Bu bileşen üst barın tek gezinme
 * kısayolu: eşleşme mantığı (Türkçe küçültme), alt sekmeye derin bağlantı ve
 * klavye gezinmesi bozulursa kullanıcı ISIN'e ulaşamıyor.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalArama, type AramaKagidi } from "../global-arama";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...a: unknown[]) => push(...a), prefetch: vi.fn() }),
}));

const KAGITLAR: AramaKagidi[] = [
  { isin: "TRT140623T19", tanim: "Sabit Kuponlu Devlet Tahvili" },
  { isin: "TRT070727T13", tanim: "TÜFE'ye Endeksli Devlet Tahvili" },
];

const kur = () => {
  push.mockClear();
  render(<GlobalArama kagitlar={KAGITLAR} />);
  return screen.getByRole("textbox", { name: "Sayfa veya kağıt ara" });
};

describe("GlobalArama", () => {
  it("boş sorguda liste açılmaz", async () => {
    const girdi = kur();
    await userEvent.click(girdi);
    expect(screen.queryByText("Sonuç yok.")).not.toBeInTheDocument();
  });

  it("ISIN'e göre kağıt bulur ve DİBS Detay'a isin parametresiyle gider", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "TRT1406");
    const sonuc = await screen.findByRole("button", { name: /TRT140623T19/ });
    await userEvent.click(sonuc);
    expect(push).toHaveBeenCalledWith("/dashboard/dibs-detay?isin=TRT140623T19");
  });

  it("kağıt adına göre de bulur (sadece ISIN değil)", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "tüfe");
    expect(await screen.findByRole("button", { name: /TRT070727T13/ })).toBeInTheDocument();
  });

  it("büyük/küçük harf farkı eşleşmeyi bozmaz", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "trt1406");
    expect(await screen.findByRole("button", { name: /TRT140623T19/ })).toBeInTheDocument();
  });

  it("alt sekmeyi doğrudan açar (sayfanın ilk sekmesini değil)", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "TLREF");
    const sonuc = await screen.findByRole("button", { name: /TLREF/ });
    await userEvent.click(sonuc);
    expect(push).toHaveBeenCalledTimes(1);
    // TLREF, TCMB sayfasının bir ALT SEKMESİ -- ?tab= olmadan yanlış sekme açılır.
    expect(String(push.mock.calls[0][0])).toMatch(/^\/dashboard\/tcmb\?tab=/);
  });

  it("eşleşme yoksa 'Sonuç yok.' der", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "zzzzzz");
    expect(await screen.findByText("Sonuç yok.")).toBeInTheDocument();
  });

  it("Enter ilk sonuca gider, ok tuşu vurguyu kaydırır", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "TRT");
    await screen.findAllByRole("button");
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("Escape listeyi kapatır", async () => {
    const girdi = kur();
    await userEvent.type(girdi, "TRT1406");
    expect(await screen.findByRole("button", { name: /TRT140623T19/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /TRT140623T19/ })).not.toBeInTheDocument();
  });

  it("bir sonuca gidilince onGezindi çağrılır (mobil menü kapansın diye)", async () => {
    const onGezindi = vi.fn();
    push.mockClear();
    render(<GlobalArama kagitlar={KAGITLAR} onGezindi={onGezindi} />);
    const girdi = screen.getByRole("textbox", { name: "Sayfa veya kağıt ara" });
    await userEvent.type(girdi, "TRT1406");
    await userEvent.click(await screen.findByRole("button", { name: /TRT140623T19/ }));
    expect(onGezindi).toHaveBeenCalled();
  });
});
