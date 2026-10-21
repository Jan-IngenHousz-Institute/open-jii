export function demoLandingOrganization(
  organizations: readonly { id: string; name: string; type: string | null }[],
) {
  return organizations
    .filter((organization) => organization.type === "demo")
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .at(0);
}
