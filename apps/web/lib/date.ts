export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// Converts an ISO datetime string (as returned by the API) to the yyyy-MM-dd
// format a <input type="date"> expects.
export function dateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}
