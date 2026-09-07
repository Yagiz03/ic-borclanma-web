import { nakitAkislariniOlustur, modifiedDurationHesapla, dv01Hesapla } from "./bond-math/tahvil-fiyatlama";

export type NelsonSiegelParams = { b0: number; b1: number; b2: number; tau: number };

function tasarimMatrisi(t: number[], tau: number): number[][] {
  return t.map((ti) => {
    const x = ti / tau;
    const f1 = x > 1e-8 ? (1 - Math.exp(-x)) / Math.max(x, 1e-8) : 1.0;
    const f2 = f1 - Math.exp(-x);
    return [1, f1, f2];
  });
}

function lstsq3(A: number[][], y: number[]): number[] | null {
  // Normal equations: (A^T A) beta = A^T y, 3x3 sistemi elle çöz.
  const AtA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const Aty = [0, 0, 0];
  for (let i = 0; i < A.length; i++) {
    const row = A[i];
    for (let r = 0; r < 3; r++) {
      Aty[r] += row[r] * y[i];
      for (let c = 0; c < 3; c++) AtA[r][c] += row[r] * row[c];
    }
  }
  // 3x3 Gauss elimination with partial pivoting
  const M = AtA.map((row, i) => [...row, Aty[i]]);
  for (let col = 0; col < 3; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    if (Math.abs(M[pivotRow][col]) < 1e-12) return null;
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

export function nelsonSiegelFit(
  vadeler: number[],
  getiriler: number[],
): { tahmin: (t: number | number[]) => number | number[]; params: NelsonSiegelParams } | null {
  const pairs = vadeler
    .map((v, i) => [v, getiriler[i]] as const)
    .filter(([v, g]) => Number.isFinite(v) && Number.isFinite(g) && v > 0);
  if (pairs.length < 5) return null;
  const t = pairs.map((p) => p[0]);
  const y = pairs.map((p) => p[1]);

  let en_iyi: { hata: number; tau: number; beta: number[] } | null = null;
  for (const tau of [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]) {
    const A = tasarimMatrisi(t, tau);
    const beta = lstsq3(A, y);
    if (!beta) continue;
    const hata = A.reduce((s, row, i) => s + (row[0] * beta[0] + row[1] * beta[1] + row[2] * beta[2] - y[i]) ** 2, 0);
    if (!en_iyi || hata < en_iyi.hata) en_iyi = { hata, tau, beta };
  }
  if (!en_iyi) return null;
  const { tau, beta } = en_iyi;

  function tahmin(tIn: number | number[]): number | number[] {
    const arr = Array.isArray(tIn) ? tIn : [tIn];
    const A = tasarimMatrisi(arr, tau);
    const sonuc = A.map((row) => row[0] * beta[0] + row[1] * beta[1] + row[2] * beta[2]);
    return Array.isArray(tIn) ? sonuc : sonuc[0];
  }

  return { tahmin, params: { b0: beta[0], b1: beta[1], b2: beta[2], tau } };
}

/** 2. derece polinom fit: y ~= c0 + c1*x + c2*x^2. Dönüş: (x)=>y fonksiyonu, ya da null. */
export function polinom2Fit(x: number[], y: number[]): ((t: number) => number) | null {
  if (x.length < 3) return null;
  const A = x.map((xi) => [1, xi, xi * xi]);
  const beta = lstsq3(A, y);
  if (!beta) return null;
  return (t: number) => beta[0] + beta[1] * t + beta[2] * t * t;
}

export function tlrefBilesikFonlama(tlrefBasitPct: number): number {
  return ((1 + tlrefBasitPct / 100 / 365) ** 365 - 1) * 100;
}

export type RvSatiri = {
  isin: string;
  senetTanimi: string | null;
  vade: Date | null;
  kalanVadeYil: number;
  getiri: number;
  egriBeklenen: number;
  spreadBps: number;
  zSkoru: number;
  modDur: number | null;
  dv01: number | null;
  carryBp: number | null;
  rollBp: number | null;
  konverjansBp: number | null;
  toplamBp: number | null;
};

export function rvEkraniOlustur(
  gunluk: { isin: string; senetTanimi: string | null; vade: Date | null; kalanVadeYil: number; getiri: number }[],
  kuponMap: Map<string, number>,
  anchorMap: Map<string, Date>,
  fonlamaBilesikPct: number | null,
  referans: Date,
  ufukAy = 3,
): RvSatiri[] | null {
  if (gunluk.length < 5) return null;
  const fit = nelsonSiegelFit(
    gunluk.map((r) => r.kalanVadeYil),
    gunluk.map((r) => r.getiri),
  );
  if (!fit) return null;

  const egriBeklenenler = fit.tahmin(gunluk.map((r) => r.kalanVadeYil)) as number[];
  const spreadler = gunluk.map((r, i) => (r.getiri - egriBeklenenler[i]) * 100);
  const ortalama = spreadler.reduce((s, v) => s + v, 0) / spreadler.length;
  const varyans = spreadler.reduce((s, v) => s + (v - ortalama) ** 2, 0) / spreadler.length;
  const std = Math.sqrt(varyans);

  const hYil = ufukAy / 12;

  const satirlar: RvSatiri[] = gunluk.map((r, i) => {
    const egriBeklenen = egriBeklenenler[i];
    const spreadBps = spreadler[i];
    const zSkoru = std ? (spreadBps - ortalama) / std : 0;

    let modDur: number | null = null;
    let dv01: number | null = null;
    const kupon = kuponMap.get(r.isin);
    const anchor = anchorMap.get(r.isin);
    if (kupon != null && r.vade && anchor) {
      try {
        const akislar = nakitAkislariniOlustur(r.vade, anchor, kupon / 100);
        const y = r.getiri / 100;
        modDur = modifiedDurationHesapla(akislar, referans, y).modified;
        dv01 = dv01Hesapla(akislar, referans, y);
      } catch {
        modDur = null;
        dv01 = null;
      }
    }

    const carryBp = fonlamaBilesikPct != null ? (r.getiri - fonlamaBilesikPct) * hYil * 100 : null;

    const yeniVade = Math.max(r.kalanVadeYil - hYil, 1e-3);
    const yeniEgri = fit.tahmin(yeniVade) as number;
    const rollDy = yeniEgri - egriBeklenen;
    const rollBp = modDur != null ? -rollDy * modDur * 100 : null;

    const konverjansBp = modDur != null ? spreadBps * modDur : null;
    const toplamBp = carryBp != null && rollBp != null && konverjansBp != null ? carryBp + rollBp + konverjansBp : null;

    return {
      isin: r.isin, senetTanimi: r.senetTanimi, vade: r.vade, kalanVadeYil: r.kalanVadeYil, getiri: r.getiri,
      egriBeklenen, spreadBps, zSkoru, modDur, dv01, carryBp, rollBp, konverjansBp, toplamBp,
    };
  });

  return satirlar;
}
