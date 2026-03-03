const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // 窗口状态监听
  onMaximize: (callback) => {
    ipcRenderer.on('window-maximized', (event, isMaximized) => callback(isMaximized));
  },

  // 桌面歌词功能
  toggleDesktopLyric: (show) => ipcRenderer.send('toggle-desktop-lyric', show),
  updateDesktopLyric: (data) => ipcRenderer.send('update-desktop-lyric', data),
  lockDesktopLyric: (locked) => ipcRenderer.send('lock-desktop-lyric', locked),

  // 监听歌词更新
  onLyricUpdate: (callback) => {
    ipcRenderer.on('lyric-update', (event, data) => callback(data));
  }
});