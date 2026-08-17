"use client";

// Sélecteur de client de la caisse.
//
// Remplace le menu déroulant d'origine, qui listait tous les clients sans recherche : au-delà
// d'une cinquantaine de fiches il devenait inutilisable, et il n'offrait aucun moyen d'enregistrer
// un nouveau client sans quitter la vente en cours.
//
// La recherche filtre la liste déjà chargée avec le catalogue — aucun aller-retour réseau, donc
// utilisable hors connexion. Seule la création d'un nouveau client exige d'être en ligne.

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/utils";
import type { VendreClient } from "./types";

const MAX_RESULTATS = 8;

export function ClientPicker({
  clients,
  clientId,
  onClientChange,
  onClientCreated,
  requis,
}: {
  clients: VendreClient[];
  clientId: string | null;
  onClientChange: (id: string | null) => void;
  onClientCreated: (client: VendreClient) => void;
  requis: boolean;
}) {
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauTelephone, setNouveauTelephone] = useState("");
  const [creating, setCreating] = useState(false);
  const nomRef = useRef<HTMLInputElement>(null);

  const selection = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId]);

  const resultats = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? clients.filter(
          (c) => c.nom.toLowerCase().includes(q) || (c.telephone ?? "").toLowerCase().includes(q)
        )
      : clients;
    return base.slice(0, MAX_RESULTATS);
  }, [clients, query]);

  const ouvrirCreation = () => {
    setNouveauNom(query.trim());
    setNouveauTelephone("");
    setCreationOuverte(true);
    setTimeout(() => nomRef.current?.focus(), 0);
  };

  const creerClient = async () => {
    const nom = nouveauNom.trim();
    if (!nom) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vendre/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, telephone: nouveauTelephone.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de créer le client.");
        return;
      }
      onClientCreated(data.client);
      onClientChange(data.client.id);
      toast.success(data.existant ? `${data.client.nom} existait déjà — client sélectionné.` : `${data.client.nom} ajouté.`);
      setCreationOuverte(false);
      setQuery("");
      setNouveauNom("");
      setNouveauTelephone("");
    } catch {
      toast.error("Erreur réseau — le client n'a pas été créé.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Label htmlFor="vendre-client" className="text-xs">
        Client {requis ? <span className="text-danger">(obligatoire pour le crédit)</span> : "(optionnel)"}
      </Label>

      {selection ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{selection.nom}</p>
            {selection.telephone ? (
              <p className="truncate text-xs text-muted-foreground">{selection.telephone}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onClientChange(null);
              setQuery("");
            }}
            aria-label="Retirer le client"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="vendre-client"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client (nom ou téléphone)"
              className="h-10 pl-9"
              autoComplete="off"
            />
          </div>

          {clients.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun client enregistré pour l&apos;instant.
            </p>
          ) : resultats.length > 0 ? (
            <ul className="max-h-44 overflow-y-auto rounded-lg border border-border">
              {resultats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClientChange(c.id);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      "border-b border-border last:border-b-0"
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold">{c.nom}</span>
                    {c.telephone ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{c.telephone}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucun client ne correspond à « {query.trim()} ».
            </p>
          )}

          {creationOuverte ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="nouveau-client-nom" className="text-xs">
                  Nom du client
                </Label>
                <Input
                  id="nouveau-client-nom"
                  ref={nomRef}
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="nouveau-client-tel" className="text-xs">
                  Téléphone (optionnel)
                </Label>
                <Input
                  id="nouveau-client-tel"
                  value={nouveauTelephone}
                  onChange={(e) => setNouveauTelephone(e.target.value)}
                  placeholder="077123456"
                  className="h-9"
                  inputMode="tel"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreationOuverte(false)}
                  disabled={creating}
                >
                  Annuler
                </Button>
                <Button type="button" size="sm" onClick={creerClient} disabled={creating || !nouveauNom.trim()}>
                  <Check size={14} />
                  {creating ? "Création..." : "Ajouter"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={ouvrirCreation}
              disabled={!online}
              title={online ? undefined : "Création indisponible hors connexion"}
              className="w-full"
            >
              {query.trim() ? <UserPlus size={16} /> : <Plus size={16} />}
              {query.trim() ? `Créer « ${query.trim()} »` : "Nouveau client"}
            </Button>
          )}

          {!online && !creationOuverte ? (
            <p className="text-xs text-muted-foreground">
              Hors connexion : vous pouvez sélectionner un client existant, mais pas en créer un nouveau.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
