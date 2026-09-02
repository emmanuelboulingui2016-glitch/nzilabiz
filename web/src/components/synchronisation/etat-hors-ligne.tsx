"use client";

/**
 * « Cette boutique peut-elle travailler sans réseau ? » — la réponse, en clair.
 *
 * Le mode hors connexion est le principal argument de cette application, et c'était jusqu'ici la
 * chose la plus difficile à vérifier : il fallait fermer l'application, couper les données, la
 * rouvrir, et constater. Trois corrections successives ont été validées de cette façon, à
 * l'aveugle, en demandant au commerçant d'être le testeur.
 *
 * Ce panneau interroge directement le cache du service worker et dit ce qu'il contient. Il sert
 * autant au commerçant — qui saura, avant de partir en tournée, si son téléphone est prêt — qu'à
 * celui qui devra diagnostiquer la prochaine anomalie.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Tenus en accord avec `public/sw.js`. */
const PREFIXE_PAGES = "nzilabiz-pages-";
const PREFIXE_COQUILLE = "nzilabiz-shell-";

/** Écrans que le préchargement va chercher, dans le même ordre que `AppShell`. */
const ECRANS = [
  { chemin: "/vendre", libelle: "Caisse" },
  { chemin: "/dashboard", libelle: "Tableau de bord" },
  { chemin: "/stock", libelle: "Stock" },
  { chemin: "/clients", libelle: "Clients" },
  { chemin: "/ventes", libelle: "Ventes" },
];

type Etat = {
  serviceWorker: boolean;
  pages: string[];
  fichiers: number;
};

export function EtatHorsLigne() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [relance, setRelance] = useState(false);

  const lire = useCallback(async () => {
    if (typeof caches === "undefined" || typeof navigator === "undefined") {
      setEtat({ serviceWorker: false, pages: [], fichiers: 0 });
      return;
    }
    try {
      const actif = Boolean(navigator.serviceWorker?.controller);
      const noms = await caches.keys();

      const pages: string[] = [];
      for (const nom of noms.filter((n) => n.startsWith(PREFIXE_PAGES))) {
        const cache = await caches.open(nom);
        for (const requete of await cache.keys()) pages.push(new URL(requete.url).pathname);
      }

      let fichiers = 0;
      for (const nom of noms.filter((n) => n.startsWith(PREFIXE_COQUILLE))) {
        const cache = await caches.open(nom);
        fichiers += (await cache.keys()).length;
      }

      setEtat({ serviceWorker: actif, pages, fichiers });
    } catch {
      setEtat({ serviceWorker: false, pages: [], fichiers: 0 });
    }
  }, []);

  useEffect(() => {
    void lire();
  }, [lire]);

  /** Redemande le préchargement, puis relit — le temps que le service worker fasse son travail. */
  async function preparer() {
    setRelance(true);
    try {
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({
        type: "PRECHARGER",
        urls: ECRANS.map((e) => e.chemin),
      });
      // Le préchargement va chercher cinq pages et leurs fichiers : on lui laisse le temps avant
      // de relire, plutôt que d'afficher un résultat encore vide qui ferait croire à un échec.
      await new Promise((r) => setTimeout(r, 6000));
      await lire();
    } finally {
      setRelance(false);
    }
  }

  if (!etat) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Lecture du cache…</CardContent>
      </Card>
    );
  }

  const caissePrete = etat.pages.includes("/vendre");
  const pret = etat.serviceWorker && caissePrete && etat.fichiers > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {pret ? (
            <CheckCircle2 size={17} className="text-success" />
          ) : (
            <CloudOff size={17} className="text-warning" />
          )}
          Travail sans réseau
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {pret
            ? "Cet appareil peut encaisser sans connexion. Les ventes remonteront au retour du réseau."
            : "Cet appareil n'est pas encore prêt à travailler sans connexion."}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Ligne ok={etat.serviceWorker} libelle="Mode hors connexion installé" />
          <Ligne ok={etat.fichiers > 0} libelle={`${etat.fichiers} fichier(s) de l'application gardés`} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Écrans disponibles sans réseau
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ECRANS.map((e) => {
              const dispo = etat.pages.includes(e.chemin);
              return (
                <span
                  key={e.chemin}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    dispo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  )}
                >
                  {e.libelle}
                </span>
              );
            })}
          </div>
        </div>

        {!caissePrete ? (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            La caisse n&apos;est pas encore en cache : c&apos;est l&apos;écran le plus important, celui qui
            fait rentrer l&apos;argent. Lancez la préparation ci-dessous pendant que vous avez du réseau.
          </p>
        ) : null}

        <Button size="sm" variant="outline" onClick={preparer} disabled={relance}>
          {relance ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {relance ? "Préparation en cours…" : "Préparer cet appareil"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Ligne({ ok, libelle }: { ok: boolean; libelle: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md",
          ok ? "bg-success" : "bg-muted"
        )}
      >
        {ok ? <CheckCircle2 size={12} className="text-white" /> : <CloudOff size={11} className="opacity-60" />}
      </span>
      {libelle}
    </p>
  );
}
