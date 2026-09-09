/**
 * "Bu hafta" bildiriminin render davranışı -- ihaleli haftanın GERÇEK
 * takvim verisiyle (fixtures/hafta-takvim.json).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HaftaBildirimi } from "../hafta-bildirimi";
import { olaylariKur } from "@/lib/haftalik-olaylar";
import veri from "@/lib/__tests__/fixtures/hafta-takvim.json";

const ihaleOlaylari = olaylariKur(veri.ihaleHaftasi.tcmb, veri.ihaleHaftasi.ihrac, {
  baslangic: veri.ihaleHaftasi.baslangic,
  bitis: veri.ihaleHaftasi.bitis,
});

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

/** Giriş gecikmesini geçip bildirimi ekrana getirir. */
const gosterilsin = async () => {
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
};

describe("HaftaBildirimi — ihaleli hafta", () => {
  it("giriş gecikmesinden önce görünmez", () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ihaleleri senet türü ve vadesiyle gösterir", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("İhale: Sabit Kuponlu Devlet Tahvili (2 Yıl / 728 Gün)")).toBeInTheDocument();
    expect(screen.getByText("Doğrudan satış: Kira Sertifikası (2 Yıl / 728 Gün)")).toBeInTheDocument();
  });

  it("günleri Türkçe gün adı ve gg.aa ile gruplar", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    // 14.09.2026 Pazartesi, 15.09.2026 Salı
    expect(screen.getByText("Pazartesi")).toBeInTheDocument();
    expect(screen.getByText("Salı")).toBeInTheDocument();
    expect(screen.getByText("14.09")).toBeInTheDocument();
    expect(screen.getByText("15.09")).toBeInTheDocument();
  });

  it("aynı ihaleyi iki kez basmaz", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    expect(
      screen.getAllByText("İhale: Sabit Kuponlu Devlet Tahvili (2 Yıl / 728 Gün)"),
    ).toHaveLength(1);
  });

  it("3 dakika sonra kendiliğinden kapanır", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // 3 dakikadan ÖNCE hâlâ ekranda olmalı.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3 * 60_000 + 400);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("kapat düğmesiyle elle kapatılabilir", async () => {
    const kullanici = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    await kullanici.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("oturumda ikinci kez gösterilmez", async () => {
    const { unmount } = render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    expect(screen.getByRole("status")).toBeInTheDocument();
    unmount();

    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: false }} />);
    await gosterilsin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("olay yoksa hiç render etmez", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: [], ileriBakis: false }} />);
    await gosterilsin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ileri bakış modunda başlık değişir", async () => {
    render(<HaftaBildirimi ozet={{ olaylar: ihaleOlaylari, ileriBakis: true }} />);
    await gosterilsin();
    expect(screen.getByText("Önümüzdeki 7 gün")).toBeInTheDocument();
    expect(screen.queryByText("Bu hafta")).not.toBeInTheDocument();
  });
});
