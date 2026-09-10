import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Fixture katmani cwd'ye ve FIXTURE ortam degiskenine modul yuklenirken
 * bakiyor, bu yuzden test onu ayri bir surecte iki kez calistiriyor:
 * once kaydet, sonra yalnizca diskten oku.
 */
function calistir(mod: string, dizin: string, canliDeger: string) {
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", join(process.cwd(), "scripts/fixture-kosucu.mjs")],
    { cwd: dizin, env: { ...process.env, FIXTURE: mod, CANLI_DEGER: canliDeger }, encoding: "utf8" },
  ).trim();
}

describe("fixture modu", () => {
  it("kaydediyor, sonra ayni yaniti diskten donduruyor", () => {
    const dizin = mkdtempSync(join(tmpdir(), "fixture-"));
    try {
      expect(calistir("kaydet", dizin, "kaydedilen")).toBe("kaydedilen");
      expect(readdirSync(join(dizin, "fixture"))).toHaveLength(1);
      // Canli yanit artik farkli: "kaydedilen" gelirse deger diskten okundu.
      expect(calistir("1", dizin, "canli")).toBe("kaydedilen");
    } finally {
      rmSync(dizin, { recursive: true, force: true });
    }
  });

  it("kapaliyken devreye girmiyor", async () => {
    const { fixtureAcik } = await import("../supabase/fixture");
    expect(fixtureAcik).toBe(false);
  });
});
