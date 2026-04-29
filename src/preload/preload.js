const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inviNotes', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  // Events from main process
  onClickThroughChanged: (callback) => {
    ipcRenderer.on('click-through-changed', (_event, enabled) => callback(enabled));
  },

  // Deep link: main process forwards room ID when app is opened via invinotes://join/<roomId>
  onJoinRoom: (callback) => {
    ipcRenderer.on('join-room', (_event, roomId) => callback(roomId));
  },

  // Platform warnings and tips
  onPlatformWarning: (callback) => {
    ipcRenderer.on('platform-warning', (_event, data) => callback(data));
  },
  onPlatformTip: (callback) => {
    ipcRenderer.on('platform-tip', (_event, data) => callback(data));
  },

  // Auto-updater
  onUpdateReady: (callback) => {
    ipcRenderer.on('update-ready', () => callback());
  },
  restartForUpdate: () => ipcRenderer.send('restart-for-update'),
});
