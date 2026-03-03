const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let desktopLyricWindow = null;

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });

  // 开发环境下打开开发者工具
  // mainWindow.webContents.openDevTools();
}

// 创建桌面歌词窗口
function createDesktopLyricWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  desktopLyricWindow = new BrowserWindow({
    width: 800,
    height: 150,
    x: Math.floor((width - 800) / 2),
    y: height - 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  desktopLyricWindow.loadFile('desktop-lyric.html');

  // 默认开启鼠标穿透
  desktopLyricWindow.setIgnoreMouseEvents(true, { forward: true });

  desktopLyricWindow.on('closed', () => {
    desktopLyricWindow = null;
  });

  // 开发环境下可打开调试
  // desktopLyricWindow.webContents.openDevTools({ mode: 'detach' });
}

// IPC 通信：窗口控制
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// 桌面歌词控制
ipcMain.on('toggle-desktop-lyric', (event, show) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    show ? desktopLyricWindow.show() : desktopLyricWindow.hide();
  }
});

ipcMain.on('update-desktop-lyric', (event, data) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    desktopLyricWindow.webContents.send('lyric-update', data);
  }
});

// 动态锁定/解锁鼠标穿透
ipcMain.on('lock-desktop-lyric', (event, locked) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    // locked = true 表示锁定（鼠标穿透），false 表示解锁（可交互）
    desktopLyricWindow.setIgnoreMouseEvents(locked, { forward: true });
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createDesktopLyricWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createDesktopLyricWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});