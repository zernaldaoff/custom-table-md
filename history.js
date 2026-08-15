(function (globalScope) {
  function defaultClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function defaultEquals(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function createHistory(initialState, options = {}) {
    const limit = Math.max(1, Number(options.limit) || 50);
    const clone = options.clone || defaultClone;
    const equals = options.equals || defaultEquals;
    const onDiscard = options.onDiscard || function () {};
    const listeners = new Set();
    let past = [];
    let current = clone(initialState);
    let future = [];
    let disposed = false;

    function snapshot(value) {
      return value == null ? null : clone(value);
    }

    function capabilities() {
      return {
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        state: snapshot(current)
      };
    }

    function notify() {
      const info = capabilities();
      listeners.forEach(listener => listener(info));
    }

    function discardAll(items) {
      items.forEach(item => onDiscard(snapshot(item)));
    }

    function commit(nextState) {
      if (disposed || equals(current, nextState)) return snapshot(current);
      discardAll(future);
      future = [];
      past.push(current);
      while (past.length > limit) onDiscard(snapshot(past.shift()));
      current = clone(nextState);
      notify();
      return snapshot(current);
    }

    function replace(nextState) {
      if (disposed || equals(current, nextState)) return snapshot(current);
      onDiscard(snapshot(current));
      current = clone(nextState);
      notify();
      return snapshot(current);
    }

    function undo() {
      if (disposed || !past.length) return null;
      future.push(current);
      current = past.pop();
      notify();
      return snapshot(current);
    }

    function redo() {
      if (disposed || !future.length) return null;
      past.push(current);
      current = future.pop();
      notify();
      return snapshot(current);
    }

    function reset(nextState) {
      if (disposed) return null;
      discardAll(past);
      onDiscard(snapshot(current));
      discardAll(future);
      past = [];
      future = [];
      current = clone(nextState);
      notify();
      return snapshot(current);
    }

    function subscribe(listener) {
      if (disposed) return function () {};
      listeners.add(listener);
      listener(capabilities());
      return function () { listeners.delete(listener); };
    }

    function dispose() {
      if (disposed) return;
      discardAll(past);
      onDiscard(snapshot(current));
      discardAll(future);
      past = [];
      future = [];
      current = null;
      listeners.clear();
      disposed = true;
    }

    return {
      commit,
      replace,
      undo,
      redo,
      reset,
      getState: function () { return snapshot(current); },
      canUndo: function () { return !disposed && past.length > 0; },
      canRedo: function () { return !disposed && future.length > 0; },
      subscribe,
      dispose
    };
  }

  function getHistoryShortcut(event) {
    if (!event || event.altKey || (!event.ctrlKey && !event.metaKey)) return null;
    const key = String(event.key || "").toLowerCase();
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (key === "y" && event.ctrlKey && !event.shiftKey) return "redo";
    return null;
  }

  globalScope.createHistory = createHistory;
  globalScope.getHistoryShortcut = getHistoryShortcut;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createHistory, getHistoryShortcut };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
