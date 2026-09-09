import { describe, expect, it } from "vitest";
import { yumusakEksen } from "../eksen";

describe("yumusakEksen", () => {
  it("getiri eğrisindeki gerçek aralığı yuvarlak değerlere çeker", () => {
    // İncelemede raporlanan durum: 33.35 · 35.35 · 37.35 · 39.35 · 40.43
    const a = yumusakEksen([33.85, 40.43, 37.2, 39.1])!;
    expect(a.ticks.every((t) => Number.isInteger(t * 2))).toBe(true);
    expect(a.domain[0]).toBeLessThanOrEqual(33.85);
    expect(a.domain[1]).toBeGreaterThanOrEqual(40.43);
  });

  it("aralıklar eşit", () => {
    const { ticks } = yumusakEksen([0.1, 9.2])!;
    const farklar = ticks.slice(1).map((t, i) => Number((t - ticks[i]).toFixed(10)));
    expect(new Set(farklar).size).toBe(1);
  });

  it("tüm veriyi kapsar", () => {
    for (const veri of [[1, 2, 3], [-50, 120], [0.001, 0.009], [1000, 999999]]) {
      const { domain } = yumusakEksen(veri)!;
      expect(domain[0]).toBeLessThanOrEqual(Math.min(...veri));
      expect(domain[1]).toBeGreaterThanOrEqual(Math.max(...veri));
    }
  });

  it("negatif değerlerde de çalışır", () => {
    const { domain, ticks } = yumusakEksen([-364, 86])!;
    expect(domain[0]).toBeLessThanOrEqual(-364);
    expect(ticks).toContain(0);
  });

  it("tek değerde sonsuz döngüye girmez, etrafında aralık açar", () => {
    const { domain, ticks } = yumusakEksen([42, 42, 42])!;
    expect(domain[0]).toBeLessThan(42);
    expect(domain[1]).toBeGreaterThan(42);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it("sıfır serisinde de patlamaz", () => {
    const a = yumusakEksen([0, 0])!;
    expect(a.ticks.length).toBeGreaterThan(1);
  });

  it("veri yoksa null döner", () => {
    expect(yumusakEksen([])).toBeNull();
    expect(yumusakEksen([NaN, Infinity])).toBeNull();
  });

  it("hedef aralık sayısına yakın sayıda tick üretir", () => {
    const { ticks } = yumusakEksen([0, 100], 5)!;
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(9);
  });
});
