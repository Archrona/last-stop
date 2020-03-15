import { app, BrowserWindow } from 'electron';
declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        height: 600,
        width: 800,
    });

    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    const mainWindow2 = new BrowserWindow({
        height: 600,
        width: 800,
    });

    mainWindow2.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    //mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    app.quit();
});
