# Live Table Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second page where users can compose arbitrary Markdown tables, place text and multiple GitHub image/video attachments in cells, preview local assets, and copy validated GitHub-ready output.

**Architecture:** Keep a plain JavaScript state model independent from the rendered table. Export pure model, parser, validation, and serialization functions from `builder.js` for Node 12-compatible tests; guard browser initialization so the same file drives the DOM without affecting tests.

**Tech Stack:** Semantic HTML5, CSS Grid/Flexbox, vanilla JavaScript, Node.js 12 `assert` test script.

---

## File Map

- `builder.html`: Second-page structure, editor mount point, guidance, status, and result panel.
- `builder.css`: Builder-specific toolbar, table editor, cell, asset card, output, and responsive styles.
- `builder.js`: State helpers, GitHub asset parser, Markdown serializer, object URL lifecycle, rendering, and events.
- `tests/liveTableBuilder.test.js`: Pure behavior tests using a small `assert.strict` runner.
- `index.html`: Adds navigation between Normalizer and Table Builder.
- `styles.css`: Adds shared navigation styles used by the existing page.

### Task 1: Define the state and Markdown contract with tests

**Files:**
- Create: `tests/liveTableBuilder.test.js`
- Create: `builder.js`

- [ ] **Step 1: Write failing tests for the public API**

Require these exports from `builder.js`:

```js
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
```

Assert that initial state has three columns and two rows; mutations return coherent state; at least one column remains; pipe/newline text becomes `\|` and `<br>`; multiple assets serialize after text; local assets are counted unresolved; GitHub image Markdown, HTML image markup, and bare attachment URLs parse successfully; non-GitHub URLs return an error result.

- [ ] **Step 2: Run the test and verify RED**

Run `node tests/liveTableBuilder.test.js` and expect failure with `Cannot find module '../builder.js'`.

- [ ] **Step 3: Implement the pure state helpers**

Use immutable-enough clone-and-update helpers with stable IDs from an injected/default ID generator. `addColumn`, `removeColumn`, `moveColumn`, `addRow`, `removeRow`, and `moveRow` must keep each row's `cells[columnId]` aligned with current columns. `removeColumn` returns the unchanged state if only one column remains.

- [ ] **Step 4: Implement parsing, validation, and serialization**

Implement:

```js
function escapeCellText(value) {
  return value.trim().replace(/\|/g, "\\|").replace(/\r\n|\n|\r/g, "<br>");
}

function countUnresolvedAssets(state) {
  return state.rows.reduce((total, row) => total +
    Object.values(row.cells).reduce((cellTotal, cell) =>
      cellTotal + cell.assets.filter(asset => asset.sourceType === "local").length, 0), 0);
}
```

`parseGitHubAsset(input, hint)` must trim input, require `https://github.com/user-attachments/assets/`, detect image/video from Markdown, HTML, extension, or hint, and return `{ ok, asset }` or `{ ok: false, error }`. `serializeTable(state)` must emit header, separator, and body rows with all items joined using `<br>`.

- [ ] **Step 5: Run GREEN verification**

Run `node tests/liveTableBuilder.test.js` and expect all tests to pass, then run `node --check builder.js`.

- [ ] **Step 6: Commit the tested core**

```bash
git add builder.js tests/liveTableBuilder.test.js
git commit -m "feat: add tested live table model"
```

### Task 2: Build the second-page shell and navigation

**Files:**
- Create: `builder.html`
- Create: `builder.css`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Add shared navigation to the normalizer**

Insert a `.page-nav` in the existing header with links to `index.html` and `builder.html`, mark Normalizer with `aria-current="page"`, and add compact active/hover/focus styles to `styles.css`.

- [ ] **Step 2: Create semantic builder markup**

Include these required IDs:

```html
<button id="addColumnBtn" type="button">Add column</button>
<button id="addRowBtn" type="button">Add row</button>
<div id="tableEditor"></div>
<p id="validationSummary" role="status" aria-live="polite"></p>
<textarea id="builderOutput" readonly></textarea>
<button id="copyBuilderBtn" type="button">Copy Result</button>
<p id="builderStatus" role="status" aria-live="polite"></p>
<p id="builderError" role="alert" hidden></p>
```

Link `styles.css`, then `builder.css`, and load `builder.js` at the end of the body. The page header navigation marks Table Builder as current and the instruction panel explains the GitHub draft upload step.

- [ ] **Step 3: Style the editor page**

Use the existing variables and visual language. Add a sticky builder toolbar, horizontally scrollable `.table-stage`, minimum 260px column widths, editable header cards, body cell cards, dashed drop zones, image/video previews, unresolved badges, icon actions, output panel, and mobile adjustments. Reuse visible focus and reduced-motion behavior.

- [ ] **Step 4: Verify static structure**

Run:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('builder.html','utf8');for(const id of ['addColumnBtn','addRowBtn','tableEditor','validationSummary','builderOutput','copyBuilderBtn','builderStatus','builderError'])if(!h.includes('id=\"'+id+'\"'))throw Error(id+' missing')"
```

Expect exit code 0, then run `git diff --check`.

- [ ] **Step 5: Commit the page shell**

```bash
git add builder.html builder.css index.html styles.css
git commit -m "feat: add live table builder page"
```

### Task 3: Render and edit rows, columns, and cell text

**Files:**
- Modify: `builder.js`

- [ ] **Step 1: Add guarded browser initialization and renderer**

Inside `if (typeof document !== "undefined")`, initialize state, resolve required elements, and render a CSS grid with header controls and body cell editors. Each text area uses `data-row-id` and `data-column-id`; each row/column action carries its target ID and has an explicit `aria-label`.

- [ ] **Step 2: Wire table mutations**

Use event delegation for add, rename, move left/right/up/down, and remove actions. Before deleting non-empty rows/columns, call `window.confirm`; skip confirmation for empty content. Re-render after structural mutations while keeping text edits incremental.

- [ ] **Step 3: Keep Markdown output live**

On text input or state mutation, assign `serializeTable(state)` to `builderOutput`, update the unresolved count, and disable `copyBuilderBtn` only when unresolved assets exist or there are no columns.

- [ ] **Step 4: Run regression checks**

Run `node tests/liveTableBuilder.test.js`, `node tests/normalizeMarkdownTableRows.test.js`, and `node --check builder.js`; expect zero failures/errors.

- [ ] **Step 5: Commit table editing**

```bash
git add builder.js
git commit -m "feat: add live table editing interactions"
```

### Task 4: Add multi-asset drop, paste, resolution, and copy

**Files:**
- Modify: `builder.js`
- Modify: `tests/liveTableBuilder.test.js`

- [ ] **Step 1: Add a failing regression test for mixed cell content**

Create a cell containing text, two GitHub assets, and one local asset. Assert serialization includes the two GitHub assets in order, excludes the `blob:` local preview, and `countUnresolvedAssets` returns `1`. Run the test and verify it fails before implementing the missing asset mutation helper.

- [ ] **Step 2: Add pure asset mutation helpers**

Export and test `addAssetsToCell`, `removeAssetFromCell`, and `resolveLocalAsset`. They must preserve asset order, update only the targeted cell, and replace the local asset's source/export fields after successful GitHub parsing.

- [ ] **Step 3: Implement file selection, drop, and paste**

For each cell, accept multiple files from its hidden file input, `drop`, or clipboard `paste`. Allow `image/png`, `image/gif`, `image/jpeg`, `image/svg+xml`, `video/mp4`, `video/quicktime`, and `video/webm`. Create local object URLs, preview cards, and **Needs GitHub URL** status. Reject all other types with a cell-specific message.

- [ ] **Step 4: Implement GitHub attachment resolution**

Each local card has a URL/Markdown input and resolve button. Also provide a cell-level GitHub attachment input for direct ready assets. Parse with `parseGitHubAsset`; render errors next to the relevant input and only mutate state on success.

- [ ] **Step 5: Implement lifecycle and copy behavior**

Revoke object URLs on asset/row/column removal and `beforeunload`. Copy with `navigator.clipboard.writeText` in secure contexts and a textarea selection plus `document.execCommand("copy")` fallback. Show copied/error states and keep copy disabled while unresolved assets remain.

- [ ] **Step 6: Run complete verification**

Run both test scripts, both JavaScript syntax checks, the static builder structure check, and `git diff --check`. Expect all checks to exit 0.

- [ ] **Step 7: Commit asset workflow**

```bash
git add builder.js tests/liveTableBuilder.test.js
git commit -m "feat: add GitHub asset workflow to table builder"
```

### Task 5: Serve and verify the complete flow

**Files:**
- Modify only if defects are found: `builder.html`, `builder.css`, `builder.js`, `index.html`, `styles.css`, tests.

- [ ] **Step 1: Serve the worktree**

Run `python3 -m http.server 4173`, or reuse the existing server, and verify `builder.html` returns HTTP 200.

- [ ] **Step 2: Verify primary interactions in a browser when available**

Add, rename, reorder, and delete rows/columns; type text containing pipes/newlines; add multiple GitHub attachment URLs; confirm live Markdown is escaped and ordered correctly.

- [ ] **Step 3: Verify local asset gating in a browser when available**

Drop/paste multiple supported image/video files into one cell, confirm previews and unresolved count, resolve them using GitHub attachment URLs, remove one, and confirm copy becomes enabled only when all remaining assets are resolved.

- [ ] **Step 4: Verify responsive and keyboard behavior when available**

Check horizontal table scrolling on mobile, visible focus, keyboard actions, accessible labels, and navigation between both pages.

- [ ] **Step 5: Run final automated evidence**

Run `node tests/liveTableBuilder.test.js`, `node tests/normalizeMarkdownTableRows.test.js`, both `node --check` commands, the static builder structure check, `git diff --check`, and `git status --short`. Report any unavailable browser verification explicitly.
