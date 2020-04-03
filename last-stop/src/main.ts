// main.ts
//   App class Main.

import { View } from "./view";
import { Model } from "./model";
import { Languages } from "./language";
import { ipcMain } from 'electron';

export class Main {
    languages: Languages;
    view: View;
    model: Model;

    constructor() {
        this.registerCallbacks();

        this.languages = new Languages();
        // console.log(languages.tokenize("print(\"this is 3.4\\t\\n\");", ["basic"], new Position(2, 20), false));

        // store.set([], Store.normalize(languages.contexts));
        // store.set(['basic', 'blah'], Store.normalize(new Date()));
        // store.set(['basic', 'foo'], Store.normalize((x: number) => x + 2));
        // console.log(store.get([]));

        this.model = new Model(this);
        this.view = new View(this);
    }

    registerCallbacks() {
        ipcMain.on("resize", (event, info) => {
            const window = this.view.getWindow(info.id);
            if (window !== null) {
                window.onResize(info.lines, info.columns);
            }
        });

        ipcMain.on("mouse", (event, info) => {
            const window = this.view.getWindow(info.id);
            if (window !== null) {
                if (info.type === "down") {
                    window.onMouseDown(info.row, info.column, info.button);
                }
                else if (info.type === "up") {
                    window.onMouseUp(info.row, info.column, info.button);
                }
            }
        });

        ipcMain.on("key", (event, info) => {
            const window = this.view.getWindow(info.id);
            if (window !== null) {
                if (info.type === "down") {
                    window.onKeyDown(info.key, info.modifiers);
                }
                else if (info.type === "up") {
                    window.onKeyUp(info.key, info.modifiers);
                }
            }
        });

        ipcMain.on("ready", (event, info) => {
            const window = this.view.getWindow(info.id);
            if (window !== null) {
                window.onReady();
            }
        })
    }
}