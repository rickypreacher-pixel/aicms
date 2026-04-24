const { app, BrowserWindow, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const url = require('url');

// ── Determine dev vs production ──────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';

let mainWindow = null;

function createWindow() {
  nativeTheme.themeSource = 'light';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'NTCC Church App',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // shown once ready-to-show fires
    backgroundColor: '#1a2e5a',
  });

  // ── Load app ───────────────────────────────────────────────────────────────
  if (isDev) {
    // Dev: load from Vite dev server
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '..', 'dist', 'index.html'),
        protocol: 'file:',
        slashes: true,
      })
    );
  }

  // Show window once fully loaded (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  buildMenu();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') app.quit();
});

// ── Handle Supabase auth deep links (password reset etc.) ────────────────────
app.on('open-url', (_event, deepLink) => {
  if (mainWindow && deepLink) {
    mainWindow.webContents.executeJavaScript(
      `window.location.hash = ${JSON.stringify(deepLink.split('#')[1] || '')}`
    );
  }
});

// ── Menu ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{ label: app.getName(), submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }]
      : []),
    {
      label: 'File',
      submenu: [process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About NTCC Church App',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'NTCC Church App',
              message: 'NTCC Church App',
              detail: `Version ${app.getVersion()}\nChurch Management Platform`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
