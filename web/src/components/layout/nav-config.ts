import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  FileText,
  HandCoins,
  LayoutDashboard,
  LineChart,
  Package,
  Receipt,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { Permission } from "@/lib/auth/rbac";

export type NavItem = {
  href: string;
  labelKey: string;
  permission: Permission;
  icon: LucideIcon;
};

export type NavSection = {
  titleKey: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.sectionVente",
    icon: ShoppingBag,
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", permission: "dashboard.view", icon: LayoutDashboard },
      { href: "/vendre", labelKey: "nav.vendre", permission: "vendre.use", icon: ShoppingCart },
      { href: "/ventes", labelKey: "nav.ventes", permission: "ventes.view.own", icon: Receipt },
    ],
  },
  {
    // Gestion de la clientèle : la fiche client et ses créances sont deux vues du même
    // interlocuteur, elles sont donc regroupées.
    titleKey: "nav.sectionClients",
    icon: Users,
    items: [
      { href: "/clients", labelKey: "nav.clients", permission: "clients.view", icon: Users },
      { href: "/creances", labelKey: "nav.creances", permission: "creances.view", icon: HandCoins },
    ],
  },
  {
    titleKey: "nav.sectionBoutique",
    icon: Store,
    items: [
      { href: "/stock", labelKey: "nav.stock", permission: "stock.view", icon: Package },
      { href: "/boutiques", labelKey: "nav.boutiques", permission: "boutiques.reseau", icon: Building2 },
      { href: "/depenses", labelKey: "nav.depenses", permission: "depenses.view", icon: Wallet },
      { href: "/synchronisation", labelKey: "nav.synchronisation", permission: "synchronisation.view", icon: RefreshCw },
    ],
  },
  {
    titleKey: "nav.sectionAnalyse",
    icon: LineChart,
    items: [
      { href: "/documents", labelKey: "nav.documents", permission: "documents.view", icon: FileText },
      { href: "/rapports", labelKey: "nav.rapports", permission: "rapports.view", icon: BarChart3 },
    ],
  },
];
