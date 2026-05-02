const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');

app.setName('InviNotes');

let mainWindow;
let clickThrough = false;
let pendingDeepLink = null; // store deep link if window isn't ready yet

const MOVE_STEP = 50;
const RESIZE_STEP = 50;
const OPACITY_STEP = 0.05;
const MIN_SIZE = { width: 300, height: 200 };

const WINDOW_CONFIG = {
  width: 750,
  height: 550,
  icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: true,
  hasShadow: false,
  focusable: true,
  fullscreenable: false,
  ...(process.platform === 'darwin' && {
    type: 'panel',
    visibleOnAllWorkspaces: true,
    visibleOnFullScreen: true,
  }),
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, '..', 'preload', 'preload.js'),
  },
};

function applyContentProtection() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setContentProtection(true);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  applyContentProtection();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('show', applyContentProtection);
  mainWindow.on('restore', applyContentProtection);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Once renderer is ready, send any pending deep link and platform tips
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      mainWindow.webContents.send('join-room', pendingDeepLink);
      pendingDeepLink = null;
    }

    // Windows < build 2004 black-rectangle warning
    if (process.platform === 'win32') {
      const buildNumber = parseInt(os.release().split('.')[2], 10);
      if (buildNumber < 19041) {
        mainWindow.webContents.send('platform-warning', {
          type: 'old-windows',
          message: 'Your Windows version may show a black rectangle instead of hiding the window. Update to Windows 10 version 2004 or later for full invisibility.',
        });
      }
    }

    // macOS Zoom tip
    if (process.platform === 'darwin') {
      mainWindow.webContents.send('platform-tip', {
        type: 'zoom-macos',
        message: 'Using Zoom on macOS? Enable "Advanced capture with window filtering" in Zoom Settings \u2192 Share Screen for best invisibility.',
      });
    }
  });
}

function registerGlobalShortcuts() {
  // Toggle visibility
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.showInactive();
      applyContentProtection();
    }
  });

  // Toggle click-through (fully undetectable — no cursor change, no interaction)
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    clickThrough = !clickThrough;
    console.log('[InviNotes] Click-through toggled:', clickThrough);
    if (clickThrough) {
      mainWindow.setIgnoreMouseEvents(true);
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }
    mainWindow.webContents.send('click-through-changed', clickThrough);
  });

  // Move window — Ctrl+Option+Arrows (safe on macOS, no system conflicts)
  globalShortcut.register('Control+Alt+Left', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x - MOVE_STEP, y);
  });
  globalShortcut.register('Control+Alt+Right', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + MOVE_STEP, y);
  });
  globalShortcut.register('Control+Alt+Up', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x, y - MOVE_STEP);
  });
  globalShortcut.register('Control+Alt+Down', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x, y + MOVE_STEP);
  });

  // Resize window
  globalShortcut.register('CommandOrControl+Shift+=', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [w, h] = mainWindow.getSize();
    mainWindow.setSize(w + RESIZE_STEP, h + RESIZE_STEP);
  });
  globalShortcut.register('CommandOrControl+Shift+-', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [w, h] = mainWindow.getSize();
    mainWindow.setSize(
      Math.max(MIN_SIZE.width, w - RESIZE_STEP),
      Math.max(MIN_SIZE.height, h - RESIZE_STEP)
    );
  });

  // Opacity up / down
  globalShortcut.register('CommandOrControl+Shift+]', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const current = mainWindow.getOpacity();
    const next = Math.min(1, current + OPACITY_STEP);
    mainWindow.setOpacity(next);
    mainWindow.webContents.send('opacity-changed', Math.round(next * 100));
  });
  globalShortcut.register('CommandOrControl+Shift+[', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const current = mainWindow.getOpacity();
    const next = Math.max(0.1, current - OPACITY_STEP);
    mainWindow.setOpacity(next);
    mainWindow.webContents.send('opacity-changed', Math.round(next * 100));
  });

  // Snap window (Ctrl+Option+Shift — no macOS conflicts)
  // Arrows point toward the corner direction
  globalShortcut.register('Control+Alt+Shift+Up', () => snapToCorner('top-left'));
  globalShortcut.register('Control+Alt+Shift+Right', () => snapToCorner('top-right'));
  globalShortcut.register('Control+Alt+Shift+Down', () => snapToCorner('bottom-right'));
  globalShortcut.register('Control+Alt+Shift+Left', () => snapToCorner('bottom-left'));
  globalShortcut.register('Control+Alt+Shift+C', () => snapToCorner('center'));
}

function snapToCorner(position) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const { x, y, width, height } = display.workArea;
  const [w, h] = mainWindow.getSize();
  const pad = 20;

  switch (position) {
    case 'top-left':     mainWindow.setPosition(x + pad, y + pad); break;
    case 'top-right':    mainWindow.setPosition(x + width - w - pad, y + pad); break;
    case 'bottom-left':  mainWindow.setPosition(x + pad, y + height - h - pad); break;
    case 'bottom-right': mainWindow.setPosition(x + width - w - pad, y + height - h - pad); break;
    case 'center':       mainWindow.setPosition(x + Math.round((width - w) / 2), y + Math.round((height - h) / 2)); break;
  }
}

// ── Deep Link Protocol ──
app.setAsDefaultProtocolClient('invinotes');

// macOS: handle open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  const roomId = url.replace('invinotes://join/', '');
  if (roomId) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('join-room', roomId);
      if (!mainWindow.isVisible()) {
        mainWindow.showInactive();
        applyContentProtection();
      }
    } else {
      pendingDeepLink = roomId;
    }
  }
});

// Windows: handle second-instance with deep link args
// Skip single-instance lock when --multi is passed (for local collab testing)
const allowMulti = process.argv.includes('--multi');
const gotTheLock = allowMulti ? true : app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else if (!allowMulti) {
  app.on('second-instance', (_event, argv) => {
    // On Windows, the deep link URL is in argv
    const deepLink = argv.find(arg => arg.startsWith('invinotes://'));
    if (deepLink) {
      const roomId = deepLink.replace('invinotes://join/', '');
      if (roomId && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('join-room', roomId);
        if (!mainWindow.isVisible()) {
          mainWindow.showInactive();
          applyContentProtection();
        }
      }
    }
    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── IPC Handlers ──
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('set-opacity', (_event, value) => {
  if (mainWindow && typeof value === 'number') {
    mainWindow.setOpacity(Math.max(0.1, Math.min(1, value)));
  }
});

// Dynamic click-through (kept for future use, e.g. hover-to-interact)
ipcMain.on('set-ignore-mouse-events', (_event, ignore, options) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(ignore, options);
  }
});

// ── Auto-Updater IPC ──
ipcMain.on('restart-for-update', () => {
  autoUpdater.quitAndInstall();
});

// ── App Lifecycle ──
app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, '..', '..', 'assets', 'icon.png'));
  }

  createWindow();
  registerGlobalShortcuts();

  // Check for updates in packaged builds
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-downloaded', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-ready');
      }
    });
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
