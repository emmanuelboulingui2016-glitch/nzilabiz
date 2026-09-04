"use client";

// Écran Clients — la liste de la clientèle avec son segment de fidélité, la recherche, les
// filtres et l'export. Pensé pour répondre à une question concrète du commerçant : « qui sont
// mes bons clients, et lesquels ne sont pas revenus depuis longtemps ? »

import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { Plus, Search, Sheet, MessageCircle, Users, Star, Repeat, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Input, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { neutraliserLigne } from "@/components/export-security";
import { SEGMENT_LABELS, SEGMENT_DESCRIPTIONS, type ClientSegment } from "@/lib/clients/loyalty";
import { toWhatsAppPhone } from "@/components/creances/types";
import { SEGMENT_TONES, type ClientFiche } from "./types";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientDetailDialog } from "./client-detail-dialog";

type Filtre = "TOUS" | ClientSegment;
type Tri = "ca" | "achats" | "recent" | "nom";

const FILTRES: { value: Filtre; label: string }[] = [
  { value: "TOUS", label: "Tous" },
  { value: "FIDELE", label: SEGMENT_LABELS.FIDELE },
  { value: "RECURRENT", label: SEGMENT_LABELS.RECURRENT },
  { value: "NOUVEAU", label: SEGMENT_LABELS.NOUVEAU },
  { value: "OCCASIONNEL", label: SEGMENT_LABELS.OCCASIONNEL },
  { value: "INACTIF", label: SEGMENT_LABELS.INACTIF },
  { value: "SANS_ACHAT", label: SEGMENT_LABELS.SANS_ACHAT },
];

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ClientsView({ initial, canEdit }: { initial: ClientFiche[]; canEdit: boolean }) {
  // Liste rendue par le serveur avec la page : rien à recharger à l'affichage.
  const [clients, setClients] = useState<ClientFiche[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("TOUS");
  const [tri, setTri] = useState<Tri>("ca");
  const [showArchives, setShowArchives] = useState(false);

  const [formTarget, setFormTarget] = useState<ClientFiche | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Impossible de charger la liste des clients");
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pas de chargement au montage : les fiches sont déjà là. `load()` reste appelé après chaque
  // création, modification ou archivage pour rafraîchir la liste.
  useEffect(() => {
    setClients(initial);
  }, [initial]);

  const actifs = useMemo(() => clients.filter((c) => !c.archive), [clients]);

  const stats = useMemo(
    () => ({
      total: actifs.length,
      fideles: actifs.filter((c) => c.segment === "FIDELE").length,
      recurrents: actifs.filter((c) => c.segment === "RECURRENT").length,
      inactifs: actifs.filter((c) => c.segment === "INACTIF").length,
      ca: actifs.reduce((sum, c) => sum + c.totalAchats, 0),
    }),
    [actifs]
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (showArchives ? clients : actifs)
      .filter((c) => (filtre === "TOUS" ? true : c.segment === filtre))
      .filter((c) =>
        q === ""
          ? true
          : c.nom.toLowerCase().includes(q) ||
            (c.telephone ?? "").toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q) ||
            (c.adresse ?? "").toLowerCase().includes(q)
      );

    const sorted = [...base];
    sorted.sort((a, b) => {
      if (tri === "nom") return a.nom.localeCompare(b.nom, "fr");
      if (tri === "achats") return b.nbAchats - a.nbAchats || b.totalAchats - a.totalAchats;
      if (tri === "recent") {
        const da = a.dernierAchat ? new Date(a.dernierAchat).getTime() : 0;
        const db = b.dernierAchat ? new Date(b.dernierAchat).getTime() : 0;
        return db - da;
      }
      return b.totalAchats - a.totalAchats;
    });
    return sorted;
  }, [clients, actifs, showArchives, filtre, query, tri]);

  function handleExport() {
    const rows = [
      ["Nom", "Téléphone", "E-mail", "Adresse", "Segment", "Achats", "Chiffre d'affaires", "Panier moyen", "Dernier achat", "Solde créance"],
      ...visibles.map((c) => [
        c.nom,
        c.telephone ?? "",
        c.email ?? "",
        c.adresse ?? "",
        SEGMENT_LABELS[c.segment],
        c.nbAchats,
        c.totalAchats,
        c.panierMoyen,
        c.dernierAchat ? format(new Date(c.dernierAchat), "yyyy-MM-dd") : "",
        c.soldeCreance,
      ]),
    ];
    // Neutralisation anti-formule (CWE-1236) avant Papa.unparse : le nom, le téléphone, l'e-mail
    // et l'adresse viennent tous de saisie libre côté client — voir export-security.ts pour le
    // détail et le traitement des colonnes de montants (achats, panier moyen, solde de créance).
    downloadBlob(
      `﻿${Papa.unparse(rows.map(neutraliserLigne))}`,
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8;"
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Clients" value={stats.total} icon={<Users size={18} />} />
        <StatCard
          label="Fidèles"
          value={stats.fideles}
          icon={<Star size={18} />}
          helpText={SEGMENT_DESCRIPTIONS.FIDELE}
          delta={stats.total > 0 ? `${Math.round((stats.fideles / stats.total) * 100)} % de la clientèle` : undefined}
          deltaTone="positive"
        />
        <StatCard
          label="Récurrents"
          value={stats.recurrents}
          icon={<Repeat size={18} />}
          helpText={SEGMENT_DESCRIPTIONS.RECURRENT}
        />
        <StatCard
          label="À relancer"
          value={stats.inactifs}
          icon={<UserX size={18} />}
          helpText={SEGMENT_DESCRIPTIONS.INACTIF}
          delta={stats.inactifs > 0 ? "Sans achat récent" : undefined}
          deltaTone={stats.inactifs > 0 ? "negative" : "neutral"}
        />
        <StatCard label="CA clientèle" value={formatFcfa(stats.ca)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client (nom, téléphone, quartier)"
            className="pl-9"
          />
        </div>
        <Select value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)} className="w-auto" aria-label="Segment">
          {FILTRES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select value={tri} onChange={(e) => setTri(e.target.value as Tri)} className="w-auto" aria-label="Trier par">
          <option value="ca">Trier : chiffre d&apos;affaires</option>
          <option value="achats">Trier : nombre d&apos;achats</option>
          <option value="recent">Trier : achat le plus récent</option>
          <option value="nom">Trier : nom</option>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={visibles.length === 0}>
          <Sheet size={16} /> CSV
        </Button>
        {canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setFormTarget(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Nouveau client
          </Button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={showArchives}
          onChange={(e) => setShowArchives(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Afficher aussi les clients archivés
      </label>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="text-sm font-semibold">Aucun client à afficher</p>
            <p className="text-sm text-muted-foreground">
              {clients.length === 0
                ? "Créez une fiche client, puis associez-la à vos ventes en caisse : le suivi de fidélité se remplit tout seul."
                : "Aucun client ne correspond à cette recherche ou à ce filtre."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibles.map((client) => {
            const whatsapp = toWhatsAppPhone(client.telephone);
            return (
              <Card key={client.id} className={client.archive ? "opacity-60" : undefined}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setDetailId(client.id)}
                        className="truncate text-left font-bold hover:underline"
                      >
                        {client.nom}
                      </button>
                      <Badge tone={SEGMENT_TONES[client.segment]} title={SEGMENT_DESCRIPTIONS[client.segment]}>
                        {SEGMENT_LABELS[client.segment]}
                      </Badge>
                      {client.soldeCreance > 0 ? (
                        <Badge tone="danger">Doit {formatFcfa(client.soldeCreance)}</Badge>
                      ) : null}
                      {client.archive ? <Badge tone="neutral">Archivé</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {client.telephone ?? "Sans téléphone"}
                      {client.adresse ? ` · ${client.adresse}` : ""}
                      {client.dernierAchat
                        ? ` · Dernier achat il y a ${client.joursDepuisDernierAchat} j`
                        : " · Aucun achat"}
                      {client.frequenceJours !== null ? ` · Revient tous les ${client.frequenceJours} j` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-bold tracking-tight">{formatFcfa(client.totalAchats)}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.nbAchats} achat{client.nbAchats > 1 ? "s" : ""} · panier{" "}
                        {formatFcfa(client.panierMoyen)}
                      </p>
                    </div>
                    {whatsapp ? (
                      <a
                        href={`https://wa.me/${whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Écrire à ${client.nom} sur WhatsApp`}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                      >
                        <MessageCircle size={18} />
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientFormDialog
        open={showForm}
        client={formTarget}
        onClose={() => setShowForm(false)}
        onSaved={load}
      />
      <ClientDetailDialog
        clientId={detailId}
        canEdit={canEdit}
        onClose={() => setDetailId(null)}
        onEdit={(client) => {
          setDetailId(null);
          setFormTarget(client);
          setShowForm(true);
        }}
        onChanged={load}
      />
    </div>
  );
}
