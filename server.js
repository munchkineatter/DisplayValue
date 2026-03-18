const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static assets from `public/`
app.use(express.static(path.join(__dirname, 'public')));

// Running total state (in cents to avoid floating point drift)
let totalCents = 0;
// Stack of deltas applied to totalCents; Undo pops and reverts last delta.
// For reset, we push `-previousTotalCents` so undo returns to the previous total.
const historyDeltasCents = [];

function emitState() {
  io.emit('state', {
    totalCents,
    historyDepth: historyDeltasCents.length
  });
}

function parseDollarsToCents(value) {
  if (value === null || value === undefined) return null;

  // Accept both numbers and numeric strings.
  const dollars = typeof value === 'string' ? parseFloat(value.trim()) : Number(value);
  if (!Number.isFinite(dollars)) return null;

  // Rounds to nearest cent.
  return Math.round(dollars * 100);
}

io.on('connection', (socket) => {
  // Send current state to newly connected clients.
  socket.emit('state', { totalCents, historyDepth: historyDeltasCents.length });

  socket.on('addAmount', (amount) => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) return;

    totalCents += cents;
    historyDeltasCents.push(cents);
    emitState();
  });

  socket.on('resetTotal', () => {
    // Delta that will be subtracted by undo to restore previous total.
    const delta = -totalCents;
    historyDeltasCents.push(delta);

    totalCents = 0;
    emitState();
  });

  socket.on('undoPrevious', () => {
    if (historyDeltasCents.length === 0) return;

    const delta = historyDeltasCents.pop();
    totalCents -= delta;
    emitState();
  });
});

// Convenience routes
app.get('/', (_req, res) => res.redirect('/display.html'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ValueDisplay running on port ${PORT}`);
  console.log(`Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`Display: http://localhost:${PORT}/display.html`);
});

