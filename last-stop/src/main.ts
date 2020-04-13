// main.ts
//   App class Main.

import { View } from "./view";
import { Model } from "./model";
import { Languages } from "./language";
import { ipcMain } from 'electron';
import { listsContainSameElements, InputMode } from "./shared";
import { ConsoleServer } from "./console_server";
import { Commands } from "./commands";


export class Main {
    languages: Languages;
    view: View;
    model: Model;
    consoleServer: ConsoleServer;
    mode: InputMode;
    commands: Commands;
 
    constructor() {
        this.registerCallbacks();

        this.mode = InputMode.Speech;
        this.languages = new Languages();

        this.commands = new Commands(this);

        this.model = new Model(this);
        this.view = new View(this);
        
        this.consoleServer = new ConsoleServer(this);
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

    handleGlobalHotkeys(windowId: number, key: string, modifiers: Array<string>) {
        if (key === "w" && listsContainSameElements(modifiers, ["control"])) {
            this.view.createWindow();
            return true;
        }
        
        return false;
    }
}