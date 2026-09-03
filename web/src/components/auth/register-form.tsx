"use client";

// Formulaire de création de boutique. Partagé par l'inscription publique et par le lien testeur :
// une seule implémentation, donc un seul endroit où corriger un bug de saisie ou de message.
//
// Découpé en deux étapes — vous, puis votre boutique. Quatre champs d'un coup sur l'écran d'un
// téléphone donnent une page qui défile et qu'on abandonne ; deux fois deux champs se remplissent.
// La coupure n'est pas arbitraire : elle sépare la personne de son commerce, ce qui est aussi la
// façon dont un commerçant y pense.
//
// Ce que le découpage ne change pas : la requête envoyée au serveur. Un seul appel, au même
// endroit, avec le même corps qu'avant. Découper la saisie ne doit pas découper la création — une
// boutique à moitié créée serait bien pire qu'un formulaire long.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { BoutonGoogle } from "@/components/auth/bouton-google";
import { useTranslations } from "@/lib/i18n/provider";

export function RegisterForm({
  codeTest = null,
  googleActif = false,
}: {
  codeTest?: string | null;
  /** La connexion Google n'est proposée que si elle est réellement configurée côté serveur. */
  googleActif?: boolean;
}) {
  const { t } = useTranslations();
  const router = useRouter();

  const [etape, setEtape] = useState<1 | 2>(1);
  const [nom, setNom] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // La première étape se valide avant de laisser passer. Découvrir une adresse invalide après
  // avoir rempli la seconde est exactement ce qu'un découpage en étapes doit éviter.
  function passerEtape2(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nom.trim().length < 2) return setError("Indiquez votre nom.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Cette adresse e-mail n'est pas valide.");
    if (password.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.");
    setEtape(2);
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (storeName.trim().length < 2) return setError("Indiquez le nom de votre boutique.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Le code n'est jamais saisi à la main : il vient du lien reçu. L'omettre plutôt que
        // d'envoyer une chaîne vide garde la validation côté serveur simple.
        body: JSON.stringify(
          codeTest ? { nom, storeName, email, password, codeTest } : { nom, storeName, email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        // L'erreur porte presque toujours sur l'adresse ou le mot de passe, saisis à l'étape 1 :
        // on y ramène le commerçant plutôt que de lui afficher un refus sur un écran où rien
        // n'est corrigeable.
        setError(data.error ?? "Erreur lors de l'inscription");
        if (/mail|passe|adresse/i.test(String(data.error ?? ""))) setEtape(1);
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground" aria-live="polite">
          Étape {etape} sur 2
        </p>
        <h2 className="mt-1 text-xl font-extrabold">
          {etape === 1 ? "Créer votre compte" : "Votre boutique"}
        </h2>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          <span className="h-1 flex-1 rounded-full bg-primary" />
          <span className={`h-1 flex-1 rounded-full transition-colors ${etape === 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-danger/10 p-2.5 text-xs text-danger">{error}</p>}

      {etape === 1 ? (
        <form onSubmit={passerEtape2} className="animate-[slideIn_.25s_ease-out_both] space-y-3">
          <div>
            <Label htmlFor="nom">{t("auth.yourName")}</Label>
            <Input id="nom" autoComplete="name" required value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">6 caractères minimum.</p>
          </div>

          <Button type="submit" className="h-12 w-full rounded-full">
            Continuer
            <ArrowRight size={16} />
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="animate-[slideIn_.25s_ease-out_both] space-y-3">
          <div>
            <Label htmlFor="storeName">{t("auth.storeName")}</Label>
            <Input
              id="storeName"
              required
              autoFocus
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              C&apos;est le nom qui apparaîtra sur vos reçus. Vous pourrez le changer plus tard.
            </p>
          </div>

          <Button type="submit" className="h-12 w-full rounded-full" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? t("common.loading") : "Créer ma boutique"}
          </Button>

          {/* Le retour ne réinitialise rien : les valeurs vivent dans le composant, pas dans le
              formulaire affiché. Un commerçant qui revient corriger son adresse ne doit pas
              retrouver ses champs vides. */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEtape(1);
            }}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <ArrowLeft size={15} />
            Revenir à l&apos;étape précédente
          </button>

          <p className="text-center text-xs text-muted-foreground">
            En créant votre boutique, vous acceptez les{" "}
            <Link href="/conditions" className="font-semibold text-primary hover:underline">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="font-semibold text-primary hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </form>
      )}

      {/* La connexion Google ne transporte pas le code testeur : proposer ce raccourci sur le lien
          testeur ferait sortir du programme sans prévenir. Elle n'apparaît par ailleurs que si elle
          est configurée — un bouton qui renvoie une erreur vaut moins que pas de bouton.
          Réservée à la première étape : à la seconde, la boutique reste à nommer. */}
      {codeTest || !googleActif || etape === 2 ? null : (
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <BoutonGoogle libelle={t("auth.continueWithGoogle")} />
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/connexion" className="font-semibold text-primary hover:underline">
          {t("auth.loginButton")}
        </Link>
      </p>
    </>
  );
}
