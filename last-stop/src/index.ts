// index.ts
//   Main server-side entry point.

import { app, BrowserWindow, ipcMain, WebContents, ipcRenderer } from 'electron';
import { getRGB, DrawableText, Position } from "./shared";
import { Languages } from "./language";
import { StoreData, Store } from "./store";

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
        this.lines = lines;
        this.columns = columns;

        console.log("Window id " + this.id + " resized to [" + this.lines + ", " + this.columns + "]");

        this.doUpdate();
    }

    onReady() {
        console.log("Window id " + this.id + " is ready UwU OwO >w<");
        this.isReady = true;

        this.doUpdate();
    }

    doUpdate() {
        if (this.isReady) {
            let text = [];
            for (let r = 0; r < this.lines; r++) {
                for (let c = 0; c < this.columns; c += 4) {
                    text.push(new DrawableText("" + Math.floor(999 * Math.random()), r, c, 
                        getRGB(Math.floor(250 * Math.random()), Math.floor(250 * Math.random()), Math.floor(250 * Math.random())), 
                        (Math.random() < 0.1 ? getRGB(20, 70, 130) : null)));
                }
            }
            this.window.webContents.send("update", {
                subscription: "random",
                text: text,
                lines: this.lines,
                columns: this.columns            
            });
        }
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
            console.log(info);
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



let languages = new Languages();
console.log(languages.tokenize("print(\"this is 3.4\\t\\n\");", ["basic"], new Position(2, 20), false));



let store = new Store();

store.set([], Store.normalize(languages.contexts));
store.set(['basic', 'blah'], Store.normalize(new Date()));
store.set(['basic', 'foo'], Store.normalize((x: number) => x + 2));
console.log(store.get([]));


// console.log(store.set([], ["a", "b", "c"]));
// console.log(store.get([]));

// console.log(store.insertList([], 0, [14, 17]));
// console.log(store.get([]));

// console.log(store.removeList([], 4, 1));
// console.log(store.get([]));
 
// store.checkpoint();

// console.log(store.set([1], new Map([["b", 1], ["d", 3], ["a", 7]])));
// console.log(store.get([]));

// console.log(store.changeKey([1], "b", "d"));
// console.log(store.get([]));

// console.log(store.clear([1, "b"]));
// console.log(store.get([]));

// console.log(store.clear([1, "d"]));
// console.log(store.get([]));

// console.log(store.changeKey([1], "a", "f"));
// console.log(store.get([]));

// console.log(store.undoUntilIndex(0));
// console.log(store.get([]));

// console.log(store.redoAll());
// console.log(store.get([]));

 
