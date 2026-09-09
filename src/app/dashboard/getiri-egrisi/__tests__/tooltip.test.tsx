/**
 * NoktaTooltip sözleşmesi. Gerçek bir çökme buradan geldi: Nelson-Siegel
 * grafiğinde imleç EĞRİNİN üstüne gelince Recharts tooltip'e {kalanVadeYil,
 * egri} taşıyan bir nokta veriyor -- getiri/ISIN yok. Eski kod koşulsuz
 * p.getiri.toFixed() çağırdığı için bileşen çöküp hata ekranını açıyordu.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoktaTooltip } from "../getiri-egrisi-client";

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

  it("boş/eksik yükte hiçbir şey render etmez", () => {
    const { container: a } = render(<NoktaTooltip active payload={[]} />);
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(<NoktaTooltip active payload={sar({})} />);
    expect(b).toBeEmptyDOMElement();
  });
});
