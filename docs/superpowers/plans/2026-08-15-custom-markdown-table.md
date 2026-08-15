# Custom Markdown Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive one-page browser utility that loads or accepts Markdown, asks for a custom column count in a modal, normalizes table rows, and copies the result.

**Architecture:** Keep the site dependency-free in the existing HTML, CSS, and JavaScript files. Keep `normalizeMarkdownTableRows(markdown, columns)` pure and CommonJS-exportable for Node tests, while DOM initialization is guarded so the same script runs safely in both browser and test environments.

**Tech Stack:** Semantic HTML5, CSS Grid/Flexbox, vanilla JavaScript, Node.js built-in test runner.

---

## File Map

- `index.html`: Semantic one-page workspace, upload control, editor panels, messages, and accessible modal.
- `styles.css`: Visual system, desktop/mobile layout, modal, controls, focus and status states.
- `script.js`: Pure Markdown normalizer plus browser-only file, modal, normalization, and clipboard behavior.
- `tests/normalizeMarkdownTableRows.test.js`: Unit tests for all specified normalization behavior.

### Task 1: Specify the normalizer with failing tests

**Files:**
- Create: `tests/normalizeMarkdownTableRows.test.js`
- Modify: `script.js`

- [ ] **Step 1: Replace the placeholder browser behavior with the user-supplied pure function and a temporary CommonJS export**

Add `normalizeMarkdownTableRows(markdown, columns = 4)` using the supplied pipe counting, buffering, row completion, whitespace cleanup, and newline joining behavior. End with:

```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeMarkdownTableRows };
}
```

- [ ] **Step 2: Write focused tests for the required behavior**

Use `node:test` and `node:assert/strict` to assert:

```js
assert.equal(normalizeMarkdownTableRows("Before\nAfter", 4), "Before\nAfter");
assert.equal(normalizeMarkdownTableRows("| A | B | C | D |", 4), "| A | B | C | D |");
assert.equal(
  normalizeMarkdownTableRows("| A | B\ncontinued | C | D |", 4),
  "| A | B continued | C | D |"
);
assert.equal(
  normalizeMarkdownTableRows("| A \\| still A | B\ncontinued |", 2),
  "| A \\| still A | B continued |"
);
assert.equal(normalizeMarkdownTableRows("| A |\nB |", 1), "| A | B |");
assert.equal(normalizeMarkdownTableRows("| unfinished", 4), "| unfinished");
```

- [ ] **Step 3: Prove the tests detect missing behavior**

Temporarily change the function body to `return markdown;`, run `node --test tests/normalizeMarkdownTableRows.test.js`, and expect failures for multiline rows. Restore the implementation afterward.

- [ ] **Step 4: Run the normalizer suite**

Run `node --test tests/normalizeMarkdownTableRows.test.js` and expect all tests to pass with zero failures.

- [ ] **Step 5: Commit the tested normalizer**

```bash
git add script.js tests/normalizeMarkdownTableRows.test.js
git commit -m "feat: add tested markdown table normalizer"
```

### Task 2: Build the semantic one-page interface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Replace the landing page markup**

Create a compact header and `main` workspace containing:

```html
<input id="fileInput" type="file" accept=".md,text/markdown,text/plain">
<textarea id="input" aria-label="Markdown input"></textarea>
<button id="normalizeBtn" type="button">Normalize Table</button>
<textarea id="output" aria-label="Normalized Markdown output" readonly></textarea>
<button id="copyBtn" type="button" disabled>Copy Result</button>
<p id="statusBox" role="status" aria-live="polite"></p>
<p id="errorBox" role="alert" hidden></p>
```

Add a hidden dialog-style modal with `role="dialog"`, `aria-modal="true"`, a labelled numeric `#columnCount` (`min="1"`, `step="1"`, `value="4"`), cancel button, and submit button inside `#columnForm`.

- [ ] **Step 2: Replace the landing-page CSS with the workspace visual system**

Define color variables, readable typography, a centered max-width shell, card panels, a two-column editor grid, large monospace textareas, clear button/focus/disabled states, status/error colors, and a fixed modal backdrop. Under `760px`, use one editor column and full-width primary controls. Respect `prefers-reduced-motion`.

- [ ] **Step 3: Check static structure**

Run `node -e "const fs=require('node:fs');const h=fs.readFileSync('index.html','utf8');for(const id of ['fileInput','input','output','normalizeBtn','copyBtn','columnModal','columnForm','columnCount','statusBox','errorBox'])if(!h.includes('id=\"'+id+'\"'))throw Error(id+' missing')"` and expect exit code 0.

- [ ] **Step 4: Commit the interface**

```bash
git add index.html styles.css
git commit -m "feat: build markdown normalizer interface"
```

### Task 3: Wire file input, modal, normalization, and copying

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add guarded DOM initialization**

Wrap browser setup in `if (typeof document !== "undefined") { ... }`. Resolve all required elements once, and add `showError`, `showStatus`, `openModal`, and `closeModal` helpers.

- [ ] **Step 2: Implement `.md` file loading**

On `fileInput.change`, reject filenames that do not match `/\.md$/i`; otherwise call `await file.text()`, replace the input textarea, clear stale output, disable copy, and announce the loaded filename. Catch read failures in `errorBox`.

- [ ] **Step 3: Implement modal behavior and validation**

Open the modal from `normalizeBtn`, focus/select `columnCount`, close from the cancel button, backdrop, or Escape, and restore focus. On `columnForm.submit`, require `Number.isInteger(columns) && columns > 0`; keep the modal open and report an inline modal error when invalid.

- [ ] **Step 4: Run normalization from the modal**

For a valid count, disable process controls, show the loader, call `normalizeMarkdownTableRows(inputEl.value, columns)` after the existing short delay, populate output, enable copy only for non-empty output, close the modal, announce success, and restore control states in `finally`.

- [ ] **Step 5: Implement robust copy behavior**

Prefer `navigator.clipboard.writeText(outputEl.value)`. If unavailable, focus/select the output and call `document.execCommand("copy")`. Show “Copied!” temporarily and report a helpful manual-copy message on failure.

- [ ] **Step 6: Run regression tests**

Run `node --test tests/normalizeMarkdownTableRows.test.js` and expect all tests to pass with zero failures.

- [ ] **Step 7: Commit the interactions**

```bash
git add script.js
git commit -m "feat: wire markdown file workflow"
```

### Task 4: Browser and final verification

**Files:**
- Modify only if verification reveals a defect: `index.html`, `styles.css`, `script.js`, `tests/normalizeMarkdownTableRows.test.js`

- [ ] **Step 1: Start a local static server**

Run `python3 -m http.server 4173` and open `http://127.0.0.1:4173`.

- [ ] **Step 2: Verify the primary workflow**

Paste a four-column row split across lines, click Normalize, enter `4`, submit, and confirm one normalized output row. Copy it and confirm the visible success state.

- [ ] **Step 3: Verify file and error workflows**

Upload a `.md` file and confirm editable replacement text; attempt a non-`.md` file and confirm an error; submit `0`, a decimal, and an empty column count and confirm the modal remains open with validation feedback.

- [ ] **Step 4: Verify accessibility and responsive behavior**

Confirm Escape and backdrop close the modal, focus returns to Normalize, keyboard focus is visible, and the workspace stacks without horizontal overflow at a mobile viewport.

- [ ] **Step 5: Run final automated verification**

Run `node --test tests/normalizeMarkdownTableRows.test.js` and the static structure check from Task 2. Both commands must exit 0.

- [ ] **Step 6: Review the final diff and commit verification fixes if any**

Run `git diff --check` and `git status --short`. If fixes were required, stage only the relevant files and commit them with `git commit -m "fix: polish markdown normalizer workflow"`.
