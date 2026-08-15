function normalizeMarkdownTableRows(markdown, columns = 4) {
  const lines = markdown.split(/\r\n|\n|\r/);
  const result = [];
  let buffer = [];

  function countPipes(text) {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "|" && text[i - 1] !== "\\") count++;
    }
    return count;
  }

  function isTableLine(line) {
    return line.trimStart().startsWith("|");
  }

  function isCompleteTableRow(text) {
    return countPipes(text) >= columns + 1 && text.trimEnd().endsWith("|");
  }

  function cleanRow(text) {
    return text
      .replace(/\s+/g, " ")
      .replace(/(<img\b[^>]*\/>)\s*(?=<img\b)/g, "$1 ")
      .trim();
  }

  function flushBuffer() {
    if (!buffer.length) return;
    result.push(cleanRow(buffer.join(" ")));
    buffer = [];
  }

  for (const line of lines) {
    if (buffer.length) {
      buffer.push(line);
      if (isCompleteTableRow(buffer.join(" "))) flushBuffer();
      continue;
    }

    if (isTableLine(line) && !isCompleteTableRow(line)) {
      buffer.push(line);
      continue;
    }

    result.push(line);
  }

  flushBuffer();
  return result.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeMarkdownTableRows };
}
