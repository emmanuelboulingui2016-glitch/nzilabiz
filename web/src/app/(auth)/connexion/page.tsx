import { LoginForm } from "@/components/auth/login-form";
import { googleConfigure } from "@/lib/auth/google";

// La disponibilité de la connexion Google se décide au serveur : les identifiants OAuth ne doivent
// jamais atteindre le navigateur, et un bouton qui renvoie une erreur vaut moins que pas de bouton.
//
// Le motif d'un échec Google est lu ici, dans l'adresse, et non par `useSearchParams()` côté
// navigateur. Ce détail décide de tout le reste : ce crochet force son sous-arbre à n'exister
// qu'après l'arrivée du JavaScript, et la page de connexion — le premier écran que voit un
// commerçant — ne contenait donc aucun champ tant que le script n'était pas chargé. Sur une
// connexion lente, cela fait un écran vide pendant plusieurs secondes. Lu au serveur, le
// formulaire complet part avec la page.
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const erreur = Array.isArray(params.error) ? params.error[0] : params.error;

  return <LoginForm googleActif={googleConfigure()} erreur={erreur ?? null} />;
}
