// Preload script — runs in renderer context with Node access disabled.
// Expose only safe, explicit APIs to the renderer via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // Add future IPC calls here as needed, e.g.:
  // onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
});
