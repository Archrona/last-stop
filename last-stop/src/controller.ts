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
        const initialUndo = this.app.model.store.getUndoCount();
        let minUndo = initialUndo;
        let elapsed = 0.0;

        if (this.lastSpeech === null) {
            const timeStart = process.hrtime.bigint();
            this.lastSpeech = Speech.execute(this.app, text);
            const timeEnd = process.hrtime.bigint();
            elapsed = Number(timeEnd - timeStart) / 1000000;
        } else {
            const result = this.lastSpeech.reviseSpeech(text);
            minUndo = result.undidUntil;
            elapsed = result.elapsed;
        }

        this.app.view.updateAllWindows();
        
        const finalUndo = this.app.model.store.getUndoCount();
        const time = elapsed.toPrecision(3);
        const mem = Math.round(process.memoryUsage().rss / 1000000)
        console.log(`  Speech: ${initialUndo} -> ${minUndo} -> ${finalUndo}  (${time} ms)  (${mem} MB)`);
    }

    onConsoleReprocessSpeech() {
        if (this.lastSpeech !== null) {
            const text = this.lastSpeech.speech;
            this.lastSpeech.undo();
            this.lastSpeech = Speech.execute(this.app, text);
        }

        this.app.view.updateAllWindows();
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

    onReloadData() {
        this.app.reloadData();
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