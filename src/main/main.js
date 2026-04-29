const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');

app.setName('InviNotes');

let mainWindow;
let clickThrough = false;
let pendingDeepLink = null; // store deep link if window isn't ready yet

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
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.showInactive();
      applyContentProtection();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    clickThrough = !clickThrough;
    mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    mainWindow.webContents.send('click-through-changed', clickThrough);
  });
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
