import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = process.env.SERVER_URL;

// Random user colors for cursor awareness
const COLORS = [
  '#6c63ff', '#ff6b6b', '#4ade80', '#f59e0b',
  '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6',
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateUserName() {
  const adjectives = ['Swift', 'Quiet', 'Bold', 'Bright', 'Calm', 'Quick', 'Sharp', 'Warm'];
  const nouns = ['Fox', 'Owl', 'Bear', 'Hawk', 'Wolf', 'Lynx', 'Deer', 'Crow'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

export class CollaborationManager {
  constructor() {
    this.doc = null;
    this.provider = null;
    this.roomId = null;
    this.userName = generateUserName();
    this.userColor = randomColor();
    this.onStatusChange = null;
    this.onPeersChange = null;
  }

  get isConnected() {
    return this.provider && this.provider.wsconnected;
  }

  createRoom() {
    const roomId = uuidv4();
    this.joinRoom(roomId);
    return roomId;
  }

  joinRoom(roomId) {
    // Disconnect from current room if any
    this.disconnect();

    this.roomId = roomId;
    this.doc = new Y.Doc();

    this.provider = new WebsocketProvider(SERVER_URL, roomId, this.doc);

    // Set local awareness (cursor name + color)
    this.provider.awareness.setLocalStateField('user', {
      name: this.userName,
      color: this.userColor,
    });

    // Connection status events
    this.provider.on('status', ({ status }) => {
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
    });

    // Track peers via awareness
    this.provider.awareness.on('change', () => {
      if (this.onPeersChange) {
        const peers = this._getPeers();
        this.onPeersChange(peers);
      }
    });
  }

  disconnect() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.roomId = null;
  }

  getShareLink() {
    if (!this.roomId) return null;
    return `invinotes://join/${this.roomId}`;
  }

  getYXmlFragment(name = 'prosemirror') {
    if (!this.doc) return null;
    return this.doc.getXmlFragment(name);
  }

  _getPeers() {
    if (!this.provider) return [];
    const states = this.provider.awareness.getStates();
    const peers = [];
    states.forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return; // skip self
      if (state.user) {
        peers.push({
          clientId,
          name: state.user.name,
          color: state.user.color,
        });
      }
    });
    return peers;
  }
}
