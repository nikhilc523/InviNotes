import { createEditor, createCollabEditor } from './editor.js';
import { CollaborationManager } from './collaboration.js';
import { SlashMenu } from './slash-menu.js';

// ── State ──
const collab = new CollaborationManager();
let editor = null;

// ── DOM refs ──
const editorContainer = document.getElementById('editor');
const toolbar = document.getElementById('toolbar');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const peersContainer = document.getElementById('peers');
const roomIdDisplay = document.getElementById('room-id-display');
const joinInput = document.getElementById('join-input');

// Share dropdown refs
const shareBtn = document.getElementById('btn-share');
const shareDropdown = document.getElementById('share-dropdown');
const shareNotConnected = document.getElementById('share-not-connected');
const shareConnected = document.getElementById('share-connected');
const sharePeersList = document.getElementById('share-peers-list');

// ── Slash menu ──
const slashMenu = new SlashMenu(() => editor);

// ── Share dropdown toggle ──
shareBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !shareDropdown.classList.contains('hidden');
  if (isOpen) {
    closeShareDropdown();
  } else {
    openShareDropdown();
  }
});

function openShareDropdown() {
  shareDropdown.classList.remove('hidden');
  shareBtn.classList.add('active');
  updateShareDropdownState();
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', onShareOutsideClick);
  }, 0);
}

function closeShareDropdown() {
  shareDropdown.classList.add('hidden');
  shareBtn.classList.remove('active');
  document.removeEventListener('click', onShareOutsideClick);
}

function onShareOutsideClick(e) {
  if (!shareDropdown.contains(e.target) && e.target !== shareBtn && !shareBtn.contains(e.target)) {
    closeShareDropdown();
  }
}

function updateShareDropdownState() {
  if (collab.roomId) {
    shareNotConnected.classList.add('hidden');
    shareConnected.classList.remove('hidden');
    renderSharePeers();
  } else {
    shareNotConnected.classList.remove('hidden');
    shareConnected.classList.add('hidden');
  }
}

function renderSharePeers() {
  const peers = collab._getPeers ? collab._getPeers() : [];
  sharePeersList.innerHTML = '';

  // Show self first
  const selfRow = document.createElement('div');
  selfRow.className = 'share-peer-row';
  selfRow.innerHTML = `
    <div class="share-peer-avatar" style="background: ${collab.userColor}">${collab.userName.charAt(0)}</div>
    <span class="share-peer-name">${collab.userName}</span>
    <span class="share-peer-you">You</span>
  `;
  sharePeersList.appendChild(selfRow);

  // Other peers
  peers.forEach(peer => {
    const row = document.createElement('div');
    row.className = 'share-peer-row';
    row.innerHTML = `
      <div class="share-peer-avatar" style="background: ${peer.color}">${peer.name.charAt(0)}</div>
      <span class="share-peer-name">${peer.name}</span>
    `;
    sharePeersList.appendChild(row);
  });
}

// ── Initialize standalone editor ──
function initStandaloneEditor() {
  if (editor) editor.destroy();
  editorContainer.innerHTML = '';
  editor = createEditor(editorContainer);
  bindEditor();
  updateRoomUI(null);
}

// ── Initialize collaborative editor ──
function initCollabEditor() {
  try {
    if (editor) editor.destroy();
    editorContainer.innerHTML = '';

    const fragment = collab.getYXmlFragment();
    editor = createCollabEditor(
      editorContainer,
      fragment,
      collab.provider,
      { name: collab.userName, color: collab.userColor }
    );
    bindEditor();
    updateRoomUI(collab.roomId);
  } catch (err) {
    console.error('[InviNotes] Failed to init collab editor:', err);
    initStandaloneEditor();
  }
}

// ── Bind editor events ──
function bindEditor() {
  bindToolbar();
  bindSlashCommands();
}

// ── Slash command detection ──
function bindSlashCommands() {
  editor.on('update', ({ editor: ed }) => {
    if (!slashMenu.isOpen) return;

    const { from } = ed.state.selection;
    const slashPos = slashMenu.slashPos;

    if (from <= slashPos) {
      slashMenu.close();
      return;
    }

    const textBetween = ed.state.doc.textBetween(slashPos, from, '');
    if (!textBetween.startsWith('/')) {
      slashMenu.close();
      return;
    }

    const query = textBetween.slice(1);
    slashMenu.updateQuery(query);
  });

  editor.view.dom.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (editor.isActive('codeBlock')) return;

      setTimeout(() => {
        const { from } = editor.state.selection;
        const $pos = editor.state.doc.resolve(from);
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, '');

        if (textBefore.trim() === '/') {
          const slashPos = from - 1;
          const coords = editor.view.coordsAtPos(from);
          slashMenu.open(slashPos, coords);
        }
      }, 0);
    }
  });
}

// ── Collaboration events ──
collab.onStatusChange = (status) => {
  statusDot.className = 'status-dot ' + status;
  switch (status) {
    case 'connected':
      statusText.textContent = 'Connected';
      break;
    case 'connecting':
      statusText.textContent = 'Connecting...';
      break;
    case 'disconnected':
      statusText.textContent = '';
      break;
  }
  // Update share dropdown if open
  if (!shareDropdown.classList.contains('hidden')) {
    updateShareDropdownState();
  }
};

collab.onPeersChange = (peers) => {
  // Titlebar peer dots
  peersContainer.innerHTML = '';
  peers.forEach(peer => {
    const dot = document.createElement('span');
    dot.className = 'peer-dot';
    dot.style.backgroundColor = peer.color;
    dot.title = peer.name;
    peersContainer.appendChild(dot);
  });
  // Update share dropdown peers list if open
  if (!shareDropdown.classList.contains('hidden') && collab.roomId) {
    renderSharePeers();
  }
};

// ── Room UI ──
function updateRoomUI(roomId) {
  if (roomId) {
    roomIdDisplay.textContent = roomId.slice(0, 8) + '...';
    roomIdDisplay.title = roomId;
  } else {
    roomIdDisplay.textContent = '';
    peersContainer.innerHTML = '';
    statusDot.className = 'status-dot';
    statusText.textContent = '';
  }
  // Sync share dropdown state
  if (!shareDropdown.classList.contains('hidden')) {
    updateShareDropdownState();
  }
}

// ── Room actions ──
document.getElementById('btn-new-room').addEventListener('click', () => {
  collab.createRoom();
  initCollabEditor();
  updateShareDropdownState();
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const roomId = joinInput.value.trim();
  if (!roomId) return;
  const extracted = roomId.replace('invinotes://join/', '');
  collab.joinRoom(extracted);
  initCollabEditor();
  joinInput.value = '';
});

joinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-join-room').click();
  }
});

document.getElementById('btn-copy-link').addEventListener('click', () => {
  const link = collab.getShareLink();
  if (link) {
    navigator.clipboard.writeText(link).then(() => {
      const btn = document.getElementById('btn-copy-link');
      const origHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.25 5L6 12.25 2.75 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
      btn.style.color = '#2ecc71';
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.style.color = '';
      }, 1500);
    });
  }
});

document.getElementById('btn-disconnect').addEventListener('click', () => {
  collab.disconnect();
  initStandaloneEditor();
  updateShareDropdownState();
});

// ── Handle deep link from main process ──
if (window.inviNotes && window.inviNotes.onJoinRoom) {
  window.inviNotes.onJoinRoom((roomId) => {
    collab.joinRoom(roomId);
    initCollabEditor();
  });
}

// ── Toolbar (hidden, but still functional via keyboard shortcuts) ──
function bindToolbar() {
  editor.on('selectionUpdate', updateToolbarState);
  editor.on('transaction', updateToolbarState);
}

toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || !editor) return;

  const action = btn.dataset.action;

  switch (action) {
    case 'bold': editor.chain().focus().toggleBold().run(); break;
    case 'italic': editor.chain().focus().toggleItalic().run(); break;
    case 'strike': editor.chain().focus().toggleStrike().run(); break;
    case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
    case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
    case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
    case 'bullet-list': editor.chain().focus().toggleBulletList().run(); break;
    case 'ordered-list': editor.chain().focus().toggleOrderedList().run(); break;
    case 'code-block': editor.chain().focus().toggleCodeBlock().run(); break;
    case 'blockquote': editor.chain().focus().toggleBlockquote().run(); break;
    case 'divider': editor.chain().focus().setHorizontalRule().run(); break;
    case 'undo': editor.chain().focus().undo().run(); break;
    case 'redo': editor.chain().focus().redo().run(); break;
  }

  updateToolbarState();
});

function updateToolbarState() {
  if (!editor) return;
  toolbar.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    let isActive = false;

    switch (action) {
      case 'bold': isActive = editor.isActive('bold'); break;
      case 'italic': isActive = editor.isActive('italic'); break;
      case 'strike': isActive = editor.isActive('strike'); break;
      case 'h1': isActive = editor.isActive('heading', { level: 1 }); break;
      case 'h2': isActive = editor.isActive('heading', { level: 2 }); break;
      case 'h3': isActive = editor.isActive('heading', { level: 3 }); break;
      case 'bullet-list': isActive = editor.isActive('bulletList'); break;
      case 'ordered-list': isActive = editor.isActive('orderedList'); break;
      case 'code-block': isActive = editor.isActive('codeBlock'); break;
      case 'blockquote': isActive = editor.isActive('blockquote'); break;
    }

    btn.classList.toggle('active', isActive);
  });
}

// ── Window Controls ──
document.getElementById('btn-minimize').addEventListener('click', () => {
  window.inviNotes.minimize();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.inviNotes.close();
});

const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value, 10) / 100;
  window.inviNotes.setOpacity(value);
});

const badge = document.getElementById('click-through-badge');
window.inviNotes.onClickThroughChanged((enabled) => {
  badge.classList.toggle('hidden', !enabled);
});

// ── Platform Warnings & Tips ──
function showBanner(message, level, dismissKey) {
  const banner = document.createElement('div');
  banner.className = `app-banner ${level}`;
  banner.innerHTML = `<span>${message}</span><button class="banner-dismiss" title="Dismiss">&times;</button>`;
  banner.querySelector('.banner-dismiss').addEventListener('click', () => {
    if (dismissKey) localStorage.setItem(`dismissed-${dismissKey}`, '1');
    banner.remove();
  });
  document.getElementById('app').prepend(banner);
}

if (window.inviNotes.onPlatformWarning) {
  window.inviNotes.onPlatformWarning(({ type, message }) => {
    showBanner(message, 'warning', type);
  });
}

if (window.inviNotes.onPlatformTip) {
  window.inviNotes.onPlatformTip(({ type, message }) => {
    if (localStorage.getItem(`dismissed-${type}`)) return;
    showBanner(message, 'tip', type);
  });
}

// ── Auto-Updater ──
if (window.inviNotes.onUpdateReady) {
  window.inviNotes.onUpdateReady(() => {
    const banner = document.createElement('div');
    banner.className = 'app-banner tip';
    banner.innerHTML = `<span>A new version is ready. <button id="btn-restart-update" style="background:none;border:none;color:#2ecc71;cursor:pointer;text-decoration:underline;font-size:inherit;">Restart to update</button></span>`;
    document.getElementById('app').prepend(banner);
    document.getElementById('btn-restart-update').addEventListener('click', () => {
      window.inviNotes.restartForUpdate();
    });
  });
}

// ── Start in standalone mode ──
initStandaloneEditor();
