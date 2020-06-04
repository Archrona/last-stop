import { Speech } from "./speech";
import { Main } from "./main";
import { replaceAll, INSERTION_POINT } from "./shared";
import { clipboard } from "electron";


export class Controller {
    
    app: Main;
    lastSpeech: Speech | null;

    constructor(app: Main) {
        this.app = app;
        this.lastSpeech = null;
    }

    onConsoleSpeech(text: string) {
        const t0 = process.hrtime.bigint();

        let description = "Speech: " + this.app.model.store.getUndoCount();
        if (this.lastSpeech !== null) {
            this.lastSpeech.undo();
        }

        // let t1 = process.hrtime.bigint();

        description += " -> " + this.app.model.store.getUndoCount();
        this.lastSpeech = Speech.execute(this.app, text);

        // let t2 = process.hrtime.bigint();

        this.app.view.updateAllWindows();
        
        const t3 = process.hrtime.bigint();

        description += " -> " + this.app.model.store.getUndoCount();

        const totalElapsed = Number(t3 - t0) / 1000000;
        description += `   (${totalElapsed.toPrecision(3)} ms)`;
        description += `  (${Math.round(process.memoryUsage().rss / 1000000)} MB)`;

        console.log(description);
    }

    onConsoleCopyAndErase() {
        const doc = this.app.model.getActiveDocument();

        if (doc === null) {
            return;
        }

        let text = doc[0].getText();
        text = replaceAll(text, INSERTION_POINT, "");

        clipboard.writeText(text);
    }

    onConsoleCommitChanges() {
        this.lastSpeech = null;
    }



    onRendererResize(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            window.onResize(info.lines, info.columns);
        }
    }

    onRendererMouseClick(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            if (info.type === "down") {
                window.onMouseDown(info.row, info.column, info.button);
            }
            else if (info.type === "up") {
                window.onMouseUp(info.row, info.column, info.button);
            }
        }
    }

    onRendererKey(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            if (info.type === "down") {
                window.onKeyDown(info.key, info.modifiers);
            }
            else if (info.type === "up") {
                window.onKeyUp(info.key, info.modifiers);
            }
        }
    }

    onRendererReady(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            window.onReady();
        }
    }

    onRendererScroll(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            window.onScroll(info.x, info.y);
        }
    }
}