import { NextResponse } from "next/server";
import { getSession, peut } from "@/lib/auth/session";
import { getDashboardData } from "@/components/dashboard/get-dashboard-data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "dashboard.view"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const data = await getDashboardData(session.storeId);
  return NextResponse.json(data);
}
