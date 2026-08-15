# Custom Markdown Table — Design

## Goal

Build a single-page, browser-only utility that accepts Markdown from an uploaded `.md` file or an editable text area, then normalizes multiline table rows using a user-selected column count.

## Scope

- Use the existing `index.html`, `styles.css`, and `script.js` files without adding a framework or build step.
- Preserve the normalization behavior supplied by the user, except that the column count is provided dynamically.
- Keep all file processing local in the browser.
- Do not add a backend, persistence, Markdown preview, or download feature.

## Interface

The page contains a compact header and a two-panel workspace:

- The input panel provides a `.md` file picker and an editable Markdown textarea.
- The output panel provides a read-only result textarea and a copy button.
- The primary **Normalize Table** button opens a modal.
- The modal requests a positive whole-number column count, defaults to `4`, and offers cancel and process actions.
- Status and error messages are visible and accessible without using browser alerts.

On narrow screens, the two panels stack vertically. Keyboard users can operate the file picker, buttons, modal, and textareas. Opening the modal focuses its numeric input; closing it restores focus to the normalize button.

## Behavior and Data Flow

1. Selecting a valid `.md` file reads its text and places it in the input textarea. Existing text is replaced.
2. The user may paste or edit Markdown directly in the input textarea at any time.
3. Clicking **Normalize Table** opens the column-count modal.
4. Submitting a positive whole number calls `normalizeMarkdownTableRows(markdown, columns)`.
5. The normalized Markdown is placed in the output textarea.
6. **Copy Result** writes the output through the Clipboard API, with a selection-based fallback where needed.

The normalizer keeps the supplied algorithm:

- Split text across all common newline formats.
- Treat lines whose trimmed start begins with `|` as table-row starts.
- Count unescaped pipe characters.
- Buffer incomplete rows until they have at least `columns + 1` pipes and end with `|`.
- Collapse whitespace when cleaning buffered rows and retain a space between adjacent image tags.
- Leave already-complete rows and non-table lines unchanged.

## Validation and Errors

- Reject files whose names do not end in `.md` (case-insensitive).
- Reject missing, non-integer, zero, or negative column counts.
- Report file-reading, normalization, and copy failures in the page.
- Disable copying when there is no output.
- Escape closes the modal; clicking the backdrop closes it; submitting runs normalization.

## Code Boundaries

- `normalizeMarkdownTableRows` contains no DOM operations and returns a string.
- Small UI functions manage modal state, status messages, file loading, normalization, and copying.
- HTML owns semantic structure; CSS owns layout, responsive behavior, and visual states; JavaScript owns behavior only.

## Verification

Automated tests cover normalization of multiline rows, complete rows, non-table text, escaped pipes, custom column counts, and trailing buffered content. Browser verification covers file upload, editable input, modal validation, normalization, copying, keyboard close behavior, and responsive layout.
