// view.ts
//   Windows and the overall View.

import { BrowserWindow } from 'electron';
import { getRGB, DrawableText } from "./shared";
import { Main } from "./main";

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

export class Window {
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

export class View {
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