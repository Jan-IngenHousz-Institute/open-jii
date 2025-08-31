import { DropdownOption } from "~/components/Dropdown";
import { protocolsDefinitions } from "~/protocols/definitions";

export function getProtocolsDropdownOptions() {
  return Object.entries(protocolsDefinitions).map(([name, definition]) => ({
    value: name,
    label: definition.label,
  })) satisfies DropdownOption[];
}
