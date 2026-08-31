/** Contrôle de la formule Essentiel en production. Restaure toujours la formule d'origine. */
import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.deploy" });
const B = "https://nzilabiz.store";
const DEMO = "nwh09na1om21jh38phz22nnn";

function motDePasse() {
  const txt = fs.readFileSync("sauvegardes/compte-administrateur.txt", "utf8");
  const l = txt.split(/\r?\n/).find((x) => x.startsWith("Mot de passe"));
  return l!.replace(/^[^:]*:\s*/, "").trim();
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  const [avant] = await sql`select plan from stores where id = ${DEMO}`;
  const planOrigine = avant.plan as string;
  console.log(`formule d'origine : ${planOrigine}\n`);

  // Connexion
  const rc = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nzilabiz@gmail.com", password: motDePasse() }),
  });
  const cookie = (rc.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  console.log("connexion :", rc.status, cookie ? "(session obtenue)" : "(PAS DE COOKIE)");

  const H = { cookie, "Content-Type": "application/json" };
  const verifs: [string, string, RequestInit?][] = [
    ["dépenses      ", "/api/depenses"],
    ["rapports      ", "/api/rapports"],
    ["documents     ", "/api/documents"],
    ["devise (écrit)", "/api/parametres/devise", { method: "PUT", body: JSON.stringify({ devise: "XAF" }) }],
    ["stock (cœur)  ", "/api/stock/products"],
    ["clients (cœur)", "/api/clients"],
    ["dashboard     ", "/api/dashboard"],
  ];

  async function passe(titre: string) {
    console.log(`\n=== ${titre} ===`);
    for (const [nom, url, init] of verifs) {
      const r = await fetch(B + url, { headers: H, ...(init ?? {}) });
      let code = "";
      try {
        code = ((await r.clone().json()) as { code?: string }).code ?? "";
      } catch {}
      console.log(`  ${nom} → ${r.status}${code ? "  " + code : ""}`);
    }
    const r = await fetch(`${B}/api/parametres/utilisateurs`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ nom: "Test plafond", email: `plafond.${Date.now()}@exemple.test`, role: "VENDEUR" }),
    });
    const j = (await r.json().catch(() => ({}))) as { code?: string };
    console.log(`  ajout compte  → ${r.status}${j.code ? "  " + j.code : ""}`);
  }

  try {
    await passe(`AVANT — formule ${planOrigine}`);
    await sql`update stores set plan = 'ESSENTIEL' where id = ${DEMO}`;
    await passe("APRÈS — formule ESSENTIEL");
  } finally {
    await sql`update stores set plan = ${planOrigine}::subscription_plan where id = ${DEMO}`;
    const [apres] = await sql`select plan from stores where id = ${DEMO}`;
    console.log(`\nformule restaurée : ${apres.plan}`);
    await sql.end();
  }
}

main().catch(async (e) => {
  console.error("ÉCHEC :", e instanceof Error ? e.message : e);
  process.exit(1);
});
