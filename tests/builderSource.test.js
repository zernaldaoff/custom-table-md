const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "builder.js"), "utf8");
const normalizerHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const normalizerSource = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const builderHtml = fs.readFileSync(path.join(__dirname, "..", "builder.html"), "utf8");
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

test("wires shared history controls into the Normalizer", () => {
  assert.ok(normalizerHtml.includes('id="undoBtn"'));
  assert.ok(normalizerHtml.includes('id="redoBtn"'));
  assert.ok(normalizerHtml.indexOf('src="history.js"') < normalizerHtml.indexOf('src="script.js"'));
  assert.ok(normalizerSource.includes("createHistory("));
  assert.ok(normalizerSource.includes("getHistoryShortcut("));
});

test("wires shared history controls into the Table Builder", () => {
  assert.ok(builderHtml.includes('id="builderUndoBtn"'));
  assert.ok(builderHtml.includes('id="builderRedoBtn"'));
  assert.ok(builderHtml.indexOf('src="history.js"') < builderHtml.indexOf('src="builder.js"'));
  assert.ok(source.includes("createHistory("));
  assert.ok(source.includes("getHistoryShortcut("));
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
