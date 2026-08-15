const assert = require("assert").strict;
const {
  createInitialState,
  addColumn,
  removeColumn,
  moveColumn,
  addRow,
  removeRow,
  moveRow,
  escapeCellText,
  parseGitHubAsset,
  serializeTable,
  countUnresolvedAssets
} = require("../builder.js");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function ids() {
  let value = 0;
  return () => `id-${++value}`;
}

test("creates three columns and two aligned rows", () => {
  const state = createInitialState(ids());
  assert.equal(state.columns.length, 3);
  assert.equal(state.rows.length, 2);
  assert.deepEqual(Object.keys(state.rows[0].cells), state.columns.map(column => column.id));
});

test("adds, moves, and removes columns while keeping cells aligned", () => {
  const makeId = ids();
  let state = createInitialState(makeId);
  state = addColumn(state, "Extra", makeId);
  const extraId = state.columns[3].id;
  assert.ok(state.rows.every(row => row.cells[extraId]));
  state = moveColumn(state, extraId, -1);
  assert.equal(state.columns[2].id, extraId);
  state = removeColumn(state, extraId);
  assert.ok(state.rows.every(row => !row.cells[extraId]));
});

test("always keeps at least one column", () => {
  let state = createInitialState(ids());
  state = removeColumn(state, state.columns[2].id);
  state = removeColumn(state, state.columns[1].id);
  const lastId = state.columns[0].id;
  assert.equal(removeColumn(state, lastId), state);
});

test("adds, moves, and removes rows", () => {
  let state = createInitialState(ids());
  state = addRow(state, ids());
  const addedId = state.rows[2].id;
  state = moveRow(state, addedId, -1);
  assert.equal(state.rows[1].id, addedId);
  state = removeRow(state, addedId);
  assert.equal(state.rows.length, 2);
});

test("escapes pipes and converts cell newlines", () => {
  assert.equal(escapeCellText(" first | value\nsecond "), "first \\| value<br>second");
});

test("parses GitHub image Markdown", () => {
  const result = parseGitHubAsset("![capture](https://github.com/user-attachments/assets/abc-123)", "image");
  assert.equal(result.ok, true);
  assert.equal(result.asset.kind, "image");
  assert.equal(result.asset.exportValue, "![capture](https://github.com/user-attachments/assets/abc-123)");
});

test("parses GitHub HTML images and bare video attachment URLs", () => {
  const image = parseGitHubAsset('<img src="https://github.com/user-attachments/assets/image-id" width="320" />');
  const video = parseGitHubAsset("https://github.com/user-attachments/assets/video-id", "video");
  assert.equal(image.ok, true);
  assert.equal(image.asset.kind, "image");
  assert.equal(video.ok, true);
  assert.equal(video.asset.kind, "video");
});

test("rejects non-GitHub attachment URLs", () => {
  const result = parseGitHubAsset("https://example.com/image.png", "image");
  assert.equal(result.ok, false);
  assert.match(result.error, /GitHub attachment/i);
});

test("serializes text and multiple ready assets in visual order", () => {
  const state = createInitialState(ids());
  const cell = state.rows[0].cells[state.columns[0].id];
  cell.text = "Before | after";
  cell.assets = [
    { sourceType: "github", exportValue: "![one](https://github.com/user-attachments/assets/one)" },
    { sourceType: "github", exportValue: "https://github.com/user-attachments/assets/two" }
  ];
  const output = serializeTable(state);
  assert.ok(output.includes("Before \\| after<br>![one](https://github.com/user-attachments/assets/one)<br>https://github.com/user-attachments/assets/two"));
  assert.equal(output.split("\n").length, 4);
});

test("counts unresolved local assets", () => {
  const state = createInitialState(ids());
  state.rows[0].cells[state.columns[0].id].assets.push({ sourceType: "local" });
  state.rows[1].cells[state.columns[1].id].assets.push({ sourceType: "local" });
  assert.equal(countUnresolvedAssets(state), 2);
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
if (failures) process.exitCode = 1;
