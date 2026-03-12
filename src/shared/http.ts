export function extractContentType(headers: unknown): string {
  if (!headers) return "";
  if (headers instanceof Headers) {
    return headers.get("content-type") ?? "";
  }
  if (Array.isArray(headers)) {
    return String(headers.find((entry) => entry?.[0]?.toLowerCase?.() === "content-type")?.[1] ?? "");
  }
  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    return String(record["content-type"] ?? record["Content-Type"] ?? "");
  }
  return "";
}
