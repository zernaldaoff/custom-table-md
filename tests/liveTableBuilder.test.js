const assert = require("assert").strict;
const { createHistory } = require("../history.js");
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
  extractGitHubAssets,
  serializeTable,
  countUnresolvedAssets,
  addAssetsToCell,
  addGithubAssetsToCell,
  removeAssetFromCell,
  resolveLocalAsset
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

test("extracts pasted GitHub assets in order and preserves other text", () => {
  const html = '<img width="433" height="577" alt="Image" src="https://github.com/user-attachments/assets/html-id" />';
  const markdown = "![capture](https://github.com/user-attachments/assets/markdown-id)";
  const video = "https://github.com/user-attachments/assets/video-id";
  const result = extractGitHubAssets(`Before\n${html}\n${markdown}\n${video}\nAfter`);
  assert.equal(result.assets.length, 3);
  assert.deepEqual(result.assets.map(asset => asset.kind), ["image", "image", "video"]);
  assert.deepEqual(result.assets.map(asset => asset.previewUrl), [
    "https://github.com/user-attachments/assets/html-id",
    "https://github.com/user-attachments/assets/markdown-id",
    "https://github.com/user-attachments/assets/video-id"
  ]);
  assert.equal(result.remainingText, "Before\nAfter");
  assert.equal(result.assets[0].exportValue, html);
  assert.equal(result.assets[1].exportValue, markdown);
  assert.equal(result.assets[2].exportValue, video);
});

test("leaves ordinary pasted text untouched", () => {
  assert.deepEqual(extractGitHubAssets("ordinary text"), {
    assets: [],
    remainingText: "ordinary text"
  });
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

test("serializes unresolved local assets as safe upload placeholders", () => {
  const state = createInitialState(ids());
  const cell = state.rows[0].cells[state.columns[0].id];
  cell.assets.push({
    sourceType: "local",
    name: "before | after.png",
    previewUrl: "blob:private-preview"
  });
  const output = serializeTable(state);
  assert.ok(output.includes("📎 Upload ke GitHub: before \\| after.png"));
  assert.ok(!output.includes("blob:private-preview"));
});

test("adds multiple assets to one cell and preserves their order", () => {
  const state = createInitialState(ids());
  const rowId = state.rows[0].id;
  const columnId = state.columns[0].id;
  const next = addAssetsToCell(state, rowId, columnId, [
    { id: "asset-1", sourceType: "github", exportValue: "![one](https://github.com/user-attachments/assets/one)" },
    { id: "asset-2", sourceType: "local", previewUrl: "blob:two" },
    { id: "asset-3", sourceType: "github", exportValue: "https://github.com/user-attachments/assets/three" }
  ]);
  assert.deepEqual(next.rows[0].cells[columnId].assets.map(asset => asset.id), ["asset-1", "asset-2", "asset-3"]);
  assert.equal(countUnresolvedAssets(next), 1);
  const output = serializeTable(next);
  assert.ok(output.includes("![one](https://github.com/user-attachments/assets/one)<br>📎 Upload ke GitHub: aset lokal<br>https://github.com/user-attachments/assets/three"));
  assert.ok(!output.includes("blob:two"));
});

test("pairs pasted GitHub assets with local files while preserving previews", () => {
  let state = createInitialState(ids());
  const rowId = state.rows[0].id;
  const columnId = state.columns[0].id;
  state = addAssetsToCell(state, rowId, columnId, [
    { id: "local-1", kind: "image", sourceType: "local", name: "one.png", previewUrl: "blob:one" },
    { id: "local-2", kind: "video", sourceType: "local", name: "two.mov", previewUrl: "blob:two" }
  ]);
  state = addGithubAssetsToCell(state, rowId, columnId, [
    { id: "remote-1", kind: "image", sourceType: "github", previewUrl: "https://github.com/user-attachments/assets/one", exportValue: "![one](https://github.com/user-attachments/assets/one)" },
    { id: "remote-2", kind: "video", sourceType: "github", previewUrl: "https://github.com/user-attachments/assets/two", exportValue: "https://github.com/user-attachments/assets/two" },
    { id: "remote-3", kind: "image", sourceType: "github", previewUrl: "https://github.com/user-attachments/assets/three", exportValue: "![three](https://github.com/user-attachments/assets/three)" }
  ]);
  const assets = state.rows[0].cells[columnId].assets;
  assert.equal(countUnresolvedAssets(state), 0);
  assert.deepEqual(assets.map(asset => asset.id), ["local-1", "local-2", "remote-3"]);
  assert.deepEqual(assets.map(asset => asset.previewUrl), ["blob:one", "blob:two", "https://github.com/user-attachments/assets/three"]);
  assert.deepEqual(assets.map(asset => asset.name), ["one.png", "two.mov", undefined]);
  assert.ok(serializeTable(state).includes("![one](https://github.com/user-attachments/assets/one)<br>https://github.com/user-attachments/assets/two<br>![three](https://github.com/user-attachments/assets/three)"));
});

test("resolves a local asset and removes an asset without changing siblings", () => {
  let state = createInitialState(ids());
  const rowId = state.rows[0].id;
  const columnId = state.columns[0].id;
  state = addAssetsToCell(state, rowId, columnId, [
    { id: "local-1", kind: "image", sourceType: "local", name: "shot.png", previewUrl: "blob:shot" },
    { id: "ready-1", kind: "image", sourceType: "github", exportValue: "![ready](https://github.com/user-attachments/assets/ready)" }
  ]);
  state = resolveLocalAsset(state, rowId, columnId, "local-1", "![shot](https://github.com/user-attachments/assets/shot)");
  assert.equal(countUnresolvedAssets(state), 0);
  assert.equal(state.rows[0].cells[columnId].assets[0].sourceType, "github");
  assert.equal(state.rows[0].cells[columnId].assets[0].previewUrl, "blob:shot");
  state = removeAssetFromCell(state, rowId, columnId, "local-1");
  assert.deepEqual(state.rows[0].cells[columnId].assets.map(asset => asset.id), ["ready-1"]);
});

test("round-trips table structure, text, and assets through history", () => {
  const makeId = ids();
  const initial = createInitialState(makeId);
  const history = createHistory(initial);
  const withColumn = addColumn(initial, "Evidence", makeId);
  history.commit(withColumn);
  const rowId = withColumn.rows[0].id;
  const columnId = withColumn.columns[0].id;
  const edited = addAssetsToCell(withColumn, rowId, columnId, [
    { id: "asset-history", sourceType: "local", kind: "image", previewUrl: "blob:history" }
  ]);
  edited.rows[0].cells[columnId].text = "Changed";
  history.commit(edited);
  assert.equal(history.undo().columns.length, 4);
  assert.equal(history.undo().columns.length, 3);
  const redoneColumn = history.redo();
  assert.equal(redoneColumn.columns[3].label, "Evidence");
  const redoneEdit = history.redo();
  assert.equal(redoneEdit.rows[0].cells[columnId].text, "Changed");
  assert.equal(redoneEdit.rows[0].cells[columnId].assets[0].id, "asset-history");
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
