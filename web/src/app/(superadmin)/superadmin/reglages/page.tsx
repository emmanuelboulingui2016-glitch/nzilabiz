import { PlatformSettingsForm } from "@/components/superadmin/platform-settings-form";
import { TestProgrammePanel } from "@/components/superadmin/test-programme-panel";
import { TarifsForm } from "@/components/superadmin/tarifs-form";

export default function SuperAdminReglagesPage() {
  return (
    <div className="space-y-4">
      {/* Le programme de test passe avant les mentions légales : c'est le réglage qu'on vient
          modifier en cours de période, pas celui qu'on renseigne une fois pour toutes. */}
      <TestProgrammePanel />
      {/* Les tarifs passent avant les mentions légales pour la même raison que le programme de
          test : c'est un réglage qu'on vient modifier, pas qu'on remplit une fois pour toutes. */}
      <TarifsForm />
      <PlatformSettingsForm />
    </div>
  );
}
