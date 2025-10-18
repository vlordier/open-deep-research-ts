const HTML_DETECTION_REGEX = /<(p|div|span|section|article|html|body|table|ul|ol|li|h[1-6])[\s>]/i;

export function looksLikeHtml(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith("<")) return false;
  return HTML_DETECTION_REGEX.test(trimmed);
}

export function detectInputFormat(input: string): "html" | "text" {
  return looksLikeHtml(input) ? "html" : "text";
}

