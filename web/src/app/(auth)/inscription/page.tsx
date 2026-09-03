import { RegisterForm } from "@/components/auth/register-form";
import { googleConfigure } from "@/lib/auth/google";

// Inscription publique : essai standard. Le parcours testeur passe par /testeur/[code], qui
// réutilise le même formulaire avec le code du programme.
//
// Le titre est porté par le formulaire lui-même : il change d'une étape à l'autre, et le sortir
// d'ici évitait un composant client de plus rien que pour une traduction.
export default function InscriptionPage() {
  return <RegisterForm googleActif={googleConfigure()} />;
}
