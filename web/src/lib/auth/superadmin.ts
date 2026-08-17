// Accès superadmin — l'administration de la plateforme, transverse à toutes les boutiques.
//
// Volontairement PAS un champ en base : la liste des superadmins vit dans la variable
// d'environnement `SUPERADMIN_EMAILS` (adresses séparées par des virgules). Conséquence directe :
// aucune faille applicative — injection, élévation de privilège via une route mal protégée, compte
// compromis — ne peut promouvoir quelqu'un superadmin. Il faut un accès au serveur et un
// redémarrage, ce qui est exactement le niveau de protection que mérite ce rôle.
//
// Exemple de configuration dans .env :
//   SUPERADMIN_EMAILS="emmanuelboulingui2016@gmail.com,associe@nzilabiz.com"

import { getSession, type SessionPayload } from "@/lib/auth/session";

export function superAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const liste = superAdminEmails();
  if (liste.length === 0) return false;
  return liste.includes(email.trim().toLowerCase());
}

/** Session du superadmin connecté, ou null. À appeler au début de chaque page/route /superadmin. */
export async function getSuperAdminSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !isSuperAdminEmail(session.email)) return null;
  return session;
}
