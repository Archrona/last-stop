// view.ts
//   Windows and the overall View.

import { BrowserWindow } from 'electron';
import { getRGB, DrawableText } from "./shared";
import { Main } from "./main";
import { renderSubscription } from "./subscription";

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

const THEME = {
    window_speech_mode_accent: getRGB(0, 191, 255),
    window_direct_mode_accent: getRGB(255, 102, 153),
    window_line_number: getRGB(120, 120, 120),
    error: getRGB(255, 0, 0),
    overflow_indicator: getRGB(255, 255, 0),

    token_0: getRGB(128, 0, 0),
    token_5: getRGB(0, 128, 0),

    anchor_cursor: getRGB(255, 60, 255),
    anchor_mark: getRGB(255, 60, 150), 
    selection: getRGB(20, 40, 80),
 
    accent_keyword: getRGB(255, 150, 190),
    keyword: getRGB(128, 128, 255),
    type_identifier: getRGB(80, 220, 200),
    identifier: getRGB(145, 210, 255),
    number: getRGB(255, 150, 75),
    punctuation: getRGB(255, 220, 210),
    grouping: getRGB(240, 240, 240),
    string_delimiter: getRGB(150, 220, 140),
    string_punctuation: getRGB(150, 220, 140),
    string_escape: getRGB(180, 180, 120),
    string_text: getRGB(150, 220, 140),
    comment: getRGB(20, 140, 20),
    regular_expression: getRGB(80, 180, 20),

    general: getRGB(240, 240, 240),
    background: getRGB(20, 20, 20),
    EOF: getRGB(60, 60, 60)
};

export class Window {
    view: View;
    app: Main;
    id: number;
    window: BrowserWindow;
    lines: number;
    columns: number;
    subscription: string;
    isReady: boolean;
    topRowNumber: number;

    constructor(view: View, id: number) {
        this.view = view;
        this.app = view.app;
        this.id = id;
        this.lines = 0;
        this.columns = 0;
        this.subscription = "none";
        this.isReady = false;
        this.topRowNumber = 999;
 
        this.window = new BrowserWindow({
            height: 1000,
            width: 700,
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
        this.view.recomputeTopRowNumbers();
 
        console.log("Window id " + this.id + " resized to [" + this.lines + ", " + this.columns + "]");

        this.doUpdate();
    }

    onMouseDown(row: number, column: number, button: number) {
        console.log("down " + row + ", " + column + " (" + button + ")");
    }  

    onMouseUp(row: number, column: number, button: number) {
        console.log("  up " + row + ", " + column + " (" + button + ")");
    }

    onKeyDown(key: string, modifiers: Array<string>) {
        if (this.view.app.handleGlobalHotkeys(this.id, key, modifiers)) {
            return;
        }
         
        console.log("down " + key + " " + modifiers);
    }
    
    onKeyUp(key: string, modifiers: Array<string>) {
        console.log("  up " + key + " " + modifiers);
    }
    
    onScroll(x: number, y: number): void {
        console.log(`scrl: ${x}, ${y}`);
    };
    
    onReady() {
        console.log("Window id " + this.id + " is ready UwU OwO >w<");
        this.isReady = true;

        this.doUpdate();
    }

    needsUpdate() {
        // TODO: don't immediately update, queue it
        this.doUpdate();
    }  

    doUpdate() {
        if (this.isReady) {
            let sub = "unknown_window";

            if (this.app.model.subscriptions.has(this.id)) {
                sub = this.app.model.subscriptions.get(this.id);
            }
            
            let text = renderSubscription(sub, this.topRowNumber, this.lines, this.columns, this.view.app);

            this.window.webContents.send("update", {
                subscription: sub,
                text: text,
                lines: this.lines,
                columns: this.columns,
                modeAccent: this.view.getModeAccent()  
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

    getModeAccent() {
        this.getColor("window_speech_mode_accent");
    } 

    getColor(name: string) {
        let color = THEME[name];
        if (color === undefined) {
            return THEME["general"];
        }
        return color;
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

        this.recomputeTopRowNumbers();
    }

    getWindow(id: number) {
        for (const w of this.windows) {
            if (w.id === id) {
                return w;
            }
        }
        return null;
    }

    getWindowFromLineNumber(index: number): Window | null {
        for (const window of this.windows) {
            if (index >= window.topRowNumber && index < window.topRowNumber + window.lines) {
                return window;
            }
        }
        
        return null;
    }

    maximumWindowId() {
        let highest = 0;
        for (const window of this.windows) {
            highest = Math.max(highest, window.id);
        }
        return highest;
    }

    recomputeTopRowNumbers() {
        const windows = this.windows.slice();
        windows.sort((first, second) => first.topRowNumber - second.topRowNumber);

        const max = this.maximumWindowId();
        let firstAvailableLine = Math.max(Math.floor(max / 10) * 10 + 10, 30);

        for (const window of windows) {
            if (window.topRowNumber < firstAvailableLine || window.topRowNumber >= firstAvailableLine + 50) {
                window.topRowNumber = firstAvailableLine;
                window.needsUpdate();
            }

            firstAvailableLine = Math.floor((window.topRowNumber + window.lines) / 10) * 10 + 20;
        }

    } 

    updateAllWindows(): void {
        for (const window of this.windows) {
            window.needsUpdate();
        }
    }
}