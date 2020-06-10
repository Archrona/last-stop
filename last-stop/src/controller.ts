import { Speech } from "./speech";
import { Main } from "./main";
import { replaceAll, INSERTION_POINT } from "./shared";
import { clipboard } from "electron";
import { SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY } from "./console_server";
import { inspect } from "util";

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

        const finalUndo = this.app.model.store.getUndoCount();
        const time = elapsed.toPrecision(3);
        const mem = Math.round(process.memoryUsage().rss / 1000000);
        console.log(`  Speech: ${initialUndo} -> ${minUndo} -> ${finalUndo}  (${time} ms)  (${mem} MB)`);

        if (this.lastSpeech.shouldFocusConsole) {
            this.focusConsole();
        }

        if (this.lastSpeech.shouldDoCommit) {
            console.log("          ... DID COMMIT");
            this.lastSpeech = null;
        }
        else if (this.lastSpeech.shouldForceCommit) {
            console.log("          ... forced commit msg sending to SC");
            this.consoleCommitRequest();
        }

        

        this.app.view.updateAllWindows();
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

    onConsoleExit() {
        this.lastSpeech = null; // no need to synchronize; the console is gone

        setTimeout(() => {
            this.app.consoleServer.spawnConsoleProcess();
        }, SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY);
    }

    onReloadData() {
        this.app.reloadData();
    }

    consoleCommitRequest() {
        this.app.consoleServer.requestCommit();
    }

    onRendererResize(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window !== null) {
            this.app.consoleServer.requestCommit(() => {
                window.onResize(info.lines, info.columns);
            });
        }
    }

    onRendererMouse(info: any) {
        const window = this.app.view.getWindow(info.id);

        if (window !== null) {
            if (info.type === "down") {
                window.onMouseDown(info.row, info.column, info.button);
            }
            else if (info.type === "up") {
                window.onMouseUp(info.row, info.column, info.button);
            }
            else if (info.type === "move") {
                window.onMouseMove(info.row, info.column, info.buttons);
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

    onRendererFocus(info: any) {
        const window = this.app.view.getWindow(info.id);
        const focused = info.focused as boolean;

        if (window !== null && focused) {
            if (this.app.model.getActiveWindow() !== window.id) {
                window.onSetActive();
            }
        }
    }

    onWindowClosed(windowId: number) {
        this.app.view.windows = this.app.view.windows.filter(w => w.id !== windowId);

        this.app.view.recomputeTopRowNumbers();

        if (this.app.view.windows.length > 0) {
            let nextId = this.app.view.windows[0].id;
            if (this.app.model.getActiveWindow() !== nextId) {
                this.app.view.getWindow(nextId).onSetActive();
            }
        }   
    }

    focusConsole() {
        this.app.consoleServer.focus();
    }
}