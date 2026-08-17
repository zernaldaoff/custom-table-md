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

function extractGitHubAssets(input) {
  const value = String(input || "");
  const attachmentMarkupPattern = /<img\b[^>]*\bsrc=["']https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+(?:[?#][^"']*)?["'][^>]*\/?>|!\[[^\]]*\]\(https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+(?:[?#][^)\s]*)?\)|https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+(?:[?#][^\s"')>]*)?/gi;
  const assets = [];
  const remainingText = value
    .replace(attachmentMarkupPattern, function (markup) {
      const isImageMarkup = /^<img\b/i.test(markup) || /^!\[/i.test(markup);
      const parsed = parseGitHubAsset(markup, isImageMarkup ? "image" : "video");
      if (!parsed.ok) return markup;
      assets.push(parsed.asset);
      return "";
    })
    .split(/\r\n|\n|\r/)
    .filter(line => line.trim())
    .join("\n")
    .trim();

  return { assets, remainingText };
}

function countUnresolvedAssets(state) {
  return state.rows.reduce((total, row) => total +
    Object.values(row.cells).reduce((cellTotal, cell) =>
      cellTotal + cell.assets.filter(asset => asset.sourceType === "local").length, 0), 0);
}

function addAssetsToCell(state, rowId, columnId, assets) {
  const next = cloneState(state);
  const row = next.rows.find(item => item.id === rowId);
  if (!row || !row.cells[columnId]) return state;
  row.cells[columnId].assets.push(...assets.map(asset => ({ ...asset })));
  return next;
}

function addGithubAssetsToCell(state, rowId, columnId, assets) {
  const next = cloneState(state);
  const row = next.rows.find(item => item.id === rowId);
  const cell = row && row.cells[columnId];
  if (!cell) return state;
  const unresolved = cell.assets.filter(asset => asset.sourceType === "local");

  assets.forEach((asset, index) => {
    const localAsset = unresolved[index];
    if (!localAsset) {
      cell.assets.push({ ...asset });
      return;
    }
    localAsset.sourceType = "github";
    localAsset.exportValue = asset.exportValue;
    localAsset.githubUrl = asset.previewUrl;
  });
  return next;
}

function removeAssetFromCell(state, rowId, columnId, assetId) {
  const next = cloneState(state);
  const row = next.rows.find(item => item.id === rowId);
  if (!row || !row.cells[columnId]) return state;
  const before = row.cells[columnId].assets.length;
  row.cells[columnId].assets = row.cells[columnId].assets.filter(asset => asset.id !== assetId);
  return row.cells[columnId].assets.length === before ? state : next;
}

function resolveLocalAsset(state, rowId, columnId, assetId, githubInput) {
  const next = cloneState(state);
  const row = next.rows.find(item => item.id === rowId);
  const cell = row && row.cells[columnId];
  const asset = cell && cell.assets.find(item => item.id === assetId);
  if (!asset || asset.sourceType !== "local") return state;
  const parsed = parseGitHubAsset(githubInput, asset.kind);
  if (!parsed.ok) return state;
  Object.assign(asset, {
    sourceType: "github",
    exportValue: parsed.asset.exportValue,
    githubUrl: parsed.asset.previewUrl
  });
  return next;
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
        if (asset.sourceType === "local") {
          parts.push(`📎 Upload ke GitHub: ${escapeCellText(asset.name || "aset lokal")}`);
        }
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
    extractGitHubAssets,
    serializeTable,
    countUnresolvedAssets,
    addAssetsToCell,
    addGithubAssetsToCell,
    removeAssetFromCell,
    resolveLocalAsset
  };
}

if (typeof document !== "undefined") {
  let builderState = createInitialState();
  const tableEditor = document.getElementById("tableEditor");
  const addColumnBtn = document.getElementById("addColumnBtn");
  const addRowBtn = document.getElementById("addRowBtn");
  const builderOutput = document.getElementById("builderOutput");
  const copyBuilderBtn = document.getElementById("copyBuilderBtn");
  const validationSummary = document.getElementById("validationSummary");
  const builderStatus = document.getElementById("builderStatus");
  const builderError = document.getElementById("builderError");
  const builderUndoBtn = document.getElementById("builderUndoBtn");
  const builderRedoBtn = document.getElementById("builderRedoBtn");
  const objectUrlReferences = new Map();
  let builderTypingTimer;
  let builderTypingActive = false;
  let builderHistory;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cellFor(rowId, columnId) {
    const row = builderState.rows.find(item => item.id === rowId);
    return row && row.cells[columnId];
  }

  function rowHasContent(row) {
    return Object.values(row.cells).some(cell => cell.text.trim() || cell.assets.length);
  }

  function columnHasContent(columnId) {
    return builderState.rows.some(row => {
      const cell = row.cells[columnId];
      return cell && (cell.text.trim() || cell.assets.length);
    });
  }

  function localAssetsInCell(cell) {
    return cell.assets.filter(asset => /^blob:/i.test(asset.previewUrl || ""));
  }

  function revokeAsset(asset) {
    if (asset && /^blob:/i.test(asset.previewUrl || "")) {
      URL.revokeObjectURL(asset.previewUrl);
    }
  }

  function revokeRowAssets(row) {
    Object.values(row.cells).forEach(cell => localAssetsInCell(cell).forEach(revokeAsset));
  }

  function objectUrlsInState(state) {
    const urls = new Set();
    state.rows.forEach(row => {
      Object.values(row.cells).forEach(cell => {
        localAssetsInCell(cell).forEach(asset => urls.add(asset.previewUrl));
      });
    });
    return urls;
  }

  function retainStateUrls(state) {
    objectUrlsInState(state).forEach(url => {
      objectUrlReferences.set(url, (objectUrlReferences.get(url) || 0) + 1);
    });
  }

  function discardStateUrls(state) {
    if (!state) return;
    objectUrlsInState(state).forEach(url => {
      const nextCount = (objectUrlReferences.get(url) || 1) - 1;
      if (nextCount <= 0) {
        objectUrlReferences.delete(url);
        URL.revokeObjectURL(url);
      } else {
        objectUrlReferences.set(url, nextCount);
      }
    });
  }

  function statesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  retainStateUrls(builderState);
  builderHistory = createHistory(builderState, {
    limit: 50,
    onDiscard: discardStateUrls
  });

  function endBuilderTyping() {
    window.clearTimeout(builderTypingTimer);
    builderTypingActive = false;
  }

  function acceptHistoryState(nextState, replace = false) {
    if (statesEqual(builderHistory.getState(), nextState)) return builderHistory.getState();
    retainStateUrls(nextState);
    return replace ? builderHistory.replace(nextState) : builderHistory.commit(nextState);
  }

  function applyBuilderState(nextState) {
    endBuilderTyping();
    builderState = acceptHistoryState(nextState);
    renderBuilder();
  }

  function recordBuilderTyping() {
    builderState = acceptHistoryState(builderState, builderTypingActive);
    builderTypingActive = true;
    window.clearTimeout(builderTypingTimer);
    builderTypingTimer = window.setTimeout(endBuilderTyping, 300);
  }

  function restoreBuilderState(state, message) {
    if (!state) return;
    builderState = state;
    renderBuilder();
    showBuilderError("");
    builderStatus.textContent = message;
  }

  function undoBuilder() {
    endBuilderTyping();
    restoreBuilderState(builderHistory.undo(), "Perubahan dibatalkan.");
  }

  function redoBuilder() {
    endBuilderTyping();
    restoreBuilderState(builderHistory.redo(), "Perubahan diterapkan kembali.");
  }

  builderHistory.subscribe(function (info) {
    builderUndoBtn.disabled = !info.canUndo;
    builderRedoBtn.disabled = !info.canRedo;
  });

  function showCellError(card, message) {
    const error = card && card.querySelector('[data-role="cell-error"]');
    if (error) error.textContent = message;
  }

  function showBuilderError(message) {
    builderError.textContent = message;
    builderError.hidden = !message;
    if (message) builderStatus.textContent = "";
  }

  function updateOutput() {
    const unresolved = countUnresolvedAssets(builderState);
    builderOutput.value = serializeTable(builderState);
    copyBuilderBtn.disabled = builderState.columns.length === 0;
    validationSummary.classList.toggle("has-warning", unresolved > 0);
    validationSummary.textContent = unresolved
      ? `${unresolved} aset lokal ditandai di draft. Upload file tersebut di komentar GitHub, lalu normalisasi kembali hasilnya.`
      : "Semua aset siap diekspor ke GitHub.";
  }

  function actionButton(action, targetId, label, symbol, disabled = false) {
    return `<button class="icon-button${action === "remove-column" || action === "remove-row" ? " danger" : ""}" type="button" data-action="${action}" data-target-id="${targetId}" aria-label="${label}"${disabled ? " disabled" : ""}>${symbol}</button>`;
  }

  function renderAssetCards(rowId, columnId, assets) {
    return assets.map(asset => `
      <article class="asset-card" data-asset-id="${asset.id}">
        <div class="asset-preview">
          ${asset.kind === "video"
            ? `<video data-role="asset-preview-media" src="${escapeHtml(asset.previewUrl)}" muted></video>`
            : `<img data-role="asset-preview-media" src="${escapeHtml(asset.previewUrl)}" alt="">`}
          <span class="asset-preview-fallback">Preview setelah GitHub dikirim</span>
        </div>
        <div class="asset-meta">
          <p class="asset-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</p>
          <span class="asset-badge${asset.sourceType === "local" ? " unresolved" : ""}">${asset.sourceType === "local" ? "Needs GitHub URL" : "Ready"}</span>
          ${asset.sourceType === "local" ? `
            <div class="resolve-row">
              <input class="resolve-input" data-role="resolve-input" aria-label="URL GitHub untuk ${escapeHtml(asset.name)}" placeholder="Paste URL GitHub…">
              <button class="mini-button" type="button" data-action="resolve-asset" data-row-id="${rowId}" data-column-id="${columnId}" data-asset-id="${asset.id}">Resolve</button>
            </div>` : ""}
        </div>
        <button class="icon-button danger asset-remove" type="button" data-action="remove-asset" data-row-id="${rowId}" data-column-id="${columnId}" data-asset-id="${asset.id}" aria-label="Hapus ${escapeHtml(asset.name)}">×</button>
      </article>`).join("");
  }

  function renderCell(row, column) {
    const cell = row.cells[column.id];
    return `
      <section class="cell-card" data-row-id="${row.id}" data-column-id="${column.id}">
        <textarea class="cell-text" data-role="cell-text" data-row-id="${row.id}" data-column-id="${column.id}" aria-label="Isi baris ${builderState.rows.indexOf(row) + 1}, ${escapeHtml(column.label)}" placeholder="Tulis isi sel…">${escapeHtml(cell.text)}</textarea>
        <p class="cell-error" data-role="cell-error" aria-live="polite"></p>
        <div class="asset-list">${renderAssetCards(row.id, column.id, cell.assets)}</div>
      </section>`;
  }

  function renderBuilder() {
    const columns = builderState.columns;
    let markup = `<div class="live-grid" style="grid-template-columns: 52px repeat(${columns.length}, minmax(260px, 1fr))">`;
    markup += '<div class="corner-card" aria-hidden="true"></div>';
    columns.forEach((column, index) => {
      markup += `
        <section class="column-card">
          <div class="column-controls">
            ${actionButton("move-column-left", column.id, `Geser ${escapeHtml(column.label)} ke kiri`, "←", index === 0)}
            ${actionButton("move-column-right", column.id, `Geser ${escapeHtml(column.label)} ke kanan`, "→", index === columns.length - 1)}
            ${actionButton("remove-column", column.id, `Hapus ${escapeHtml(column.label)}`, "×", columns.length === 1)}
          </div>
          <input class="column-name" data-role="column-name" data-column-id="${column.id}" aria-label="Nama kolom ${index + 1}" value="${escapeHtml(column.label)}">
        </section>`;
    });
    builderState.rows.forEach((row, rowIndex) => {
      markup += `<aside class="row-actions"><div class="row-controls">
        ${actionButton("move-row-up", row.id, `Geser baris ${rowIndex + 1} ke atas`, "↑", rowIndex === 0)}
        ${actionButton("move-row-down", row.id, `Geser baris ${rowIndex + 1} ke bawah`, "↓", rowIndex === builderState.rows.length - 1)}
        ${actionButton("remove-row", row.id, `Hapus baris ${rowIndex + 1}`, "×")}
      </div></aside>`;
      columns.forEach(column => { markup += renderCell(row, column); });
    });
    markup += "</div>";
    tableEditor.innerHTML = markup;
    updateOutput();
  }

  const supportedFileTypes = new Set([
    "image/png", "image/gif", "image/jpeg", "image/svg+xml",
    "video/mp4", "video/quicktime", "video/webm"
  ]);

  function addLocalFiles(rowId, columnId, files, card) {
    const accepted = [];
    const rejected = [];
    Array.from(files).forEach(file => {
      if (!supportedFileTypes.has(file.type)) {
        rejected.push(file.name);
        return;
      }
      accepted.push({
        id: defaultId(),
        kind: file.type.startsWith("video/") ? "video" : "image",
        sourceType: "local",
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        exportValue: ""
      });
    });
    if (accepted.length) {
      applyBuilderState(addAssetsToCell(builderState, rowId, columnId, accepted));
    }
    if (rejected.length) {
      const nextCard = tableEditor.querySelector(`[data-row-id="${rowId}"][data-column-id="${columnId}"]`);
      showCellError(nextCard || card, `Format tidak didukung: ${rejected.join(", ")}`);
    }
  }

  addColumnBtn.addEventListener("click", function () {
    applyBuilderState(addColumn(builderState));
  });

  addRowBtn.addEventListener("click", function () {
    applyBuilderState(addRow(builderState));
  });

  builderUndoBtn.addEventListener("click", undoBuilder);
  builderRedoBtn.addEventListener("click", redoBuilder);

  tableEditor.addEventListener("input", function (event) {
    const role = event.target.dataset.role;
    if (role === "cell-text") {
      const cell = cellFor(event.target.dataset.rowId, event.target.dataset.columnId);
      if (cell) cell.text = event.target.value;
      updateOutput();
      recordBuilderTyping();
    } else if (role === "column-name") {
      const column = builderState.columns.find(item => item.id === event.target.dataset.columnId);
      if (column) column.label = event.target.value;
      updateOutput();
      recordBuilderTyping();
    }
  });

  tableEditor.addEventListener("focusout", function (event) {
    if (event.target.dataset.role === "cell-text" || event.target.dataset.role === "column-name") {
      endBuilderTyping();
    }
  });

  tableEditor.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const targetId = button.dataset.targetId;

    if (action === "resolve-asset") {
      const card = button.closest(".cell-card");
      const assetCard = button.closest(".asset-card");
      const input = assetCard.querySelector('[data-role="resolve-input"]');
      const current = cellFor(button.dataset.rowId, button.dataset.columnId).assets.find(asset => asset.id === button.dataset.assetId);
      const parsed = parseGitHubAsset(input.value, current ? current.kind : "");
      if (!parsed.ok) {
        showCellError(card, parsed.error);
        input.focus();
        return;
      }
      applyBuilderState(resolveLocalAsset(builderState, button.dataset.rowId, button.dataset.columnId, button.dataset.assetId, input.value));
      builderStatus.textContent = "Aset lokal berhasil dihubungkan ke GitHub.";
      return;
    }

    if (action === "remove-asset") {
      applyBuilderState(removeAssetFromCell(builderState, button.dataset.rowId, button.dataset.columnId, button.dataset.assetId));
      return;
    }

    let nextState = builderState;
    if (action === "move-column-left") nextState = moveColumn(builderState, targetId, -1);
    if (action === "move-column-right") nextState = moveColumn(builderState, targetId, 1);
    if (action === "move-row-up") nextState = moveRow(builderState, targetId, -1);
    if (action === "move-row-down") nextState = moveRow(builderState, targetId, 1);
    if (action === "remove-column") {
      if (columnHasContent(targetId) && !window.confirm("Kolom ini berisi konten. Tetap hapus?")) return;
      nextState = removeColumn(builderState, targetId);
    }
    if (action === "remove-row") {
      const row = builderState.rows.find(item => item.id === targetId);
      if (row && rowHasContent(row) && !window.confirm("Baris ini berisi konten. Tetap hapus?")) return;
      nextState = removeRow(builderState, targetId);
    }

    if (["move-column-left", "move-column-right", "move-row-up", "move-row-down", "remove-column", "remove-row"].includes(action)) {
      applyBuilderState(nextState);
    }
  });

  tableEditor.addEventListener("dragover", function (event) {
    const card = event.target.closest(".cell-card");
    if (!card) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    card.classList.add("is-dragging");
  });

  tableEditor.addEventListener("dragleave", function (event) {
    const card = event.target.closest(".cell-card");
    if (!card || card.contains(event.relatedTarget)) return;
    card.classList.remove("is-dragging");
  });

  tableEditor.addEventListener("drop", function (event) {
    const card = event.target.closest(".cell-card");
    if (!card) return;
    event.preventDefault();
    card.classList.remove("is-dragging");
    addLocalFiles(card.dataset.rowId, card.dataset.columnId, event.dataTransfer.files, card);
  });

  tableEditor.addEventListener("paste", function (event) {
    const card = event.target.closest(".cell-card");
    const files = event.clipboardData && event.clipboardData.files;
    if (!card) return;
    if (files && files.length) {
      event.preventDefault();
      addLocalFiles(card.dataset.rowId, card.dataset.columnId, files, card);
      return;
    }
    if (event.target.dataset.role !== "cell-text" || !event.clipboardData) return;
    const pastedText = event.clipboardData.getData("text/plain");
    const extracted = extractGitHubAssets(pastedText);
    if (!extracted.assets.length) return;

    event.preventDefault();
    const nextState = cloneState(builderState);
    const row = nextState.rows.find(item => item.id === card.dataset.rowId);
    const cell = row && row.cells[card.dataset.columnId];
    if (!cell) return;
    if (extracted.remainingText) {
      const start = typeof event.target.selectionStart === "number" ? event.target.selectionStart : cell.text.length;
      const end = typeof event.target.selectionEnd === "number" ? event.target.selectionEnd : start;
      cell.text = `${cell.text.slice(0, start)}${extracted.remainingText}${cell.text.slice(end)}`;
    }
    applyBuilderState(addGithubAssetsToCell(nextState, card.dataset.rowId, card.dataset.columnId, extracted.assets));
    builderStatus.textContent = `${extracted.assets.length} aset GitHub ditambahkan ke sel.`;
  });

  tableEditor.addEventListener("error", function (event) {
    if (event.target.dataset.role !== "asset-preview-media") return;
    const preview = event.target.closest(".asset-preview");
    if (preview) preview.classList.add("has-error");
  }, true);

  copyBuilderBtn.addEventListener("click", async function () {
    if (copyBuilderBtn.disabled) return;
    showBuilderError("");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(builderOutput.value);
      } else {
        builderOutput.focus();
        builderOutput.select();
        if (!document.execCommand("copy")) throw new Error("Copy ditolak browser");
      }
      builderStatus.textContent = "Markdown berhasil disalin. Siap ditempel ke GitHub.";
      copyBuilderBtn.textContent = "Copied!";
      window.setTimeout(() => { copyBuilderBtn.textContent = "□ Copy Result"; }, 1200);
    } catch (error) {
      builderOutput.focus();
      builderOutput.select();
      showBuilderError("Gagal copy otomatis. Silakan salin manual dari textarea hasil.");
    }
  });

  document.addEventListener("keydown", function (event) {
    const shortcut = getHistoryShortcut(event);
    if (shortcut === "undo" && builderHistory.canUndo()) {
      event.preventDefault();
      undoBuilder();
    } else if (shortcut === "redo" && builderHistory.canRedo()) {
      event.preventDefault();
      redoBuilder();
    }
  });

  window.addEventListener("beforeunload", function () {
    endBuilderTyping();
    builderHistory.dispose();
    objectUrlReferences.forEach((count, url) => URL.revokeObjectURL(url));
    objectUrlReferences.clear();
  });

  renderBuilder();
}
