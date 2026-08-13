import type { Permission } from "@/lib/auth/rbac";

export type NavItem = {
  href: string;
  labelKey: string;
  permission: Permission;
};

export type NavSection = {
  titleKey: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.sectionVente",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", permission: "dashboard.view" },
      { href: "/vendre", labelKey: "nav.vendre", permission: "vendre.use" },
      { href: "/ventes", labelKey: "nav.ventes", permission: "ventes.view.own" },
    ],
  },
  {
    titleKey: "nav.sectionBoutique",
    items: [
      { href: "/stock", labelKey: "nav.stock", permission: "stock.view" },
      { href: "/creances", labelKey: "nav.creances", permission: "creances.view" },
      { href: "/depenses", labelKey: "nav.depenses", permission: "depenses.view" },
      { href: "/synchronisation", labelKey: "nav.synchronisation", permission: "synchronisation.view" },
    ],
  },
  {
    titleKey: "nav.sectionAnalyse",
    items: [
      { href: "/documents", labelKey: "nav.documents", permission: "documents.view" },
      { href: "/rapports", labelKey: "nav.rapports", permission: "rapports.view" },
    ],
  },
];
