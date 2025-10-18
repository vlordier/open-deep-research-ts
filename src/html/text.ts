interface InnerTextResult {
  text: string;
  map: Uint32Array;
}

function innerTextWithMap(html: string): InnerTextResult {
  const len = html.length;
  const map = new Uint32Array(len + 1);

  let inTag = false;
  const out: string[] = [];
  let textLen = 0;
  let lastWasSpace = false;
  let lastWasNewline = false;

  const emitChar = (ch: string) => {
    if (ch === "\n") {
      if (!lastWasNewline) {
        out.push("\n");
        textLen += 1;
        lastWasNewline = true;
        lastWasSpace = false;
      }
      return;
    }
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\f") {
      if (!lastWasSpace && !lastWasNewline) {
        out.push(" ");
        textLen += 1;
        lastWasSpace = true;
        lastWasNewline = false;
      }
      return;
    }
    out.push(ch);
    textLen += 1;
    lastWasSpace = false;
    lastWasNewline = false;
  };

  const maybeEmitBreakForTagAt = (i: number) => {
    const slice = html.slice(i, Math.min(len, i + 20)).toLowerCase();
    if (/^<\/(p|li|div|blockquote|h[1-6])\b/.test(slice) || /^<br\b/.test(slice)) {
      emitChar("\n");
    }
  };

  for (let i = 0; i < len; i++) {
    map[i] = textLen;
    const ch = html[i]!;
    if (ch === "<") {
      maybeEmitBreakForTagAt(i);
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (inTag) {
      continue;
    }
    if (ch === "&") {
      const rest = html.slice(i).toLowerCase();
      if (rest.startsWith("&lt;")) {
        emitChar("<");
        i += 3;
        continue;
      }
      if (rest.startsWith("&gt;")) {
        emitChar(">");
        i += 3;
        continue;
      }
      if (rest.startsWith("&amp;")) {
        emitChar("&");
        i += 4;
        continue;
      }
      if (rest.startsWith("&quot;")) {
        emitChar('"');
        i += 5;
        continue;
      }
      if (rest.startsWith("&#39;")) {
        emitChar("'");
        i += 4;
        continue;
      }
    }
    emitChar(ch);
  }
  map[len] = textLen;

  let text = out.join("");
  text = text.replace(/\n+/g, "\n");
  text = text.trim();

  return { text, map };
}

export function htmlInnerText(html: string): string {
  return innerTextWithMap(html).text;
}

export function htmlInnerTextWithMap(html: string): InnerTextResult {
  return innerTextWithMap(html);
}

