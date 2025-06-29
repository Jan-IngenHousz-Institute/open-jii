import { DropdownOption } from "~/components/Dropdown";
import { ProtocolName, protocolsDefinitions } from "~/protocols/definitions";

export function getProtocolsDropdownOptions() {
  return Object.entries(protocolsDefinitions).map(([name, definition]) => ({
    value: name,
    label: definition.label,
  })) satisfies DropdownOption[];
}
