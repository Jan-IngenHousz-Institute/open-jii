import { PageContainer } from "@/components/page-container";

/**
 * The container every organizations route shares. The section heading is
 * deliberately not here: the routes nested under an organization id have their own
 * heading — the organization itself — and repeating "Organizations" with a Create
 * button above it would offer an unrelated action on every management screen.
 */
export default function OrganizationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer width="fluid" className="flex flex-1 flex-col gap-6">
      {children}
    </PageContainer>
  );
}
