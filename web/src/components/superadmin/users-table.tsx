"use client";

// Annuaire transverse des utilisateurs — lecture seule, pour diagnostiquer : qui s'est connecté,
// quel rôle, dans quelle boutique, quel compte est désactivé.

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Ligne = {
  id: string;
  nom: string;
  email: string;
  role: string;
  superAdmin: boolean;
  connexionGoogle: boolean;
  desactive: boolean;
  creeLe: string;
  derniereConnexion: string | null;
  boutique: { id: string; nom: string; plan: string };
};

export function UsersTable() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/superadmin/utilisateurs?${params.toString()}`);
      if (!res.ok) throw new Error("chargement");
      const data = await res.json();
      setLignes(data.utilisateurs ?? []);
    } catch {
      setErreur("Impossible de charger les utilisateurs.");
    } finally {
      setChargement(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(charger, 250);
    return () => clearTimeout(timer);
  }, [charger]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          {lignes.length} compte{lignes.length > 1 ? "s" : ""}, toutes boutiques confondues. Les rôles se
          gèrent depuis la boutique concernée.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, e-mail, boutique)"
          className="pl-9"
        />
      </div>

      {chargement ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : erreur ? (
        <p className="text-sm text-danger">{erreur}</p>
      ) : lignes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun utilisateur ne correspond à cette recherche.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Utilisateur</th>
                  <th className="px-4 py-2.5 font-bold">Boutique</th>
                  <th className="px-4 py-2.5 font-bold">Rôle</th>
                  <th className="px-4 py-2.5 font-bold">Connexion</th>
                  <th className="px-4 py-2.5 font-bold">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-bold">
                        {u.nom}
                        {u.superAdmin ? (
                          <span title="Superadmin de la plateforme">
                            <ShieldCheck size={14} className="text-primary" />
                          </span>
                        ) : null}
                        {u.desactive ? <Badge tone="neutral">désactivé</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{u.boutique.nom}</p>
                      <p className="text-xs text-muted-foreground">{u.boutique.plan}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "PATRON" ? "info" : "neutral"}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.connexionGoogle ? "Google" : "Mot de passe"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.derniereConnexion
                        ? format(parseISO(u.derniereConnexion), "d MMM yyyy, HH:mm", { locale: fr })
                        : "Jamais connecté"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
