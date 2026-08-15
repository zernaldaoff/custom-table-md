const assert = require("assert").strict;
const { createHistory, getHistoryShortcut } = require("../history.js");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("commits, undoes, and redoes cloned snapshots", () => {
  const initial = { value: 0 };
  const history = createHistory(initial);
  history.commit({ value: 1 });
  history.commit({ value: 2 });
  assert.deepEqual(history.undo(), { value: 1 });
  const exposed = history.getState();
  exposed.value = 99;
  assert.deepEqual(history.getState(), { value: 1 });
  assert.deepEqual(history.redo(), { value: 2 });
});

test("ignores equal commits and replace groups active edits", () => {
  const history = createHistory({ value: "" });
  history.commit({ value: "a" });
  history.commit({ value: "a" });
  history.replace({ value: "ab" });
  history.replace({ value: "abc" });
  assert.deepEqual(history.undo(), { value: "" });
  assert.equal(history.canUndo(), false);
  assert.deepEqual(history.redo(), { value: "abc" });
});

test("a divergent commit clears redo and discards its snapshots", () => {
  const discarded = [];
  const history = createHistory({ value: 0 }, { onDiscard: state => discarded.push(state.value) });
  history.commit({ value: 1 });
  history.commit({ value: 2 });
  history.undo();
  history.commit({ value: 3 });
  assert.equal(history.canRedo(), false);
  assert.ok(discarded.includes(2));
});

test("enforces the configured past limit", () => {
  const discarded = [];
  const history = createHistory({ value: 0 }, { limit: 2, onDiscard: state => discarded.push(state.value) });
  history.commit({ value: 1 });
  history.commit({ value: 2 });
  history.commit({ value: 3 });
  assert.ok(discarded.includes(0));
  assert.deepEqual(history.undo(), { value: 2 });
  assert.deepEqual(history.undo(), { value: 1 });
  assert.equal(history.undo(), null);
});

test("reset clears both directions and notifies subscribers", () => {
  const events = [];
  const history = createHistory({ value: 0 });
  const unsubscribe = history.subscribe(info => events.push([info.canUndo, info.canRedo]));
  history.commit({ value: 1 });
  history.undo();
  history.reset({ value: 7 });
  unsubscribe();
  assert.deepEqual(history.getState(), { value: 7 });
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.ok(events.length >= 4);
});

test("dispose reports every retained snapshot once", () => {
  const discarded = [];
  const history = createHistory({ value: 0 }, { onDiscard: state => discarded.push(state.value) });
  history.commit({ value: 1 });
  history.commit({ value: 2 });
  history.undo();
  history.dispose();
  assert.deepEqual(discarded.sort(), [0, 1, 2]);
});

test("classifies standard undo and redo shortcuts", () => {
  assert.equal(getHistoryShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }), "undo");
  assert.equal(getHistoryShortcut({ key: "Z", ctrlKey: false, metaKey: true, shiftKey: true, altKey: false }), "redo");
  assert.equal(getHistoryShortcut({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }), "redo");
  assert.equal(getHistoryShortcut({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), null);
  assert.equal(getHistoryShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: true }), null);
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
