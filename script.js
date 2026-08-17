const githubAssetPlaceholderPattern = /📎 Upload ke GitHub: [^\r\n]*?(?=<br>|\s+\|)/g;

function standaloneGithubAttachment(line) {
  const value = line.trim();
  const imageMarkdown = /^!\[[^\]\r\n]*\]\(https:\/\/github\.com\/user-attachments\/assets\/[^)\s]+\)$/i;
  const imageHtml = /^<img\b[^>]*\bsrc=["']https:\/\/github\.com\/user-attachments\/assets\/[^"']+["'][^>]*\/?>$/i;
  const bareAttachment = /^https:\/\/github\.com\/user-attachments\/assets\/\S+$/i;
  return imageMarkdown.test(value) || imageHtml.test(value) || bareAttachment.test(value)
    ? value
    : "";
}

function resolveGithubAssetPlaceholders(markdown) {
  const lines = markdown.split(/\r\n|\n|\r/);
  const placeholderCount = (markdown.match(githubAssetPlaceholderPattern) || []).length;
  const candidates = [];

  lines.forEach((line, index) => {
    if (line.trimStart().startsWith("|")) return;
    const attachment = standaloneGithubAttachment(line);
    if (attachment) candidates.push({ index, attachment });
  });

  const consumed = candidates.slice(0, placeholderCount);
  const consumedLines = new Set(consumed.map(candidate => candidate.index));
  let attachmentIndex = 0;
  const draft = lines
    .filter((line, index) => !consumedLines.has(index))
    .join("\n");
  const resolvedMarkdown = draft.replace(githubAssetPlaceholderPattern, function (placeholder) {
    const candidate = consumed[attachmentIndex];
    if (!candidate) return placeholder;
    const attachment = candidate.attachment;
    attachmentIndex += 1;
    return attachment;
  });

  return {
    markdown: resolvedMarkdown,
    resolved: consumed.length,
    remaining: placeholderCount - consumed.length
  };
}

function normalizeMarkdownTableRows(markdown, columns = 4) {
  const resolvedMarkdown = resolveGithubAssetPlaceholders(markdown).markdown;
  const lines = resolvedMarkdown.split(/\r\n|\n|\r/);
  const result = [];
  let buffer = [];

  function countPipes(text) {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "|" && text[i - 1] !== "\\") count++;
    }
    return count;
  }

  function isTableLine(line) {
    return line.trimStart().startsWith("|");
  }

  function isCompleteTableRow(text) {
    return countPipes(text) >= columns + 1 && text.trimEnd().endsWith("|");
  }

  function cleanRow(text) {
    return text
      .replace(/\s+/g, " ")
      .replace(/(<img\b[^>]*\/>)\s*(?=<img\b)/g, "$1 ")
      .trim();
  }

  function flushBuffer() {
    if (!buffer.length) return;
    result.push(cleanRow(buffer.join(" ")));
    buffer = [];
  }

  for (const line of lines) {
    if (buffer.length) {
      buffer.push(line);
      if (isCompleteTableRow(buffer.join(" "))) flushBuffer();
      continue;
    }

    if (isTableLine(line) && !isCompleteTableRow(line)) {
      buffer.push(line);
      continue;
    }

    result.push(line);
  }

  flushBuffer();
  return result.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeMarkdownTableRows, resolveGithubAssetPlaceholders };
}

if (typeof document !== "undefined") {
  const fileInput = document.getElementById("fileInput");
  const inputEl = document.getElementById("input");
  const outputEl = document.getElementById("output");
  const normalizeBtn = document.getElementById("normalizeBtn");
  const copyBtn = document.getElementById("copyBtn");
  const statusBox = document.getElementById("statusBox");
  const errorBox = document.getElementById("errorBox");
  const columnModal = document.getElementById("columnModal");
  const columnForm = document.getElementById("columnForm");
  const columnCount = document.getElementById("columnCount");
  const columnError = document.getElementById("columnError");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const processBtn = document.getElementById("processBtn");
  const loader = document.getElementById("loader");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  let copyResetTimer;
  let typingTimer;
  let typingActive = false;

  function captureNormalizerState() {
    return { input: inputEl.value, output: outputEl.value };
  }

  const normalizerHistory = createHistory(captureNormalizerState(), { limit: 50 });

  function restoreNormalizerState(state, message) {
    if (!state) return;
    inputEl.value = state.input;
    outputEl.value = state.output;
    copyBtn.disabled = !state.output;
    showError("");
    showStatus(message);
  }

  function endTypingSession() {
    window.clearTimeout(typingTimer);
    typingActive = false;
  }

  function recordTypingState() {
    const state = captureNormalizerState();
    if (typingActive) normalizerHistory.replace(state);
    else {
      normalizerHistory.commit(state);
      typingActive = true;
    }
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(endTypingSession, 300);
  }

  function undoNormalizer() {
    endTypingSession();
    restoreNormalizerState(normalizerHistory.undo(), "Perubahan dibatalkan.");
  }

  function redoNormalizer() {
    endTypingSession();
    restoreNormalizerState(normalizerHistory.redo(), "Perubahan diterapkan kembali.");
  }

  normalizerHistory.subscribe(function (info) {
    undoBtn.disabled = !info.canUndo;
    redoBtn.disabled = !info.canRedo;
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
    if (message) statusBox.textContent = "";
  }

  function showStatus(message) {
    statusBox.textContent = message;
    showError("");
  }

  function clearOutput() {
    outputEl.value = "";
    copyBtn.disabled = true;
  }

  function openModal() {
    showError("");
    columnError.hidden = true;
    columnError.textContent = "";
    columnModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      columnCount.focus();
      columnCount.select();
    });
  }

  function closeModal(restoreFocus = true) {
    columnModal.hidden = true;
    document.body.style.overflow = "";
    columnError.hidden = true;
    if (restoreFocus) normalizeBtn.focus();
  }

  fileInput.addEventListener("change", async function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    endTypingSession();

    if (!/\.md$/i.test(file.name)) {
      fileInput.value = "";
      showError("Format file tidak didukung. Pilih file dengan ekstensi .md.");
      return;
    }

    try {
      inputEl.value = await file.text();
      clearOutput();
      normalizerHistory.commit(captureNormalizerState());
      showStatus(`${file.name} berhasil dimuat dan siap diedit.`);
      inputEl.focus();
    } catch (error) {
      showError("File gagal dibaca. Silakan coba file .md lainnya.");
    }
  });

  inputEl.addEventListener("input", function () {
    if (outputEl.value) clearOutput();
    statusBox.textContent = "";
    recordTypingState();
  });

  inputEl.addEventListener("blur", endTypingSession);
  undoBtn.addEventListener("click", undoNormalizer);
  redoBtn.addEventListener("click", redoNormalizer);

  normalizeBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", () => closeModal());
  cancelModalBtn.addEventListener("click", () => closeModal());

  columnModal.querySelector("[data-modal-close]").addEventListener("click", () => {
    closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !columnModal.hidden) closeModal();
    const shortcut = getHistoryShortcut(event);
    if (shortcut === "undo" && normalizerHistory.canUndo()) {
      event.preventDefault();
      undoNormalizer();
    } else if (shortcut === "redo" && normalizerHistory.canRedo()) {
      event.preventDefault();
      redoNormalizer();
    }
  });

  columnForm.addEventListener("submit", function (event) {
    event.preventDefault();
    endTypingSession();
    const rawColumns = columnCount.value.trim();
    const columns = Number(rawColumns);

    if (!rawColumns || !Number.isInteger(columns) || columns < 1) {
      columnError.textContent = "Masukkan bilangan bulat minimal 1.";
      columnError.hidden = false;
      columnCount.focus();
      return;
    }

    columnError.hidden = true;
    processBtn.disabled = true;
    cancelModalBtn.disabled = true;
    closeModalBtn.disabled = true;
    loader.hidden = false;

    window.setTimeout(function () {
      try {
        const resolution = resolveGithubAssetPlaceholders(inputEl.value);
        outputEl.value = normalizeMarkdownTableRows(inputEl.value, columns);
        copyBtn.disabled = outputEl.value.length === 0;
        normalizerHistory.commit(captureNormalizerState());
        closeModal();
        const assetStatus = resolution.resolved
          ? ` ${resolution.resolved} aset GitHub dipasangkan.${resolution.remaining ? ` ${resolution.remaining} placeholder masih belum memiliki URL.` : ""}`
          : resolution.remaining
            ? ` ${resolution.remaining} placeholder masih menunggu attachment GitHub.`
            : "";
        showStatus(`Tabel berhasil dinormalisasi untuk ${columns} kolom.${assetStatus}`);
      } catch (error) {
        closeModal(false);
        showError(error && error.message ? error.message : "Markdown gagal diproses.");
      } finally {
        loader.hidden = true;
        processBtn.disabled = false;
        cancelModalBtn.disabled = false;
        closeModalBtn.disabled = false;
      }
    }, 150);
  });

  copyBtn.addEventListener("click", async function () {
    if (!outputEl.value) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(outputEl.value);
      } else {
        outputEl.focus();
        outputEl.select();
        if (!document.execCommand("copy")) throw new Error("Copy ditolak browser");
      }

      window.clearTimeout(copyResetTimer);
      copyBtn.textContent = "Copied!";
      showStatus("Hasil berhasil disalin ke clipboard.");
      copyResetTimer = window.setTimeout(function () {
        copyBtn.innerHTML = '<span aria-hidden="true">□</span> Copy Result';
      }, 1200);
    } catch (error) {
      outputEl.focus();
      outputEl.select();
      showError("Gagal copy otomatis. Silakan salin manual dari textarea hasil.");
    }
  });
}
