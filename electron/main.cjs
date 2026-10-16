/**
 * DCATS — Electron main process.
 * Dev:    npm run electron:dev   (expects `npm run dev` running, loads localhost:5173)
 * Packaged: serves dist/ over the internal app:// scheme (electron/protocol.cjs)
 *           so in-browser ONNX inference works in the desktop build too.
 */
const { app, BrowserWindow, shell, Menu, screen } = require('electron');
const { registerAppProtocolHandler, APP_URL } = require('./protocol.cjs');

const isDev = !app.isPackaged && process.env.ELECTRON_DEV === '1';

function createWindow() {
  // Fit the console to the usable desktop instead of assuming a 1500×950
  // display. On a 1536×864 DIP work area (common at 125% scaling) the old
  // fixed size clipped the nav and bottom of the console.
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1500, Math.max(960, workWidth - 48));
  const height = Math.min(950, Math.max(640, workHeight - 48));

  const win = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(1100, width),
    minHeight: Math.min(720, height),
    center: true,
    show: false,
    backgroundColor: '#F2F4F7',
    autoHideMenuBar: true,
    title: 'DCATS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // External links open in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // F12 / Ctrl+Shift+I toggle devtools even with the menu hidden.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const toggleDevTools =
      input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i');
    if (toggleDevTools) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    registerAppProtocolHandler();
    win.loadURL(APP_URL);
  }

  return win;
}

// Single instance — focus the existing window instead of opening a second one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
