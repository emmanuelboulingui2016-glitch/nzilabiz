import { StoresTable } from "@/components/superadmin/stores-table";

export default async function SuperAdminBoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // Le filtre peut arriver par l'URL : la vue d'ensemble renvoie ici avec ?plan=ESSAI quand des
  // essais arrivent à échéance.
  const { plan } = await searchParams;
  return <StoresTable planInitial={plan ?? "TOUS"} />;
}
