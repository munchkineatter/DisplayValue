const socket = io();

const totalValueEl = document.getElementById('totalValue');

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
});

