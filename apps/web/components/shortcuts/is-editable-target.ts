// Roles where letters/arrows mean type-ahead or option navigation, so a
// global single-key shortcut must not also fire.
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

// Whether keyboard focus sits in a field/widget that should swallow the key.
// Generalises the old INPUT/TEXTAREA/SELECT/contentEditable check with the
// ARIA widgets (radix Select = button[role=combobox] + [role=listbox], cmdk,
// comboboxes) that TanStack's tag-only `ignoreInputs` does not catch.
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // A modal owns the keyboard — don't let page shortcuts act behind it.
  if (target.closest("[role='dialog']")) return true;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const widget = target.closest<HTMLElement>("[role], [aria-autocomplete], [cmdk-root]");
  if (!widget) return false;
  if (widget.hasAttribute("cmdk-root") || widget.hasAttribute("aria-autocomplete")) return true;
  const role = widget.getAttribute("role");
  return role !== null && EDITABLE_ROLES.has(role);
}
