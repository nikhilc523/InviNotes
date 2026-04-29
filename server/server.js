import http from 'node:http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { v4 as uuidv4 } from 'uuid';
// Persistence: disabled temporarily for debugging — enable once LevelDB works in Docker
// import { LevelPersistence } from './persistence.js';

const PORT = process.env.PORT || 1234;
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `ws://localhost:${PORT}`;
// const persistence = new LevelPersistence(process.env.DATA_DIR || './data/yjs-docs');

const persistence = null; // in-memory only for now

// Debounce helper
const saveTimers = new Map();
function debouncedSave(roomId, doc, ms = 1000) {
  if (!persistence) return;
  if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));
  saveTimers.set(roomId, setTimeout(async () => {
    saveTimers.delete(roomId);
    try {
      await persistence.saveDoc(roomId, doc);
    } catch (err) {
      console.error(`[Persist] Save failed for ${roomId}:`, err.message);
    }
  }, ms));
}

// Message type constants (match y-websocket client protocol)
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ── Room Management ──

const rooms = new Map(); // roomId -> { doc, awareness, conns }

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const doc = new Y.Doc();

  // Load persisted state if available
  if (persistence) {
    try {
      const saved = await persistence.loadDoc(roomId);
      if (saved) {
        Y.applyUpdate(doc, saved);
        console.log(`[Persist] Loaded state for room ${roomId}`);
      }
    } catch (err) {
      console.error(`[Persist] Failed to load room ${roomId}, starting fresh:`, err.message);
    }
  }

  const awareness = new awarenessProtocol.Awareness(doc);

  const room = {
    id: roomId,
    doc,
    awareness,
    conns: new Map(), // ws -> Set<awarenessClientId>
    createdAt: new Date().toISOString(),
  };

  // Persist on document updates (debounced)
  doc.on('update', () => {
    debouncedSave(roomId, doc);
  });

  // Broadcast awareness changes to all clients in the room
  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const msg = encoding.toUint8Array(encoder);

    room.conns.forEach((_clientIds, conn) => {
      if (conn !== origin && conn.readyState === conn.OPEN) {
        conn.send(msg);
      }
    });
  });

  rooms.set(roomId, room);
  console.log(`[Room] Created: ${roomId}`);
  return room;
}

async function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    // Flush any pending save and persist final state
    if (saveTimers.has(roomId)) {
      clearTimeout(saveTimers.get(roomId));
      saveTimers.delete(roomId);
    }
    if (persistence) {
      try {
        await persistence.saveDoc(roomId, room.doc);
        console.log(`[Persist] Saved final state for room ${roomId}`);
      } catch (err) {
        console.error(`[Persist] Final save failed for ${roomId}:`, err.message);
      }
    }
    room.awareness.destroy();
    room.doc.destroy();
    rooms.delete(roomId);
    console.log(`[Room] Destroyed: ${roomId}`);
  }
}

// ── WebSocket Connection Handling ──

async function handleConnection(ws, roomId) {
  console.log(`[Conn] Step 1: getOrCreateRoom for ${roomId}`);
  const room = await getOrCreateRoom(roomId);
  console.log(`[Conn] Step 2: room ready`);
  const clientIds = new Set();
  room.conns.set(ws, clientIds);

  console.log(`[Conn] Step 3: Client joined room ${roomId} (${room.conns.size} clients)`);

  // Send initial sync step 1
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, room.doc);
  console.log(`[Conn] Step 4: sync step 1 encoded`);
  ws.send(encoding.toUint8Array(syncEncoder));
  console.log(`[Conn] Step 5: sync step 1 sent`);

  // Send current awareness state
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys())
      )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }
  console.log(`[Conn] Step 6: awareness sent, setting up message handler`);

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const msg = new Uint8Array(data);
      const decoder = decoding.createDecoder(msg);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MSG_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const syncMessageType = syncProtocol.readSyncMessage(
            decoder,
            encoder,
            room.doc,
            ws
          );

          // If there's a response (sync step 2 or update), send it back
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }

          // If this was a sync step 2 or update, broadcast to other clients
          if (syncMessageType === syncProtocol.messageYjsSyncStep2 ||
              syncMessageType === syncProtocol.messageYjsUpdate) {
            // Broadcast the original message to all other clients
            room.conns.forEach((_ids, conn) => {
              if (conn !== ws && conn.readyState === conn.OPEN) {
                conn.send(msg);
              }
            });
          }
          break;
        }
        case MSG_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);

          // Track this client's awareness client ID (the doc clientID)
          // After applying, check which states exist and associate with this conn
          room.awareness.getStates().forEach((_state, cid) => {
            // We can't easily know which IDs came from which conn,
            // so we track all IDs we've seen on this connection
            clientIds.add(cid);
          });
          break;
        }
      }
    } catch (err) {
      console.error(`[Error] Message handling:`, err.message);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    // Remove awareness states for this client
    if (clientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(clientIds),
        null
      );
    }
    room.conns.delete(ws);
    console.log(`[Conn] Client left room ${roomId} (${room.conns.size} clients)`);

    // Clean up empty rooms after a delay
    if (room.conns.size === 0) {
      setTimeout(() => {
        if (room.conns.size === 0) {
          removeRoom(roomId);
        }
      }, 30000); // Keep room alive for 30s after last client leaves
    }
  });

  ws.on('error', (err) => {
    console.error(`[Error] WebSocket:`, err.message);
  });
}

// ── HTTP Server ──

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      uptime: process.uptime(),
    }));
    return;
  }

  // Create new room
  if (req.method === 'POST' && url.pathname === '/rooms') {
    const roomId = uuidv4();
    await getOrCreateRoom(roomId);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      roomId,
      wsUrl: `${SERVER_BASE_URL}/${roomId}`,
      shareLink: `invinotes://join/${roomId}`,
    }));
    return;
  }

  // List rooms (for debugging)
  if (req.method === 'GET' && url.pathname === '/rooms') {
    const roomList = Array.from(rooms.values()).map(r => ({
      id: r.id,
      clients: r.conns.size,
      createdAt: r.createdAt,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(roomList));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── WebSocket Server ──

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Extract room ID from URL path: /roomId
  const roomId = req.url.slice(1).split('?')[0];

  if (!roomId) {
    ws.close(4000, 'Room ID required');
    return;
  }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  handleConnection(ws, roomId).catch((err) => {
    console.error(`[Error] Connection handler failed for room ${roomId}:`, err.message, err.stack);
    ws.close(4001, 'Server error');
  });
});

// Keep-alive: ping every 30s, terminate unresponsive connections
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(pingInterval));

// ── Start ──

server.listen(PORT, '0.0.0.0', () => {
  console.log(`InviNotes server running on port ${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}/<roomId>`);
  console.log(`  HTTP API:  http://localhost:${PORT}/health`);
  console.log(`             POST http://localhost:${PORT}/rooms`);
});

// ── Graceful Shutdown ──

async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received, shutting down...`);
  if (persistence) {
    for (const [roomId, room] of rooms) {
      if (saveTimers.has(roomId)) {
        clearTimeout(saveTimers.get(roomId));
        saveTimers.delete(roomId);
      }
      try {
        await persistence.saveDoc(roomId, room.doc);
        console.log(`[Persist] Saved room ${roomId}`);
      } catch (err) {
        console.error(`[Persist] Failed to save ${roomId}:`, err.message);
      }
    }
    await persistence.close();
  }
  console.log('[Server] Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
