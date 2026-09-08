/**
 * Combobox: Pricing'de kağıt seçiminin tek yolu. Erişilebilirlik nitelikleri
 * (role="combobox" + aria-controls/aria-expanded) burada test ediliyor -- bu
 * eksikliği eslint yakalamıştı, bir daha sessizce geri gelmesin.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "../ui/combobox";

const SECENEKLER = [
  { value: "TRT140623T19", label: "TRT140623T19 — Sabit Kuponlu Devlet Tahvili", keywords: "TRT140623T19" },
  { value: "TRT070727T13", label: "TRT070727T13 — TÜFE'ye Endeksli Devlet Tahvili", keywords: "TRT070727T13" },
];

describe("Combobox", () => {
  it("erişilebilirlik nitelikleri tam", async () => {
    render(<Combobox value="" onChange={() => {}} options={SECENEKLER} placeholder="Ara" />);
    const girdi = screen.getByRole("combobox");
    expect(girdi).toHaveAttribute("aria-expanded", "false");
    expect(girdi).toHaveAttribute("aria-controls");

    await userEvent.click(girdi);
    expect(girdi).toHaveAttribute("aria-expanded", "true");
    // aria-controls, açılan listenin id'sine işaret etmeli.
    const listeId = girdi.getAttribute("aria-controls")!;
    expect(document.getElementById(listeId)).toHaveAttribute("role", "listbox");
  });

  it("yazınca seçenekleri süzer", async () => {
    render(<Combobox value="" onChange={() => {}} options={SECENEKLER} placeholder="Ara" />);
    const girdi = screen.getByRole("combobox");
    await userEvent.type(girdi, "0707");
    expect(await screen.findByRole("button", { name: /TRT070727T13/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /TRT140623T19/ })).not.toBeInTheDocument();
  });

  it("seçilince değeri bildirir", async () => {
    const onChange = vi.fn();
    render(<Combobox value="" onChange={onChange} options={SECENEKLER} placeholder="Ara" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("button", { name: /TRT140623T19/ }));
    expect(onChange).toHaveBeenCalledWith("TRT140623T19");
  });

  it("eşleşme yoksa boş metnini gösterir", async () => {
    render(
      <Combobox value="" onChange={() => {}} options={SECENEKLER} placeholder="Ara" emptyText="Eşleşen kağıt yok." />,
    );
    await userEvent.type(screen.getByRole("combobox"), "zzzz");
    expect(await screen.findByText("Eşleşen kağıt yok.")).toBeInTheDocument();
  });
});
