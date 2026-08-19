import { PlatformSettingsForm } from "@/components/superadmin/platform-settings-form";
import { TestProgrammePanel } from "@/components/superadmin/test-programme-panel";

export default function SuperAdminReglagesPage() {
  return (
    <div className="space-y-4">
      {/* Le programme de test passe avant les mentions légales : c'est le réglage qu'on vient
          modifier en cours de période, pas celui qu'on renseigne une fois pour toutes. */}
      <TestProgrammePanel />
      <PlatformSettingsForm />
    </div>
  );
}
