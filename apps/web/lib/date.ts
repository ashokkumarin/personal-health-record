export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}
