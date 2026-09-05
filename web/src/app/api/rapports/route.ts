import { NextResponse } from "next/server";
import { getSession, peut } from "@/lib/auth/session";
import { getRapportsData } from "@/components/rapports/get-rapports-data";
import type { PeriodType } from "@/components/rapports/types";
import { bloquerSiHorsFormule } from "@/lib/abonnement";

const VALID_PERIODS: PeriodType[] = ["today", "week", "month", "year", "custom"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Fonctionnalité hors de la formule Essentiel : refusée ici, pas seulement masquée
  // dans le menu. Une route reste appelable même quand son bouton a disparu.
  const horsFormule = await bloquerSiHorsFormule("rapports");
  if (horsFormule) return horsFormule;
  if (!(await peut(session, "rapports.view"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "month";
  const period: PeriodType = (VALID_PERIODS as string[]).includes(periodParam) ? (periodParam as PeriodType) : "month";
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (period === "custom" && (!start || !end)) {
    return NextResponse.json({ error: "Période personnalisée : start et end sont requis (YYYY-MM-DD)." }, { status: 400 });
  }

  const data = await getRapportsData(session.storeId, period, start, end);
  return NextResponse.json(data);
}
