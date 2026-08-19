import { RegisterForm } from "@/components/auth/register-form";
import { TitreInscription } from "@/components/auth/titre-inscription";
import { googleConfigure } from "@/lib/auth/google";

// Inscription publique : essai standard. Le parcours testeur passe par /testeur/[code], qui
// réutilise le même formulaire avec le code du programme.
export default function InscriptionPage() {
  return (
    <div>
      <TitreInscription />
      <RegisterForm googleActif={googleConfigure()} />
    </div>
  );
}
