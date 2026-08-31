import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { etatBoutiqueCourante } from "@/lib/abonnement";
import { EcranBlocage } from "@/components/abonnement/ecran-blocage";

// Volontairement HORS du groupe (app).
//
// La première version rendait cet écran depuis le calque de (app), à la place de `{children}`. Le
// blocage n'était alors que visuel : Next.js rend la page en parallèle du calque, et ne pas
// l'afficher ne l'empêche ni de s'exécuter, ni de faire ses requêtes, ni de déposer ses résultats
// dans la charge envoyée au navigateur. Le contrôle a montré « CA du jour » et « Ventes de la
// semaine » présents dans le HTML d'une boutique pourtant bloquée.
//
// Le calque redirige donc désormais vers cette page, située en dehors de son arborescence :
// `redirect()` interrompt le rendu, et aucune donnée de la boutique n'est calculée ni transmise.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accès suspendu — NzilaBiz",
  robots: { index: false, follow: false },
};

export default async function AbonnementExpirePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const etat = await etatBoutiqueCourante();

  // Boutique réactivée entre-temps : on ne laisse personne coincé sur un écran de blocage périmé.
  if (!etat || etat.actif) redirect("/dashboard");

  const boutique = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });

  return <EcranBlocage etat={etat} nomBoutique={boutique?.nom ?? "votre boutique"} />;
}
