const assert = require("assert").strict;
const { normalizeMarkdownTableRows } = require("../script.js");

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
