import { InvitationForm } from "@/components/auth/invitation-form";

// Page ouverte par l'employé qui scanne le QR code de son patron. Volontairement dans le groupe
// (auth) : elle est publique, et le visiteur n'a pas encore de compte.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationForm token={token} />;
}
