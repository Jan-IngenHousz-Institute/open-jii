import { PageContainer } from "@/components/page-container";
import { OrganizationSettings } from "~/components/organization/organization-settings";

export default function OrganizationSettingsPage() {
  return (
    <PageContainer width="reading" className="space-y-6">
      <OrganizationSettings />
    </PageContainer>
  );
}
