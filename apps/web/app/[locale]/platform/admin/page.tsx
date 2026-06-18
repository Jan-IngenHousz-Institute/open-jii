import { PageContainer } from "@/components/page-container";
import { PlatformAdminConsole } from "~/components/admin/platform-admin-console";

export default function PlatformAdminPage() {
  return (
    <PageContainer width="reading" className="space-y-6">
      <PlatformAdminConsole />
    </PageContainer>
  );
}
