"use client";

// Demande d'un lien de réinitialisation.
//
// Après envoi, l'écran affiche toujours la même confirmation, que l'adresse corresponde à un compte
// ou non — le serveur ne dit pas la différence, l'interface ne doit pas la laisser deviner par un
// écran différent.

import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mot-de-passe-oublie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "La demande n'a pas abouti.");
        return;
      }
      setEnvoye(data.message ?? "Si un compte existe avec cette adresse, un lien vient d'y être envoyé.");
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (envoye) {
    return (
      <div className="rounded-xl border border-border bg-success/5 p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <MailCheck size={16} className="text-success" /> Vérifiez votre boîte mail
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">{envoye}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Le lien reste valable une heure et ne fonctionne qu&apos;une fois.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}
      <div>
        <Label htmlFor="email">Adresse e-mail de votre compte</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Envoi…" : "Recevoir un lien de réinitialisation"}
      </Button>
    </form>
  );
}
