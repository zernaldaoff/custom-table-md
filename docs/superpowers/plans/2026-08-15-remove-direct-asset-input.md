# Remove Direct Asset Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cell-level GitHub URL/Markdown add form while preserving local asset drop/paste previews and per-asset GitHub resolution.

**Architecture:** Add a static source regression check that distinguishes the removed direct-add UI from the retained resolve UI. Delete only the direct-add markup, event branch, and unused styles; keep the parser and asset resolution helpers unchanged.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js 12 `assert`/source checks.

---

### Task 1: Remove the direct-add form safely

**Files:**
- Create: `tests/builderSource.test.js`
- Modify: `builder.js`
- Modify: `builder.css`

- [ ] **Step 1: Write the failing source regression test**

Create a Node script that reads `builder.js` and asserts:

```js
assert.ok(!source.includes('data-role="github-input"'));
assert.ok(!source.includes('data-action="add-github-asset"'));
assert.ok(!source.includes('data-role="asset-kind"'));
assert.ok(source.includes('data-role="resolve-input"'));
assert.ok(source.includes('data-action="resolve-asset"'));
```

Use the same small named-test runner style as the other Node 12 test files.

- [ ] **Step 2: Run the source test and verify RED**

Run `node tests/builderSource.test.js`. Expect three failures for `github-input`, `add-github-asset`, and `asset-kind`, proving the unwanted form still exists.

- [ ] **Step 3: Remove the direct-add markup and event branch**

Delete the `.github-input-row` block from `renderCell`. Delete the `if (action === "add-github-asset")` branch from the delegated click handler. Retain `resolve-asset`, `parseGitHubAsset`, cell error rendering, local file handling, and copy gating.

- [ ] **Step 4: Remove only unused direct-add CSS**

Delete `.github-input-row`, `.github-input`, and `.asset-kind` rules and their mobile override. Keep `.resolve-input`, `.resolve-row`, `.mini-button`, and `.cell-error` because asset resolution still uses them.

- [ ] **Step 5: Verify GREEN and all regressions**

Run:

```bash
node tests/builderSource.test.js
node tests/liveTableBuilder.test.js
node tests/normalizeMarkdownTableRows.test.js
node --check builder.js
node --check script.js
git diff --check
```

Expect all commands to exit 0, with the resolve-input assertions and all 18 existing behavior tests passing.

- [ ] **Step 6: Commit the removal**

```bash
git add builder.js builder.css tests/builderSource.test.js
git commit -m "refactor: remove direct GitHub asset input"
```
