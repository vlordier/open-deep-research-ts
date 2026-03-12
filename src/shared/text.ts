export function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
