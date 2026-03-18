const socket = io();

const totalValueEl = document.getElementById('totalValue');
const historyEntriesEl = document.getElementById('historyEntries');

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

socket.on('connect', () => {
  // No-op; display updates on `state`.
});

socket.on('state', (state) => {
  totalValueEl.textContent = formatCentsAsDollars(state.totalCents);
  renderHistory(state);
});

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderHistory(state) {
  const history = Array.isArray(state.history) ? state.history : [];

  if (history.length === 0) {
    historyEntriesEl.innerHTML =
      '<div class="display-history-empty">No submissions yet.</div>';
    return;
  }

  // Newest -> oldest
  const sorted = history.slice().sort((a, b) => {
    const bd = b.depth ?? 0;
    const ad = a.depth ?? 0;
    return bd - ad;
  });

  historyEntriesEl.innerHTML = sorted
    .map((entry) => {
      const id = entry.id ?? '';
      const label = entry.label ?? '';
      const totalCents = entry.totalCents ?? 0;

      return `
        <div class="display-history-row">
          <div class="display-history-row-top">
            <div class="display-history-row-seq">#${escapeHtml(id)}</div>
            <div class="display-history-row-total">${escapeHtml(
              formatCentsAsDollars(totalCents)
            )}</div>
          </div>
          <div class="display-history-row-label">${escapeHtml(label)}</div>
        </div>
      `;
    })
    .join('');
}

