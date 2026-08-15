# Undo and Redo — Design

## Goal

Add consistent, visible undo and redo controls to both the Markdown Normalizer and Live Table Builder. History covers text edits and every meaningful page-level action, while preserving the user's current removal of the builder file/drop control.

## Shared History Manager

A new dependency-free `history.js` exports `createHistory(initialState, options)`. The manager owns a past stack, current snapshot, future stack, a maximum of 50 snapshots, and change subscribers. Its public API is:

```js
{
  commit(nextState),
  replace(nextState),
  undo(),
  redo(),
  reset(nextState),
  getState(),
  canUndo(),
  canRedo(),
  subscribe(listener),
  dispose()
}
```

Snapshots are copied by a configurable clone function and compared by a configurable equality function. `commit` ignores equivalent states, moves the current state into the past, clears future states after a divergent edit, and removes the oldest snapshot above the limit. `replace` updates the current snapshot without creating a new history step and is used to combine active typing. `reset` clears both stacks.

The manager reports snapshots removed from history through an optional disposal callback. This allows the builder to retain local object URLs while an asset remains undoable and revoke them only when no retained snapshot needs them or when the page unloads.

## Controls and Shortcuts

Both pages receive adjacent **Undo** and **Redo** buttons with clear icons, labels, tooltips, and disabled states. The shared keyboard behavior is:

- `Ctrl/Cmd+Z`: Undo.
- `Ctrl/Cmd+Shift+Z`: Redo.
- `Ctrl+Y`: Redo.

The page prevents the browser's native undo only when the custom manager can perform the requested action. When no custom action is available, native text-field behavior is not blocked.

Text input is grouped into history steps using a 300 ms idle boundary. The first input event after an idle boundary commits a snapshot; subsequent events inside the same typing session replace that snapshot. Blur and non-text actions end the active typing session.

## Markdown Normalizer History

The normalizer snapshot contains:

```js
{
  input: "",
  output: ""
}
```

History records direct input edits, pasted text, successful `.md` file loads, and successful normalization output. Undo/redo restores both textareas, recalculates whether Copy Result is enabled, clears stale errors, and announces the action. Modal open/closed state, loader state, temporary status messages, and copied-button text are not historical state.

## Live Table Builder History

The builder snapshot is its existing table model: columns, rows, cell text, and assets. History records:

- Cell and column-name typing.
- Add, remove, and reorder column actions.
- Add, remove, and reorder row actions.
- Paste-added local assets.
- Asset removal and GitHub URL resolution.

Restoring a snapshot re-renders the editor, Markdown output, unresolved count, and Copy Result state. Confirmation dialogs remain required for destructive actions; cancelling does not create history.

The user's uncommitted removal of the builder drop/file picker is preserved. Paste-based asset handling and per-card Resolve behavior remain available, but this feature does not restore the removed control.

## Local Asset URL Lifecycle

Undoable snapshots may share `blob:` preview URLs. The builder gathers all object URLs reachable from the current, past, and future history. When a snapshot is permanently evicted, redo history is cleared, history resets, or the page unloads, an object URL is revoked only if it is no longer referenced by any retained snapshot. This prevents broken previews after undo while avoiding permanent memory leaks.

## Error Handling and Accessibility

- Undo/redo buttons use native `disabled` attributes and descriptive `aria-label` text.
- Status regions announce “Perubahan dibatalkan” or “Perubahan diterapkan kembali.”
- Failed actions and cancelled confirmations do not alter history.
- History restoration clears cell-level errors that no longer apply.
- Keyboard shortcuts work from textareas and other controls without trapping shortcuts when no history action exists.

## Verification

Node 12-compatible tests cover commit, replace, undo, redo, redo invalidation, maximum stack size, cloning, subscription, and disposal. Normalizer state tests verify paired input/output restoration. Builder tests verify structural, text, and asset states round-trip through history and that the removed direct asset/drop control remains absent. Static source checks verify both pages contain Undo/Redo controls and both scripts wire the shared manager.
