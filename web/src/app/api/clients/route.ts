// Module Clients — gestion de la clientèle (fiches, fidélité, relances).
//
// GET  : liste des clients de la boutique enrichie des statistiques d'achat calculées en SQL
//        (nombre d'achats, chiffre d'affaires, panier moyen, premier/dernier achat), du solde
//        de créance, et du segment de fidélité déduit de ces chiffres (voir lib/clients/loyalty).
// POST : création d'une fiche client.
//
// Ce module partage la table `clients` avec le module Créances (§9) : un client créé ici est
// immédiatement sélectionnable en caisse et dans les créances, et inversement.

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerClients } from "@/components/clients/get-clients-data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "clients.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return NextResponse.json({ clients: await chargerClients(session.storeId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "clients.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || !body.nom.trim()) {
    return NextResponse.json({ error: "Le nom du client est requis" }, { status: 400 });
  }

  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const [created] = await db
    .insert(clients)
    .values({
      storeId: session.storeId,
      nom: body.nom.trim(),
      telephone: text(body.telephone),
      email: text(body.email),
      adresse: text(body.adresse),
      notes: text(body.notes),
      limiteCredit:
        body.limiteCredit === null || body.limiteCredit === undefined || body.limiteCredit === ""
          ? null
          : String(body.limiteCredit),
      echeanceJours:
        body.echeanceJours === null || body.echeanceJours === undefined || body.echeanceJours === ""
          ? null
          : Number(body.echeanceJours),
    })
    .returning();

  return NextResponse.json({ client: created }, { status: 201 });
}
