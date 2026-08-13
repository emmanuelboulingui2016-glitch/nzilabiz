import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Onglet Mobile Money — §14 + §16 🔧 amélioration (« arrive bientôt » dans l'app d'origine).
//
// 🔧 Écart documenté (voir résumé de tâche / README) : `src/db/schema.ts` est partagé et hors
// périmètre de cet agent, et il n'existe aucune table dédiée à la configuration Mobile Money de
// la boutique (clé API agrégateur, priorité opérateur, etc.). Cette route existe pour que
// l'intégration future ait un point d'entrée serveur clair, mais elle ne persiste RIEN pour
// l'instant : la configuration réelle est stockée côté client (localStorage), voir
// src/components/parametres/mobile-money/mobile-money-form.tsx. Une prochaine itération doit
// ajouter une table `mobile_money_settings` (storeId unique) et brancher GET/PUT dessus.

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.mobilemoney")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.json({
    configured: false,
    note:
      "Aucun stockage serveur pour la configuration Mobile Money pour l'instant — schema.ts n'a pas de table dédiée. La configuration est conservée localement sur cet appareil (localStorage) en attendant.",
  });
}

export async function PUT() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.mobilemoney")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.json(
    {
      error:
        "Non implémenté côté serveur : il manque une table dédiée dans schema.ts (hors périmètre de cet agent). Utilisez la configuration locale (enregistrée automatiquement dans ce navigateur) en attendant une prochaine itération.",
    },
    { status: 501 }
  );
}
