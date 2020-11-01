import { Speech } from "./speech";
import { Main } from "./main";
import { replaceAll, INSERTION_POINT, Position } from "./shared";
import { clipboard } from "electron";
import { SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY } from "./console_server";
import { inspect } from "util";
import { DocumentSubscription, Model } from "./model";
import { LEFT_MARGIN_COLUMNS } from "./subscription";

class PendingMouseEvent {
    targetRow: number;
    targetColumn: number;
    drag: boolean;

    constructor(public windowId: number, public button: number, public row: number, public column: number) {
        this.targetRow = row;
        this.targetColumn = column;
        this.drag = false;
    }
}

export class Controller {
    
    app: Main;
    lastSpeech: Speech | null;
    inputMode: string;
    pendingMouse: PendingMouseEvent | null;

    constructor(app: Main) {
        this.app = app;
        this.lastSpeech = null;
        this.pendingMouse = null;
        
        console.log("Controller: Initial mode RAW.");
        this.inputMode = "raw";
    }

    setInputModeSpeech() {
        console.log("Controller: Trying to set mode SPEECH...");
        this.app.consoleServer.postRequest("setInputMode", {
            "mode": "speech"
        }, () => {
            console.log("Controller: Set mode SPEECH.");
            this.inputMode = "speech";
            this.app.view.updateAllWindows();
        });
    }

    setInputModeRaw() {
        console.log("Controller: Trying to set mode RAW...");
        this.app.consoleServer.postRequest("setInputMode", {
            "mode": "raw"
        }, () => {
            console.log("Controller: Set mode RAW.");
            this.commit();
            this.inputMode = "raw";
            this.app.view.updateAllWindows();
        });
    }

    onConsoleRequestSpeechMode() {
        console.log("Controller: Console requests SPEECH mode...");
        this.setInputModeSpeech();
    }

    onConsoleIntroduce() {
        console.log("Controller: Console introduces itself.");
        this.setInputModeRaw();
    }

    commit() {
        this.lastSpeech = null;
    }

    onConsoleSpeech(text: string) {
        if (this.inputMode !== "speech") {
            console.log("ERROR: console speech received in non-speech mode. text: " + text);
            return;
        }

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

        // if (this.lastSpeech.shouldFocusConsole) {
        //     this.app.consoleServer.focus();
        // }
        // if (this.lastSpeech.shouldDoCommit) {
        //     console.log("          ... DID COMMIT");
        //     this.lastSpeech = null;
        // }
        // else if (this.lastSpeech.shouldForceCommit) {
        //     console.log("          ... forced commit msg sending to SC");
        //     this.consoleCommitRequest();
        // }

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
        // const doc = this.app.model.getActiveDocument();

        // if (doc === null) {
        //     return;
        // }

        // let text = doc[0].getText();
        // text = replaceAll(text, INSERTION_POINT, "");

        // clipboard.writeText(text);
    }

    onConsoleExit() {
        console.log("Controller: Console exited. Force switch to raw mode and commit");

        this.lastSpeech = null; // no need to synchronize; the console is gone
        this.inputMode = "raw";
        this.app.view.updateAllWindows();

        setTimeout(() => {
            console.log("Controller: Respawning console process.");
            this.app.consoleServer.spawnConsoleProcess();
        }, SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY);
    }

    onReloadData() {
        this.app.reloadData();
    }

    // consoleCommitRequest() {
    //     this.app.consoleServer.requestCommit();
    // }

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
        if (window === null) return;

        if (this.app.controller.inputMode !== "raw") {
            if (info.type === "up") {
                this.app.controller.setInputModeRaw();
            }
            return;
        }
       
        switch (info.type) {
            case "down":
                this.pendingMouse = new PendingMouseEvent(window.id, info.button, info.row, info.column)
                break;

            case "up":
                if (this.pendingMouse !== null 
                    && this.pendingMouse.windowId === window.id
                    && this.pendingMouse.button === info.button
                    && this.pendingMouse.row === info.row
                    && this.pendingMouse.column === info.column
                    && this.pendingMouse.drag === false
                ) {
                    this.processClick(this.pendingMouse);
                }

                this.pendingMouse = null;
                break;

            case "move":
                if (this.pendingMouse !== null
                    && this.pendingMouse.windowId === window.id
                ) {
                    if (info.buttons.includes(this.pendingMouse.button)) {
                        if (!this.pendingMouse.drag) {
                            if (this.pendingMouse.row !== info.row || this.pendingMouse.column !== info.column) {
                                this.pendingMouse.drag = true;
                            }
                        }

                        if (this.pendingMouse.drag) {
                            if (this.pendingMouse.targetRow !== info.row || this.pendingMouse.targetColumn !== info.column) {
                                this.pendingMouse.targetRow = info.row;
                                this.pendingMouse.targetColumn = info.column;
                                this.processDragUpdate(this.pendingMouse);
                            }

                            return;
                        }
                    }
                } 
                else {
                    this.pendingMouse = null;
                }

                break;
        }
    }

    processClick(event: PendingMouseEvent) {
        const model = this.app.model;
        const window = this.app.view.getWindow(event.windowId);
        model.setActiveWindow(window.id);

        const sub = this.app.model.subscriptions.getDetails(window.id);

        if (sub instanceof DocumentSubscription && model.documents.hasKey(sub.document)) {
            const doc = model.documents.get(sub.document);
            const view = doc.getView(sub.anchorIndex);

            const pos = new Position(
                event.row + view.row,
                event.column - LEFT_MARGIN_COLUMNS + view.column
            ).normalize(doc);
            
            if (event.button === 0 || event.button === 2) {
                doc.setCursor(sub.anchorIndex, pos);
                doc.setMark(sub.anchorIndex, pos);
            }

            if (event.button === 2) {
                // TODO
                // result.focusSpeechConsole = true;
                // result.requestCommit = true;
                doc.absorbAdjacentInsertionPoints(sub.anchorIndex);
            }

            this.app.view.updateAllWindows();
        }
    }

    processDragUpdate(event: PendingMouseEvent) {
        const model = this.app.model;
        const window = this.app.view.getWindow(event.windowId);
        model.setActiveWindow(window.id);

        const sub = this.app.model.subscriptions.getDetails(window.id);

        if (sub instanceof DocumentSubscription && model.documents.hasKey(sub.document)) {
            const doc = model.documents.get(sub.document);
            const view = doc.getView(sub.anchorIndex);

            const p1 = new Position(
                event.row + view.row,
                event.column - LEFT_MARGIN_COLUMNS + view.column
            ).normalize(doc);

            const p2 = new Position(
                event.targetRow + view.row,
                event.targetColumn - LEFT_MARGIN_COLUMNS + view.column
            ).normalize(doc);
            
            doc.setCursor(sub.anchorIndex, p2);
            doc.setMark(sub.anchorIndex, p1);

            this.app.view.updateAllWindows();
        }
    }
    
    onRendererKey(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window === null) return;

        const sub = this.app.model.subscriptions.getDetails(window.id);

        if (this.app.controller.inputMode !== "raw") return;

        let key = info.key as string;
        if (info.modifiers.includes("alt")) key = "M-" + key;
        if (info.modifiers.includes("control")) key = "C-" + key;

        switch (info.type) {
            case "down":
                this.processKey(window.id, key);
                break;

            case "up":
                // do nothing
                break;
        }
    }

    processKey(windowId: number, key: string) {
        const model = this.app.model;
        model.setActiveWindow(windowId);

        const sub = model.subscriptions.getDetails(windowId);

        if (sub instanceof DocumentSubscription && model.documents.hasKey(sub.document)) {
            const doc = model.documents.get(sub.document);
            let context = doc.getCursorContext(sub.anchorIndex, model.app.languages);
            let autoIndent = model.app.languages.contexts.get(context).triggerAutomaticIndentation;

            if (key.length === 1) {
                doc.insert(sub.anchorIndex, key);
            } else {
                doc.osKey(sub.anchorIndex, key);
            }

            if (autoIndent !== undefined && autoIndent.includes(key)) {
                doc.automaticallyIndentSelection(sub.anchorIndex);
            }

            this.app.view.updateAllWindows();
        }
    }

    onRendererReady(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window === null) return;

        window.onReady();
    }

    onRendererScroll(info: any) {
        const window = this.app.view.getWindow(info.id);
        if (window === null) return;

        if (this.app.controller.inputMode !== "raw") return;

        const model = this.app.model;
        const sub = model.subscriptions.getDetails(window.id);
        
        if (sub instanceof DocumentSubscription && model.documents.hasKey(sub.document)) {
            const doc = model.documents.get(sub.document);
            const view = doc.getView(sub.anchorIndex);
            
            //view.column = Math.max(0, view.column + x);
            view.row = Math.max(-20, Math.min(doc.getLineCount() + 40, view.row + Math.floor(info.y * 0.5)));
            doc.setView(sub.anchorIndex, view);

            this.app.view.updateAllWindows();
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
}