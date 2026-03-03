// SPDX-License-Identifier: MIT

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

  // 主窗口关闭时
  mainWindow.on('close', (e) => {
    console.log('Main window close event, isQuitting:', app.isQuitting);
    
    // 检查是否是真正的退出
    if (app.isQuitting) {
      console.log('App is quitting, allowing window to close');
      mainWindow = null;
      return;
    }
    
    // 否则阻止关闭并隐藏窗口
    e.preventDefault();
    console.log('Hiding main window');
    mainWindow.hide();
    checkAllWindowsClosed();
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
    checkAllWindowsClosed();
  });
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
    console.log('Desktop lyric window closed');
    desktopLyricWindow = null;
    checkAllWindowsClosed();
  });
}

// 检查所有窗口是否都已关闭
function checkAllWindowsClosed() {
  console.log('Checking if all windows are closed...');
  console.log(`mainWindow: ${mainWindow}, desktopLyricWindow: ${desktopLyricWindow}`);
  
  // 如果两个窗口都为 null，说明都已关闭，退出应用
  if (mainWindow === null && desktopLyricWindow === null) {
    console.log('All windows closed, quitting app');
    app.isQuitting = true;
    app.quit();
  }
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

// 修改这里：真正关闭窗口而不是隐藏
ipcMain.on('window-close', () => {
  console.log('IPC: window-close');
  
  // 检查桌面歌词窗口是否还存在
  const isDesktopLyricAlive = desktopLyricWindow && !desktopLyricWindow.isDestroyed();
  
  if (isDesktopLyricAlive) {
    // 如果桌面歌词窗口还在，先关闭它
    console.log('Closing desktop lyric window first');
    desktopLyricWindow.close();
  }
  
  // 然后关闭主窗口
  if (mainWindow) {
    console.log('Closing main window');
    app.isQuitting = true;
    mainWindow.close();
  }
});

// 应用退出
ipcMain.on('app-quit', () => {
  console.log('IPC: app-quit');
  app.isQuitting = true;
  app.quit();
});

// 桌面歌词控制
ipcMain.on('toggle-desktop-lyric', (event, show) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    if (show) {
      desktopLyricWindow.show();
    } else {
      console.log('Closing desktop lyric window');
      desktopLyricWindow.close(); // 真正关闭窗口
    }
  } else if (show) {
    createDesktopLyricWindow();
  }
});

ipcMain.on('update-desktop-lyric', (event, data) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    desktopLyricWindow.webContents.send('lyric-update', data);
  }
});

// 鼠标穿透控制
ipcMain.on('lock-desktop-lyric', (event, locked) => {
  if (desktopLyricWindow && !desktopLyricWindow.isDestroyed()) {
    desktopLyricWindow.setIgnoreMouseEvents(locked, { forward: true });
  }
});

// 应用事件
app.on('before-quit', () => {
  console.log('before-quit event');
  app.isQuitting = true;
});

app.on('will-quit', () => {
  console.log('will-quit event');
});

app.on('window-all-closed', () => {
  console.log('window-all-closed event');
  // 在 macOS 上，通常应用程序在关闭所有窗口后仍会保持运行
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

app.whenReady().then(() => {
  console.log('App is ready');
  createMainWindow();
  createDesktopLyricWindow();

  app.on('activate', () => {
    console.log('activate event');
    // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，重新创建窗口
    if (mainWindow === null) {
      createMainWindow();
    } else {
      mainWindow.show();
    }
    
    if (desktopLyricWindow === null) {
      createDesktopLyricWindow();
    }
  });
});

// 处理退出信号
process.on('SIGINT', () => {
  console.log('Received SIGINT');
  app.isQuitting = true;
  app.quit();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  app.isQuitting = true;
  app.quit();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.isQuitting = true;
  app.quit();
});