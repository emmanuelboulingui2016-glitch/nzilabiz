"use client";

// Onglet Aide : installer l'application sur un téléphone, joindre le support, et suivre ses
// demandes. Tout ce que le commerçant cherche quand quelque chose coince.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Check,
  Copy,
  LifeBuoy,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  Send,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";

type Ticket = {
  id: string;
  sujet: string;
  message: string;
  statut: "OUVERT" | "EN_COURS" | "RESOLU" | "FERME";
  reponse: string | null;
  reponduLe: string | null;
  auteurNom: string;
  creeLe: string;
};

const TON_STATUT = { OUVERT: "warning", EN_COURS: "info", RESOLU: "success", FERME: "neutral" } as const;
const LABEL_STATUT = { OUVERT: "Envoyée", EN_COURS: "En cours", RESOLU: "Résolue", FERME: "Fermée" } as const;

// Adresse d'installation choisie à la main : sert quand l'application est exposée par une autre
// voie que le réseau local (tunnel HTTPS pendant une démonstration, nom de domaine en ligne).
const CLE_URL = "nzilabiz.url-installation";
const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]", "::1"];

export function AideView({
  support,
  adresseReseau = null,
}: {
  support: {
    telephone: string | null;
    whatsapp: string | null;
    email: string | null;
    horaires: string | null;
  };
  /** Adresse de cet ordinateur sur le réseau local, détectée côté serveur. */
  adresseReseau?: string | null;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [urlApp, setUrlApp] = useState("");
  const [urlAuto, setUrlAuto] = useState("");
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    // Le QR doit contenir une adresse que le téléphone peut réellement atteindre. Si l'écran est
    // ouvert sur « localhost », cette adresse ne mène nulle part depuis un téléphone : on lui
    // substitue l'adresse réseau de l'ordinateur.
    const origine = window.location.origin;
    const local = HOTES_LOCAUX.includes(window.location.hostname);
    const auto = local && adresseReseau ? adresseReseau : origine;
    setUrlAuto(auto);
    const choisie = window.localStorage.getItem(CLE_URL);
    setUrlApp(choisie || auto);
    setSaisie(choisie || auto);
  }, [adresseReseau]);

  function enregistrerUrl() {
    const valeur = saisie.trim();
    if (!/^https?:\/\/.+/.test(valeur)) {
      toast.error("L'adresse doit commencer par http:// ou https://");
      return;
    }
    window.localStorage.setItem(CLE_URL, valeur);
    setUrlApp(valeur);
    setEdition(false);
    toast.success("Adresse du QR code mise à jour.");
  }

  function reinitialiserUrl() {
    window.localStorage.removeItem(CLE_URL);
    setUrlApp(urlAuto);
    setSaisie(urlAuto);
    setEdition(false);
  }

  async function copierUrl() {
    try {
      await navigator.clipboard.writeText(urlApp);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez l'adresse à la main.");
    }
  }

  const surLocalhost = urlApp ? HOTES_LOCAUX.some((h) => urlApp.includes(`//${h}`)) : false;

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/support");
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      // Silencieux : l'écran reste utilisable pour installer l'app ou appeler le support.
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Envoi impossible.");
        return;
      }
      toast.success("Demande envoyée — nous vous répondons ici même.");
      setSujet("");
      setMessage("");
      charger();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  const lienWhatsapp = support.whatsapp
    ? `https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`
    : null;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Smartphone size={16} /> Installer sur un téléphone
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Scannez ce code avec l&apos;appareil photo du téléphone, puis choisissez « Ajouter à
            l&apos;écran d&apos;accueil ». L&apos;application s&apos;ouvre ensuite comme une vraie appli,
            et continue de fonctionner sans réseau.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {urlApp ? <QrCode valeur={urlApp} taille={180} /> : null}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            {edition ? (
              <div className="space-y-2">
                <Label htmlFor="url-install">Adresse à mettre dans le QR code</Label>
                <Input
                  id="url-install"
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  placeholder="https://mon-adresse.exemple"
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={enregistrerUrl}>
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="outline" onClick={reinitialiserUrl}>
                    Adresse détectée
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdition(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                  {urlApp}
                </p>
                <Button size="sm" variant="ghost" onClick={copierUrl} aria-label="Copier l'adresse">
                  {copie ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEdition(true)}
                  aria-label="Modifier l'adresse"
                >
                  <Pencil size={15} />
                </Button>
              </div>
            )}

            {surLocalhost ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                Cette adresse ne fonctionne que sur cet ordinateur. Un téléphone ne peut pas
                l&apos;ouvrir : indiquez l&apos;adresse réseau de l&apos;ordinateur avec le crayon
                ci-dessus.
              </p>
            ) : null}

            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Ouvrez l&apos;appareil photo du téléphone et visez le code.</li>
              <li>Touchez la notification pour ouvrir l&apos;application.</li>
              <li>
                Dans le navigateur : menu{" "}
                <MoreVertical
                  size={14}
                  className="inline-block align-[-2px]"
                  aria-label="menu du navigateur"
                />{" "}
                → <strong>Ajouter à l&apos;écran d&apos;accueil</strong> (Android) ou{" "}
                <strong>Partager</strong> → <strong>Sur l&apos;écran d&apos;accueil</strong>{" "}
                (iPhone).
              </li>
              <li>Connectez-vous une fois : l&apos;application reste ouverte ensuite.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Tant que l&apos;application n&apos;est pas mise en ligne, le téléphone doit être sur le
              même réseau que cet ordinateur. L&apos;ajout à l&apos;écran d&apos;accueil et le
              fonctionnement hors connexion demandent une adresse sécurisée (https).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <LifeBuoy size={16} /> Nous joindre
          </CardTitle>
          {support.horaires ? <p className="text-xs text-muted-foreground">{support.horaires}</p> : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {lienWhatsapp ? (
            <a href={lienWhatsapp} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <MessageCircle size={15} /> WhatsApp
              </Button>
            </a>
          ) : null}
          {support.telephone ? (
            <a href={`tel:${support.telephone.replace(/\s/g, "")}`}>
              <Button variant="outline" size="sm">
                <Phone size={15} /> {support.telephone}
              </Button>
            </a>
          ) : null}
          {support.email ? (
            <a href={`mailto:${support.email}`}>
              <Button variant="outline" size="sm">
                <Mail size={15} /> {support.email}
              </Button>
            </a>
          ) : null}
          {!lienWhatsapp && !support.telephone && !support.email ? (
            <p className="text-sm text-muted-foreground">
              Aucun contact direct n&apos;est encore renseigné — utilisez le formulaire ci-dessous.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-foreground">Envoyer une demande</CardTitle>
          <p className="text-xs text-muted-foreground">
            Décrivez le problème : nous répondons directement dans cet écran.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={envoyer} className="space-y-3">
            <div>
              <Label htmlFor="sup-sujet">Sujet</Label>
              <Input
                id="sup-sujet"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Ex. : une vente n'apparaît pas dans les rapports"
                required
                minLength={3}
              />
            </div>
            <div>
              <Label htmlFor="sup-message">Votre message</Label>
              <Textarea
                id="sup-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ce que vous avez fait, ce que vous attendiez, ce qui s'est passé."
                required
                minLength={10}
                className="min-h-28"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={envoi}>
                <Send size={15} /> {envoi ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {tickets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Vos demandes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t.sujet}</p>
                  <Badge tone={TON_STATUT[t.statut]}>{LABEL_STATUT[t.statut]}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.auteurNom} · {format(parseISO(t.creeLe), "d MMM yyyy, HH:mm", { locale: fr })}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.message}</p>
                {t.reponse ? (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                    <p className="text-xs font-bold text-primary">
                      Réponse du support
                      {t.reponduLe ? ` · ${format(parseISO(t.reponduLe), "d MMM yyyy", { locale: fr })}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{t.reponse}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
