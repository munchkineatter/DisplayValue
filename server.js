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

// Action checkpoints so the admin can restore to any previous state.
// checkpoints[0] is always the start state and is never shown in the UI.
const checkpoints = [{ id: 0, label: 'Start', totalCents: 0, depth: 0, showInHistory: false }];
let nextCheckpointId = 1;

function emitState() {
  io.emit('state', {
    totalCents,
    historyDepth: historyDeltasCents.length,
    history: checkpoints
      .slice(1) // omit "Start"
      .filter((c) => c.showInHistory)
      .map((c) => ({
        id: c.id,
        label: c.label,
        totalCents: c.totalCents,
        depth: c.depth
      }))
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
  socket.emit('state', {
    totalCents,
    historyDepth: historyDeltasCents.length,
    history: checkpoints
      .slice(1)
      .filter((c) => c.showInHistory)
      .map((c) => ({
        id: c.id,
        label: c.label,
        totalCents: c.totalCents,
        depth: c.depth
      }))
  });

  socket.on('addAmount', (amount) => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) return;

    totalCents += cents;
    historyDeltasCents.push(cents);
    const label = `Add $${typeof amount === 'string' ? amount.trim() : (cents / 100).toFixed(2)}`;
    checkpoints.push({
      id: nextCheckpointId++,
      label,
      totalCents,
      depth: historyDeltasCents.length,
      showInHistory: true
    });
    emitState();
  });

  socket.on('resetTotal', () => {
    const previousTotalCents = totalCents;

    // Reset should clear the displayed history and restart the numbering.
    // We still keep a hidden checkpoint/delta so `Undo Previous` can restore the pre-reset total.
    historyDeltasCents.length = 0;
    checkpoints.length = 0;
    checkpoints.push({ id: 0, label: 'Start', totalCents: 0, depth: 0, showInHistory: false });
    nextCheckpointId = 1;

    // Apply reset: total becomes 0, but undo should revert by popping this delta.
    const delta = -previousTotalCents;
    historyDeltasCents.push(delta);
    totalCents = 0;

    // Hidden checkpoint: not shown in the admin history list.
    checkpoints.push({
      id: nextCheckpointId++,
      label: 'Reset',
      totalCents,
      depth: historyDeltasCents.length,
      showInHistory: false
    });

    emitState();
  });

  socket.on('undoPrevious', () => {
    if (historyDeltasCents.length === 0) return;

    const delta = historyDeltasCents.pop();
    totalCents -= delta;
    // Undo should remove the last checkpointed state.
    if (checkpoints.length > 1) checkpoints.pop();
    if (checkpoints.length === 1) checkpoints[0].totalCents = totalCents; // keep start snapshot consistent
    emitState();
  });

  socket.on('restoreTo', (targetDepth) => {
    // Restore the timeline to a previous checkpoint depth.
    const depth = Number(targetDepth);
    if (!Number.isFinite(depth)) return;
    const target = Math.trunc(depth);

    if (target < 0) return;
    if (target > historyDeltasCents.length) return;

    const checkpointIndex = checkpoints.findIndex((c) => c.depth === target);
    if (checkpointIndex === -1) return;

    totalCents = checkpoints[checkpointIndex].totalCents;
    historyDeltasCents.length = target;
    checkpoints.splice(checkpointIndex + 1);

    if (checkpoints.length === 1) checkpoints[0].totalCents = totalCents;

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

