// main.ts
//   App class Main.

import { View } from "./view";
import { Model } from "./model";
import { Languages } from "./language";
import { ipcMain } from 'electron';
import { listsContainSameElements, Position } from "./shared";
import { ConsoleServer } from "./console_server";
import { Commands } from "./commands";
import { Controller } from "./controller";
import { Speech, ALPHABET, reloadSpeechData } from "./speech";

export class Main {
    headless: boolean;
    languages: Languages;
    view: View;
    model: Model;
    controller: Controller;
    consoleServer: ConsoleServer;
    commands: Commands;
 
    static app: Main = null;

    static getApp(): Main {
        return Main.app;
    }

    constructor(headless = false) {
        if (!headless) {
            if (Main.app !== null) {
                throw new Error("Cannot create more than one non-headless Main");
            }

            Main.app = this;
        }
        
        this.headless = headless;

        if (!headless)
            this.registerCallbacks();

        this.languages = new Languages();
        this.commands = new Commands(this);
  
        this.model = new Model(this);

        if (!headless) {
            this.view = new View(this);
            this.controller = new Controller(this);

            const doc = this.model.documents.add("test.py", "python");
            this.model.subscriptions.set(11, "doc@test.py@0");
            this.model.setActiveWindow(11);

            // let id = this.view.createWindow();
            // this.model.subscriptions.set(id, "doc@test.ts@1");
            // this.view.updateAllWindows();

            this.consoleServer = new ConsoleServer(this);
        }
    }

    registerCallbacks() {
        ipcMain.on("resize", (event, info) => this.controller.onRendererResize(info));
        ipcMain.on("mouse", (event, info) => this.controller.onRendererMouse(info));
        ipcMain.on("key", (event, info) => this.controller.onRendererKey(info));
        ipcMain.on("ready", (event, info) => this.controller.onRendererReady(info));
        ipcMain.on("scroll", (event, info) => this.controller.onRendererScroll(info));
    }

    handleGlobalHotkeys(windowId: number, key: string, modifiers: Array<string>) {
        if (key === "w" && listsContainSameElements(modifiers, ["control"])) {
            this.view.createWindow();
            return true;
        }
        
        return false;
    }

    reloadData() {
        console.log("Reloading all data files...");

        this.languages = null;
        this.commands = null;

        this.languages = new Languages();
        this.commands = new Commands(this);
        reloadSpeechData();
        this.controller.onConsoleReprocessSpeech();

        console.log("  -- Done!");
    }
}