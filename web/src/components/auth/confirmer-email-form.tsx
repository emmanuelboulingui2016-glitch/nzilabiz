"use client";

// Bouton de confirmation d'adresse e-mail.
//
// Un clic explicite, pas un simple chargement de page : voir le commentaire dans
// /api/auth/verifier-email sur les scanners de sécurité qui visitent automatiquement les liens
// reçus par e-mail. Sans ce bouton, l'ouverture même du message dans certaines messageries
// consommerait le jeton avant que son destinataire n'ait rien décidé.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmerEmailForm({ jeton, changement }: { jeton: string; changement: boolean }) {
  const [etat, setEtat] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const confirmer = async () => {
    setEtat("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/verifier-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "La confirmation n'a pas abouti.");
        setEtat("idle");
        return;
      }
      setEtat("done");
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
      setEtat("idle");
    }
  };

  if (etat === "done") {
    return (
      <div className="rounded-xl border border-border bg-success/5 p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CheckCircle2 size={16} className="text-success" /> Adresse confirmée
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {changement
            ? "Votre nouvelle adresse est désormais celle de votre compte. Utilisez-la la prochaine fois pour vous connecter."
            : "Merci, votre adresse est maintenant vérifiée."}
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Aller au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}
      <Button onClick={confirmer} className="w-full" disabled={etat === "loading"}>
        {etat === "loading" ? "Confirmation…" : "Confirmer cette adresse"}
      </Button>
    </div>
  );
}
