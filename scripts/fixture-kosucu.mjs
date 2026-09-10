// src/lib/__tests__/fixture.test.ts tarafindan ayri surecte calistirilir
// (fixture katmani FIXTURE'a ve cwd'ye modul yuklenirken bakiyor).
// tsc'nin gormemesi icin src/ disinda ve duz JS: node ice aktarilan .ts'i
// --experimental-strip-types ile kendisi soyuyor.
import { fixtureFetch } from "../src/lib/supabase/fixture.ts";

globalThis.fetch = async () =>
  new Response(JSON.stringify({ deger: process.env.CANLI_DEGER }), {
    headers: { "content-type": "application/json" },
  });

const y = await fixtureFetch()("https://ornek.supabase.co/rest/v1/isin_ozet?select=isin");
process.stdout.write((await y.json()).deger);
