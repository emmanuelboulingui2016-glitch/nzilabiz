import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/platform-settings";
import { urlReseauLocal } from "@/lib/reseau/adresse-locale";
import { AideView } from "@/components/parametres/aide/aide-view";

// Onglet Aide & support — ouvert à tous les rôles : un vendeur bloqué en caisse doit pouvoir
// demander de l'aide sans passer par son patron.
export default async function AidePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const [reglages, entetes] = await Promise.all([getPlatformSettings(), headers()]);

  // Adresse réseau de cet ordinateur : c'est elle qu'il faut mettre dans le QR code quand
  // l'application est consultée depuis « localhost », qui ne veut rien dire pour un téléphone.
  const adresseReseau = urlReseauLocal(entetes.get("host"));

  return (
    <AideView
      support={{
        telephone: reglages.supportTelephone,
        whatsapp: reglages.supportWhatsapp,
        email: reglages.supportEmail,
        horaires: reglages.supportHoraires,
      }}
      adresseReseau={adresseReseau}
    />
  );
}
