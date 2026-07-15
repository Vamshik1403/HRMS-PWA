/** Standard delete confirmation used across HRMS list pages. */
export function confirmDelete(
  message = "Are you sure you want to delete this record?",
): boolean {
  return window.confirm(message);
}
