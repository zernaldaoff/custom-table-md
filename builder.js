let idSequence = 0;

function defaultId() {
  idSequence += 1;
  return `item-${Date.now().toString(36)}-${idSequence}`;
}

function emptyCell() {
  return { text: "", assets: [] };
}

function createInitialState(makeId = defaultId) {
  const columns = ["Column 1", "Column 2", "Column 3"].map(label => ({
    id: makeId(),
    label
  }));
  const rows = Array.from({ length: 2 }, () => ({
    id: makeId(),
    cells: columns.reduce((cells, column) => {
      cells[column.id] = emptyCell();
      return cells;
    }, {})
  }));
  return { columns, rows };
}

function cloneState(state) {
  return {
    columns: state.columns.map(column => ({ ...column })),
    rows: state.rows.map(row => ({
      ...row,
      cells: Object.keys(row.cells).reduce((cells, columnId) => {
        cells[columnId] = {
          ...row.cells[columnId],
          assets: row.cells[columnId].assets.map(asset => ({ ...asset }))
        };
        return cells;
      }, {})
    }))
  };
}

function addColumn(state, label = `Column ${state.columns.length + 1}`, makeId = defaultId) {
  const next = cloneState(state);
  const column = { id: makeId(), label };
  next.columns.push(column);
  next.rows.forEach(row => { row.cells[column.id] = emptyCell(); });
  return next;
}

function removeColumn(state, columnId) {
  if (state.columns.length <= 1 || !state.columns.some(column => column.id === columnId)) return state;
  const next = cloneState(state);
  next.columns = next.columns.filter(column => column.id !== columnId);
  next.rows.forEach(row => { delete row.cells[columnId]; });
  return next;
}

function moveItem(items, id, offset) {
  const from = items.findIndex(item => item.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function moveColumn(state, columnId, offset) {
  const columns = moveItem(state.columns, columnId, offset);
  if (columns === state.columns) return state;
  return { ...cloneState(state), columns };
}

function addRow(state, makeId = defaultId) {
  const next = cloneState(state);
  next.rows.push({
    id: makeId(),
    cells: next.columns.reduce((cells, column) => {
      cells[column.id] = emptyCell();
      return cells;
    }, {})
  });
  return next;
}

function removeRow(state, rowId) {
  if (!state.rows.some(row => row.id === rowId)) return state;
  const next = cloneState(state);
  next.rows = next.rows.filter(row => row.id !== rowId);
  return next;
}

function moveRow(state, rowId, offset) {
  const rows = moveItem(state.rows, rowId, offset);
  if (rows === state.rows) return state;
  return { ...cloneState(state), rows };
}

function escapeCellText(value) {
  return String(value || "")
    .trim()
    .replace(/\|/g, "\\|")
    .replace(/\r\n|\n|\r/g, "<br>");
}

const githubAttachmentPattern = /https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+(?:[?#][^\s"')>]*)?/i;

function parseGitHubAsset(input, hint = "") {
  const value = String(input || "").trim();
  const urlMatch = value.match(githubAttachmentPattern);
  if (!urlMatch) {
    return { ok: false, error: "Gunakan URL GitHub attachment dari draft comment." };
  }

  const url = urlMatch[0];
  const isMarkdownImage = /^!\[[^\]]*\]\([^)]*\)$/s.test(value);
  const isHtmlImage = /^<img\b[^>]*>$/is.test(value);
  const imageExtension = /\.(png|gif|jpe?g|svg)(?:[?#]|$)/i.test(url);
  const videoExtension = /\.(mp4|mov|webm)(?:[?#]|$)/i.test(url);
  const kind = isMarkdownImage || isHtmlImage || imageExtension || hint === "image"
    ? "image"
    : videoExtension || hint === "video" ? "video" : "image";
  const exportValue = isMarkdownImage || isHtmlImage || kind === "video"
    ? value
    : `<img src="${url}" width="320" alt="GitHub attachment" />`;

  return {
    ok: true,
    asset: {
      id: defaultId(),
      kind,
      sourceType: "github",
      name: kind === "image" ? "GitHub image" : "GitHub video",
      previewUrl: url,
      exportValue
    }
  };
}

function countUnresolvedAssets(state) {
  return state.rows.reduce((total, row) => total +
    Object.values(row.cells).reduce((cellTotal, cell) =>
      cellTotal + cell.assets.filter(asset => asset.sourceType === "local").length, 0), 0);
}

function serializeTable(state) {
  if (!state.columns.length) return "";
  const header = `| ${state.columns.map(column => escapeCellText(column.label)).join(" | ")} |`;
  const separator = `| ${state.columns.map(() => "---").join(" | ")} |`;
  const rows = state.rows.map(row => {
    const cells = state.columns.map(column => {
      const cell = row.cells[column.id] || emptyCell();
      const parts = [];
      const text = escapeCellText(cell.text);
      if (text) parts.push(text);
      cell.assets.forEach(asset => {
        if (asset.sourceType === "github" && asset.exportValue) parts.push(asset.exportValue);
      });
      return parts.join("<br>");
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [header, separator, ...rows].join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
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
  };
}
