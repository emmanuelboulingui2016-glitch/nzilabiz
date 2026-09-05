// GET /api/vendre/produits — liste des produits (recherche/filtrage) + catégories dynamiques pour
// la grille de l'écran Vendre. Renvoie aussi la liste des clients de la boutique : l'écran Vendre a
// besoin d'un sélecteur client (obligatoire en cas de paiement Crédit) et le module Clients n'expose
// pas encore d'endpoint dédié dans ce périmètre — bundlé ici pour éviter de créer un fichier hors
// périmètre (§ voir résumé final).

import { NextResponse } from "next/server";
import { getSession, peut } from "@/lib/auth/session";
import { chargerVendre } from "@/components/vendre/get-vendre-data";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await peut(session, "vendre.use"))) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  return NextResponse.json(
    await chargerVendre(session.storeId, {
      q: searchParams.get("q"),
      categoryId: searchParams.get("categoryId"),
      codeBarres: searchParams.get("codeBarres"),
    })
  );
}
