// Socket.io client
const socket = io();

// DOM elements
const connectionStatusEl = document.getElementById('connectionStatus');
const addFormEl = document.getElementById('addForm');
const amountInputEl = document.getElementById('amountInput');
const undoBtnEl = document.getElementById('undoBtn');
const resetBtnEl = document.getElementById('resetBtn');
const totalPreviewEl = document.getElementById('totalPreview');
const historyHintEl = document.getElementById('historyHint');
const historyLogEl = document.getElementById('historyLog');
const historySortBtnEl = document.getElementById('historySortBtn');
const errorMessageEl = document.getElementById('errorMessage');

let latestState = null;
let historySortMode = 'desc'; // default: newest -> oldest

function formatCentsAsDollars(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  const isNegative = safeCents < 0;
  const abs = Math.abs(safeCents) / 100;

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(abs);

  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

function setError(message) {
  if (!message) {
    errorMessageEl.style.display = 'none';
    errorMessageEl.textContent = '';
    return;
  }
  errorMessageEl.style.display = 'block';
  errorMessageEl.textContent = message;
}

socket.on('connect', () => {
  connectionStatusEl.textContent = 'Connected';
});

socket.on('disconnect', () => {
  connectionStatusEl.textContent = 'Disconnected';
});

socket.on('state', (state) => {
  latestState = state;
  totalPreviewEl.textContent = formatCentsAsDollars(state.totalCents);

  const depth = state.historyDepth ?? 0;
  historyHintEl.textContent = depth === 0 ? 'No undo history.' : `${depth} action(s) in undo history.`;
  undoBtnEl.disabled = depth === 0;

  renderHistory(state);
  setError('');
});

function renderHistory(state) {
  const history = Array.isArray(state.history) ? state.history : [];
  const currentDepth = state.historyDepth ?? 0;
  const entriesContainer = document.getElementById('historyEntries');

  if (history.length === 0) {
    entriesContainer.innerHTML = '<div class="admin-history-empty">No history yet.</div>';
    return;
  }

  const sorted = history
    .slice()
    .sort((a, b) => {
      const ad = a.depth ?? 0;
      const bd = b.depth ?? 0;
      return historySortMode === 'desc' ? bd - ad : ad - bd;
    });

  entriesContainer.innerHTML = sorted
    .map((entry) => {
      const isCurrent = (entry.depth ?? 0) === currentDepth;
      const seq = entry.id ?? entry.seq ?? '';
      const label = entry.label ?? '';

      return `
        <div class="admin-history-item" data-depth="${entry.depth}">
          <div class="admin-history-text">
            <div class="admin-history-label">
              #${escapeHtml(seq)} ${escapeHtml(label)}
            </div>
            <div class="admin-history-total">${formatCentsAsDollars(entry.totalCents)}</div>
          </div>
          <button class="admin-restore-btn" ${isCurrent ? 'disabled' : ''}>Restore</button>
        </div>
      `;
    })
    .join('');

  // Attach listeners once per render.
  entriesContainer.querySelectorAll('.admin-history-item').forEach((item) => {
    const btn = item.querySelector('.admin-restore-btn');
    btn.addEventListener('click', () => {
      const depthStr = item.getAttribute('data-depth');
      const depth = Number(depthStr);
      socket.emit('restoreTo', depth);
    });
  });
}

function escapeHtml(str) {
  // Minimal escaping for UI safety; labels come from the server.
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

addFormEl.addEventListener('submit', (e) => {
  e.preventDefault();

  const amountStr = amountInputEl.value.trim();
  if (!amountStr) {
    setError('Enter an amount.');
    amountInputEl.focus();
    return;
  }

  const amountNum = Number(amountStr);
  if (!Number.isFinite(amountNum)) {
    setError('Enter a valid numeric amount.');
    amountInputEl.focus();
    return;
  }

  // Send the original string to preserve what the admin typed.
  socket.emit('addAmount', amountStr);
  amountInputEl.value = '';
  amountInputEl.focus();
});

resetBtnEl.addEventListener('click', () => {
  setError('');
  socket.emit('resetTotal');
});

undoBtnEl.addEventListener('click', () => {
  if (latestState?.historyDepth === 0) {
    setError('Nothing to undo.');
    return;
  }
  setError('');
  socket.emit('undoPrevious');
});

// Focus amount input on load
window.addEventListener('load', () => amountInputEl.focus());

if (historySortBtnEl) {
  historySortBtnEl.addEventListener('click', () => {
    historySortMode = historySortMode === 'desc' ? 'asc' : 'desc';
    historySortBtnEl.textContent = historySortMode === 'desc' ? 'Newest → Oldest' : 'Oldest → Newest';
    if (latestState) renderHistory(latestState);
  });
}

