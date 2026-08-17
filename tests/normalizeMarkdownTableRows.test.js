const assert = require("assert").strict;
const { normalizeMarkdownTableRows, resolveGithubAssetPlaceholders } = require("../script.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("leaves non-table text unchanged", () => {
  assert.equal(normalizeMarkdownTableRows("Before\nAfter", 4), "Before\nAfter");
});

test("leaves a complete table row unchanged", () => {
  assert.equal(
    normalizeMarkdownTableRows("| A | B | C | D |", 4),
    "| A | B | C | D |"
  );
});

test("joins a multiline row for four columns", () => {
  assert.equal(
    normalizeMarkdownTableRows("| A | B\ncontinued | C | D |", 4),
    "| A | B continued | C | D |"
  );
});

test("does not count escaped pipes as separators", () => {
  assert.equal(
    normalizeMarkdownTableRows("| A \\| still A | B\ncontinued |", 2),
    "| A \\| still A | B continued |"
  );
});

test("supports a custom one-column table", () => {
  assert.equal(
    normalizeMarkdownTableRows("| A\ncontinued |", 1),
    "| A continued |"
  );
});

test("flushes an unfinished trailing row", () => {
  assert.equal(
    normalizeMarkdownTableRows("| unfinished", 4),
    "| unfinished"
  );
});

test("resolves ordered GitHub image and video attachments into table placeholders", () => {
  const input = [
    "| A | B |",
    "| --- | --- |",
    "| cek<br>📎 Upload ke GitHub: one.png | 📎 Upload ke GitHub: clip.mov |",
    "",
    "![one](https://github.com/user-attachments/assets/image-id)",
    "https://github.com/user-attachments/assets/video-id"
  ].join("\n");
  const result = resolveGithubAssetPlaceholders(input);
  assert.equal(result.resolved, 2);
  assert.equal(result.remaining, 0);
  assert.ok(result.markdown.includes("cek<br>![one](https://github.com/user-attachments/assets/image-id)"));
  assert.ok(result.markdown.includes("https://github.com/user-attachments/assets/video-id |"));
  assert.equal(result.markdown.includes("📎 Upload ke GitHub:"), false);
  assert.equal(result.markdown.split("\n").length, 4);
});

test("keeps unmatched placeholders and surplus attachments without losing data", () => {
  const missing = resolveGithubAssetPlaceholders([
    "| 📎 Upload ke GitHub: one.png | 📎 Upload ke GitHub: two.png |",
    "![one](https://github.com/user-attachments/assets/one)"
  ].join("\n"));
  assert.equal(missing.resolved, 1);
  assert.equal(missing.remaining, 1);
  assert.ok(missing.markdown.includes("📎 Upload ke GitHub: two.png"));

  const surplusUrl = "https://github.com/user-attachments/assets/extra";
  const surplus = resolveGithubAssetPlaceholders([
    "| 📎 Upload ke GitHub: one.png |",
    "![one](https://github.com/user-attachments/assets/one)",
    surplusUrl
  ].join("\n"));
  assert.equal(surplus.resolved, 1);
  assert.ok(surplus.markdown.includes(surplusUrl));
});

test("does not collect GitHub attachments already inside table rows", () => {
  const ready = "![ready](https://github.com/user-attachments/assets/ready)";
  const input = `| ${ready} | 📎 Upload ke GitHub: pending.png |`;
  const result = resolveGithubAssetPlaceholders(input);
  assert.equal(result.resolved, 0);
  assert.equal(result.remaining, 1);
  assert.equal(result.markdown, input);
});

test("normalization resolves standalone attachments before joining rows", () => {
  const input = [
    "| A | B |",
    "| --- | --- |",
    "| text | 📎 Upload ke GitHub: shot.png |",
    "![shot](https://github.com/user-attachments/assets/shot)"
  ].join("\n");
  const output = normalizeMarkdownTableRows(input, 2);
  assert.ok(output.includes("| text | ![shot](https://github.com/user-attachments/assets/shot) |"));
  assert.equal(output.split("\n").length, 3);
});

let failures = 0;

tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error.stack);
  }
});

console.log(`\n${tests.length - failures}/${tests.length} tests passed`);

if (failures > 0) {
  process.exitCode = 1;
}
