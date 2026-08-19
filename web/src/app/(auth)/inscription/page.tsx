import { RegisterForm } from "@/components/auth/register-form";
import { TitreInscription } from "@/components/auth/titre-inscription";

// Inscription publique : essai standard. Le parcours testeur passe par /testeur/[code], qui
// réutilise le même formulaire avec le code du programme.
export default function InscriptionPage() {
  return (
    <div>
      <TitreInscription />
      <RegisterForm />
    </div>
  );
}
