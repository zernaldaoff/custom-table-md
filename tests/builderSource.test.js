const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "builder.js"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("removes the direct GitHub input", () => {
  assert.ok(!source.includes('data-role="github-input"'));
});

test("removes the direct GitHub add action", () => {
  assert.ok(!source.includes('data-action="add-github-asset"'));
});

test("removes the direct asset kind selector", () => {
  assert.ok(!source.includes('data-role="asset-kind"'));
});

test("keeps per-asset GitHub resolution", () => {
  assert.ok(source.includes('data-role="resolve-input"'));
  assert.ok(source.includes('data-action="resolve-asset"'));
});

test("keeps the removed file picker and drop control absent", () => {
  const renderCellSource = source.slice(
    source.indexOf("function renderCell"),
    source.indexOf("function renderBuilder")
  );
  assert.ok(!renderCellSource.includes('data-role="drop-zone"'));
  assert.ok(!renderCellSource.includes('data-role="file-input"'));
  assert.ok(!renderCellSource.includes("atau pilih beberapa file"));
});

let failures = 0;
tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
  }
});
console.log(`\n${tests.length - failures}/${tests.length} tests passed`);
if (failures) process.exitCode = 1;
