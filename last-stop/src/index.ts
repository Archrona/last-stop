// index.ts
//   Main server-side entry point.

import { app, BrowserWindow, ipcMain, WebContents, ipcRenderer } from 'electron';
import { Color, DrawableText } from "./shared";

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}


class Model {
    app: Main;
    
    constructor(app: Main) {
        this.app = app;
    }
}

class Window {
    view: View;
    id: number;
    window: BrowserWindow;
    lines: number;
    columns: number;
    subscription: string;
    isReady: boolean;

    constructor(view: View, id: number) {
        this.view = view;
        this.id = id;
        this.lines = 0;
        this.columns = 0;
        this.subscription = "none";
        this.isReady = false;

        this.window = new BrowserWindow({
            height: 900,
            width: 600,
            webPreferences: {
                nodeIntegration: true
            }
        });

        this.window.on("close", (event) => {
            console.log("Window id " + this.id + " closed!");
            view.windowClosed(this.id);
        });

        this.window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).then((success) => {
            console.log("Window id " + this.id + " loaded!");
            this.window.webContents.send("setId", this.id);
        }, (error) => {
            console.log("Window id " + this.id + " COULD NOT LOAD");
        });
    }

    onResize(lines: number, columns: number) {
        console.log("Window id " + this.id + " resized to [" + this.lines + ", " + this.columns + "]");

        this.lines = lines;
        this.columns = columns;

        this.doUpdate();
    }

    onReady() {
        console.log("Window id " + this.id + " is ready UwU OwO >w<");
        this.isReady = true;

        this.doUpdate();
    }

    doUpdate() {
        this.window.webContents.send("update", {
            subscription: "random",
            text: [], 
            lines: this.lines,
            columns: this.columns            
        });
    }
}

class View {
    app: Main;
    windows: Array<Window>;
    nextWindowId: number;

    constructor(app: Main) {
        this.app = app;
        this.windows = [];
        this.nextWindowId = 11;

        this.createWindow();
        this.createWindow();
    }

    createWindow() {
        const id = this.nextWindowId;
        this.nextWindowId++;
        
        this.windows.push(new Window(this, id));
        return id;
    }

    windowClosed(id: number) {
        this.windows = this.windows.filter(w => w.id !== id);
        console.log("Remaining window IDs: " + this.windows.map(x => x.id));
    }

    getWindow(id: number) {
        for (const w of this.windows) {
            if (w.id === id) {
                return w;
            }
        }
        return null;
    }
}


class Main {
    view: View;
    model: Model;

    constructor() {
        this.registerCallbacks();

        this.model = new Model(this);
        this.view = new View(this);
    }

    registerCallbacks() {
        ipcMain.on("resize", (event, info) => {
            this.view.getWindow(info.id).onResize(info.lines, info.columns);
        });

        ipcMain.on("ready", (event, info) => {
            this.view.getWindow(info.id).onReady();
        })
    }
}


app.on('ready', () => {
    new Main();
});

app.on('window-all-closed', () => {
    app.quit();
});
