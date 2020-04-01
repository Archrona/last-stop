// main.ts
//   App class Main.

import { View } from "./view";
import { Model } from "./model";
import { Languages } from "./language";
import { Store } from "./store";
import { ipcMain } from 'electron';
import { Position } from "./shared";

export class Main {
    view: View;
    model: Model;

    constructor() {
        this.registerCallbacks();

        this.model = new Model(this);
        this.view = new View(this);

        let languages = new Languages();
        console.log(languages.tokenize("print(\"this is 3.4\\t\\n\");", ["basic"], new Position(2, 20), false));

        let store = new Store();

        store.set([], Store.normalize(languages.contexts));
        store.set(['basic', 'blah'], Store.normalize(new Date()));
        store.set(['basic', 'foo'], Store.normalize((x: number) => x + 2));
        console.log(store.get([]));

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