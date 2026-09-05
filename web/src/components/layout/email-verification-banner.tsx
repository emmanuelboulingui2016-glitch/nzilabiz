"use client";

// Bandeau discret signalant une adresse e-mail non confirmée. Jamais bloquant : voir le
// commentaire sur `users.emailVerifieLe` dans le schéma — la vérification ne conditionne ni la
// connexion ni l'inscription, c'est un état affiché, pas un verrou.
//
// Masqué pour la session de navigation en cours quand le commerçant le ferme (sessionStorage, pas
// localStorage comme AnnouncementBanner) : il reste discret sans disparaître définitivement — une
// adresse non confirmée reste une chose à corriger, contrairement à une annonce déjà lue.
//
// La lecture de sessionStorage passe par `useSyncExternalStore`, pas par un `useEffect` qui
// appellerait `setState` : cette dernière façon de faire déclenche un rendu en cascade juste après
// le premier, rien que pour appliquer une valeur déjà connue au montage
// (react-hooks/set-state-in-effect, à raison). `useSyncExternalStore` sait rendre une valeur
// différente côté serveur (`getServerSnapshot`, ici toujours « visible » puisque le serveur n'a
// pas de sessionStorage) et bascule sur la vraie valeur du navigateur sans provoquer l'écart
// d'hydratation qu'une lecture directe de `window` au rendu aurait produit.

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Mail, X } from "lucide-react";

const STORAGE_KEY = "nzilabiz.verif-email.masquee";

function estMasqueParLeStockage(): boolean {
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
}

// Rien à écouter en continu : la seule façon de masquer ce bandeau est le clic sur la croix
// ci-dessous, traité par un état local (`masqueManuellement`) plutôt que par un aller-retour au
// stockage externe. `subscribe` ne sert donc qu'à satisfaire la signature du hook.
function subscribe() {
  return () => {};
}

export function EmailVerificationBanner({ envoiDisponible }: { envoiDisponible: boolean }) {
  const masqueAuMontage = useSyncExternalStore(subscribe, estMasqueParLeStockage, () => false);
  const [masqueManuellement, setMasqueManuellement] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  if (masqueAuMontage || masqueManuellement) return null;

  const renvoyer = async () => {
    setEnvoi(true);
    try {
      const res = await fetch("/api/auth/verifier-email/renvoyer", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "L'envoi a échoué.");
        return;
      }
      toast.success(
        data.dejaVerifiee
          ? "Votre adresse est déjà vérifiée."
          : "E-mail de confirmation renvoyé — pensez à vérifier vos indésirables."
      );
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm">
      <Mail size={16} className="mt-0.5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1">
        Votre adresse e-mail n&apos;est pas encore confirmée.{" "}
        {envoiDisponible ? (
          <button
            onClick={renvoyer}
            disabled={envoi}
            className="font-semibold underline underline-offset-2 disabled:opacity-60"
          >
            {envoi ? "Envoi…" : "Renvoyer le lien de confirmation"}
          </button>
        ) : (
          "L'envoi automatique n'est pas encore disponible."
        )}
      </p>
      <button
        onClick={() => {
          window.sessionStorage.setItem(STORAGE_KEY, "1");
          setMasqueManuellement(true);
        }}
        aria-label="Masquer ce message"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-warning/10"
      >
        <X size={15} />
      </button>
    </div>
  );
}
