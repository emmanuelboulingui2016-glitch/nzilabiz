"use client";

// Choix du nouveau mot de passe, à l'arrivée du lien reçu par e-mail.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm({ jeton }: { jeton: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Vérifié ici avant tout appel : le jeton ne fonctionne qu'une fois, il ne doit pas être
    // consommé par une simple faute de frappe dans la confirmation.
    if (password !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "La réinitialisation n'a pas abouti.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}
      <div>
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">6 caractères minimum.</p>
      </div>
      <div>
        <Label htmlFor="confirmation">Confirmez le mot de passe</Label>
        <Input
          id="confirmation"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer et me connecter"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Vos autres appareils déjà connectés seront déconnectés.
      </p>
    </form>
  );
}
