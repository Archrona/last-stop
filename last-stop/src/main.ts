// main.ts
//   App class Main.

import { View } from "./view";
import { Model } from "./model";
import { Languages } from "./language";
import { ipcMain } from 'electron';
import { listsContainSameElements, Position } from "./shared";
import { ConsoleServer } from "./console_server";
import { Commands } from "./commands";

export class Main {
    headless: boolean;
    languages: Languages;
    view: View;
    model: Model;
    consoleServer: ConsoleServer;
    commands: Commands;
 
    constructor(headless: boolean = false) {
        this.headless = headless;

        if (!headless)
            this.registerCallbacks();

        this.languages = new Languages();
        this.commands = new Commands(this);
  
        this.model = new Model(this);

        if (!headless) {
            this.view = new View(this);

            let doc = this.model.documents.add("scratchpad", "basic");
            doc.insert(0, "Hello world!\n\nThis is a test\nOf the emergency broadcasting system :D");
            doc.setCursor(0, new Position(0, 2));
            doc.setMark(0, new Position(2, 5));

            this.model.subscriptions.set(11, "doc@scratchpad@0");
            this.model.setActiveWindow(11);

            
        }

        if (!headless)
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