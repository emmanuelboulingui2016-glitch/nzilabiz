"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui";
import type { CreanceClient } from "@/lib/creances/solde";
import { DebtorsTab } from "./debtors-tab";
import { RepaymentsTab } from "./repayments-tab";

export function CreancesView({ debiteurs, canEdit }: { debiteurs: CreanceClient[]; canEdit: boolean }) {
  const [tab, setTab] = useState<"debiteurs" | "remboursements">("debiteurs");

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as "debiteurs" | "remboursements")}
        tabs={[
          { value: "debiteurs", label: "Clients débiteurs" },
          { value: "remboursements", label: "Remboursements reçus" },
        ]}
      />
      {tab === "debiteurs" ? <DebtorsTab initial={debiteurs} canEdit={canEdit} /> : <RepaymentsTab canEdit={canEdit} />}
    </div>
  );
}
