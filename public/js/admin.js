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
const errorMessageEl = document.getElementById('errorMessage');

let latestState = null;

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
  setError('');
});

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

