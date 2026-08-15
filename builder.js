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

function addAssetsToCell(state, rowId, columnId, assets) {
  const next = cloneState(state);
  const row = next.rows.find(item => item.id === rowId);
  if (!row || !row.cells[columnId]) return state;
  row.cells[columnId].assets.push(...assets.map(asset => ({ ...asset })));
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
  Object.assign(asset, parsed.asset, { id: asset.id, name: asset.name });
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
    countUnresolvedAssets,
    addAssetsToCell,
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
    return cell.assets.filter(asset => asset.sourceType === "local" && asset.previewUrl);
  }

  function revokeAsset(asset) {
    if (asset && asset.sourceType === "local" && asset.previewUrl) {
      URL.revokeObjectURL(asset.previewUrl);
    }
  }

  function revokeRowAssets(row) {
    Object.values(row.cells).forEach(cell => localAssetsInCell(cell).forEach(revokeAsset));
  }

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
    copyBuilderBtn.disabled = unresolved > 0 || builderState.columns.length === 0;
    validationSummary.classList.toggle("has-warning", unresolved > 0);
    validationSummary.textContent = unresolved
      ? `${unresolved} aset lokal masih membutuhkan URL GitHub sebelum hasil dapat disalin.`
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
            ? `<video src="${escapeHtml(asset.previewUrl)}" muted></video>`
            : `<img src="${escapeHtml(asset.previewUrl)}" alt="">`}
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
        <label class="cell-drop" data-role="drop-zone">
          <input class="visually-hidden" type="file" data-role="file-input" accept="image/png,image/gif,image/jpeg,image/svg+xml,video/mp4,video/quicktime,video/webm" multiple>
          <strong>Drop / paste asset</strong><br>atau pilih beberapa file
        </label>
        <div class="github-input-row">
          <input class="github-input" data-role="github-input" aria-label="Markdown atau URL GitHub attachment" placeholder="Paste GitHub URL / Markdown…">
          <select class="asset-kind" data-role="asset-kind" aria-label="Jenis attachment"><option value="image">Image</option><option value="video">Video</option></select>
          <button class="mini-button" type="button" data-action="add-github-asset" data-row-id="${row.id}" data-column-id="${column.id}">Add</button>
        </div>
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
      builderState = addAssetsToCell(builderState, rowId, columnId, accepted);
      renderBuilder();
    }
    if (rejected.length) {
      const nextCard = tableEditor.querySelector(`[data-row-id="${rowId}"][data-column-id="${columnId}"]`);
      showCellError(nextCard || card, `Format tidak didukung: ${rejected.join(", ")}`);
    }
  }

  addColumnBtn.addEventListener("click", function () {
    builderState = addColumn(builderState);
    renderBuilder();
  });

  addRowBtn.addEventListener("click", function () {
    builderState = addRow(builderState);
    renderBuilder();
  });

  tableEditor.addEventListener("input", function (event) {
    const role = event.target.dataset.role;
    if (role === "cell-text") {
      const cell = cellFor(event.target.dataset.rowId, event.target.dataset.columnId);
      if (cell) cell.text = event.target.value;
      updateOutput();
    } else if (role === "column-name") {
      const column = builderState.columns.find(item => item.id === event.target.dataset.columnId);
      if (column) column.label = event.target.value;
      updateOutput();
    }
  });

  tableEditor.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const targetId = button.dataset.targetId;

    if (action === "add-github-asset") {
      const card = button.closest(".cell-card");
      const input = card.querySelector('[data-role="github-input"]');
      const hint = card.querySelector('[data-role="asset-kind"]').value;
      const parsed = parseGitHubAsset(input.value, hint);
      if (!parsed.ok) {
        showCellError(card, parsed.error);
        input.focus();
        return;
      }
      builderState = addAssetsToCell(builderState, button.dataset.rowId, button.dataset.columnId, [parsed.asset]);
      renderBuilder();
      builderStatus.textContent = "GitHub attachment ditambahkan.";
      return;
    }

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
      revokeAsset(current);
      builderState = resolveLocalAsset(builderState, button.dataset.rowId, button.dataset.columnId, button.dataset.assetId, input.value);
      renderBuilder();
      builderStatus.textContent = "Aset lokal berhasil dihubungkan ke GitHub.";
      return;
    }

    if (action === "remove-asset") {
      const current = cellFor(button.dataset.rowId, button.dataset.columnId).assets.find(asset => asset.id === button.dataset.assetId);
      revokeAsset(current);
      builderState = removeAssetFromCell(builderState, button.dataset.rowId, button.dataset.columnId, button.dataset.assetId);
      renderBuilder();
      return;
    }

    if (action === "move-column-left") builderState = moveColumn(builderState, targetId, -1);
    if (action === "move-column-right") builderState = moveColumn(builderState, targetId, 1);
    if (action === "move-row-up") builderState = moveRow(builderState, targetId, -1);
    if (action === "move-row-down") builderState = moveRow(builderState, targetId, 1);
    if (action === "remove-column") {
      if (columnHasContent(targetId) && !window.confirm("Kolom ini berisi konten. Tetap hapus?")) return;
      builderState.rows.forEach(row => {
        const cell = row.cells[targetId];
        if (cell) localAssetsInCell(cell).forEach(revokeAsset);
      });
      builderState = removeColumn(builderState, targetId);
    }
    if (action === "remove-row") {
      const row = builderState.rows.find(item => item.id === targetId);
      if (row && rowHasContent(row) && !window.confirm("Baris ini berisi konten. Tetap hapus?")) return;
      if (row) revokeRowAssets(row);
      builderState = removeRow(builderState, targetId);
    }

    if (["move-column-left", "move-column-right", "move-row-up", "move-row-down", "remove-column", "remove-row"].includes(action)) {
      renderBuilder();
    }
  });

  tableEditor.addEventListener("change", function (event) {
    if (event.target.dataset.role !== "file-input") return;
    const card = event.target.closest(".cell-card");
    addLocalFiles(card.dataset.rowId, card.dataset.columnId, event.target.files, card);
  });

  tableEditor.addEventListener("dragover", function (event) {
    const zone = event.target.closest('[data-role="drop-zone"]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("is-dragging");
  });

  tableEditor.addEventListener("dragleave", function (event) {
    const zone = event.target.closest('[data-role="drop-zone"]');
    if (zone) zone.classList.remove("is-dragging");
  });

  tableEditor.addEventListener("drop", function (event) {
    const zone = event.target.closest('[data-role="drop-zone"]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("is-dragging");
    const card = zone.closest(".cell-card");
    addLocalFiles(card.dataset.rowId, card.dataset.columnId, event.dataTransfer.files, card);
  });

  tableEditor.addEventListener("paste", function (event) {
    const card = event.target.closest(".cell-card");
    const files = event.clipboardData && event.clipboardData.files;
    if (!card || !files || !files.length) return;
    event.preventDefault();
    addLocalFiles(card.dataset.rowId, card.dataset.columnId, files, card);
  });

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

  window.addEventListener("beforeunload", function () {
    builderState.rows.forEach(revokeRowAssets);
  });

  renderBuilder();
}
