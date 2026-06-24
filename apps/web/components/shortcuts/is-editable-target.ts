const EDITABLE_ROLES = new Set([
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menuitem",
  "menuitemradio",
  "menuitemcheckbox",
  "spinbutton",
  "slider",
]);

// True when focus is in a field/widget that should swallow the key, including
// ARIA widgets (e.g. radix Select) that TanStack's tag-only ignoreInputs misses.
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Only modal dialogs own the keyboard; a non-modal surface (e.g. the cheatsheet) must not block.
  if (target.closest("[role='dialog'][aria-modal='true']")) return true;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const widget = target.closest<HTMLElement>("[role], [aria-autocomplete], [cmdk-root]");
  if (!widget) return false;
  if (widget.hasAttribute("cmdk-root") || widget.hasAttribute("aria-autocomplete")) return true;
  const role = widget.getAttribute("role");
  return role !== null && EDITABLE_ROLES.has(role);
}
