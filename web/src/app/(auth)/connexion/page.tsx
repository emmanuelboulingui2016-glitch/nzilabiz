import { LoginForm } from "@/components/auth/login-form";
import { googleConfigure } from "@/lib/auth/google";

// La disponibilité de la connexion Google se décide au serveur : les identifiants OAuth ne doivent
// jamais atteindre le navigateur, et un bouton qui renvoie une erreur vaut moins que pas de bouton.
export default function ConnexionPage() {
  return <LoginForm googleActif={googleConfigure()} />;
}
