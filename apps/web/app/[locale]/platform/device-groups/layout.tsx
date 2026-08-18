import { PageContainer } from "@/components/page-container";

/**
 * Every route here is a group detail; the group list lives on the devices page.
 * Same container as the devices section, so both details align.
 */
export default function DeviceGroupsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer width="fluid" className="space-y-6">
      {children}
    </PageContainer>
  );
}
