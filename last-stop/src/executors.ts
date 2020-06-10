import { Model, DocumentSubscription } from "./model";
import { SpokenSelection } from "./speech";
import { Position, replaceAll, INSERTION_POINT } from "./shared";
import { LEFT_MARGIN_COLUMNS } from "./subscription";
import { clipboard } from "electron";

export class ExecutorResult {
    forceCommit: boolean;
    doCommit: boolean;

    constructor(forceCommit = false, doCommit = false) { 
        this.forceCommit = forceCommit;
        this.doCommit = doCommit;
    }
}

export type Executor = (model: Model, args: Array<any>) => ExecutorResult

export const EXECUTORS = {
    nop: (model: Model, args: Array<any>) => {
        return new ExecutorResult();
    },

    step: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            let times = 1;
            if (args[0] !== undefined && /^[1-9]$/.test(args[0])) {
                times = parseInt(args[0]);
            }

            for (; times > 0; times--) {
                doc.step(ai);
            }
        });
        return new ExecutorResult();
    },

    stepAll: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.replaceAll(INSERTION_POINT, "");
        });
        return new ExecutorResult();
    },

    go: (model: Model, args: Array<any>) => {
        if (args.length > 0) {
            const location = args[0];

            if (location instanceof SpokenSelection) {
                location.document.setMark(location.anchorIndex, location.mark);
                location.document.setCursor(location.anchorIndex, location.cursor);
                
                model.activateDocumentWindow(location.document.getName(), location.anchorIndex);
            }

            // TODO other kinds of go reference - window, line, etc.
        }

        return new ExecutorResult();
    },

    insert: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0], {
                enforceSpacing: true,
                escapes: true,
                escapeArguments: ["+$1", "+$2", "+$3"]
            });
        });
        return new ExecutorResult();
    },

    insertExact: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0], { enforceSpacing: true });
        });
        return new ExecutorResult();
    },

    insertAtEOL: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.setSelectionEOL(ai, true);
            EXECUTORS.insert(model, args);
            doc.automaticallyIndentSelection(ai);
        });
        return new ExecutorResult();
    },

    onScroll: (model: Model, args: Array<any>) => {
        const sub = args[2];

        if (sub instanceof DocumentSubscription) {
            const x = parseInt(args[3]);
            const y = parseInt(args[4]);
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                const view = doc.getView(sub.anchorIndex);
                //view.column = Math.max(0, view.column + x);
                view.row = Math.max(-20, Math.min(doc.getLineCount() + 40, view.row + y));
                doc.setView(sub.anchorIndex, view);
            }
        }

        return new ExecutorResult();
    },

    onActivate: (model: Model, args: Array<any>) => {
        const windowId = args[0] as number;
        //console.log("activate " + windowId);
        model.setActiveWindow(windowId);

        return new ExecutorResult(true);
    },

    onMouse: (model: Model, args: Array<any>) => {
        const sub = args[1];
        const windowId = parseInt(args[0]);

        if (sub instanceof DocumentSubscription) {
            model.setActiveWindow(windowId);

            const windowRow = args[3];
            const windowCol = args[4];
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                const view = doc.getView(sub.anchorIndex);
                const pos = new Position(
                    windowRow + view.row,
                    windowCol - LEFT_MARGIN_COLUMNS + view.column
                ).normalize(doc);
                doc.setMark(sub.anchorIndex, pos);
                if (args[2] === 0) {
                    doc.setCursor(sub.anchorIndex, pos);
                }
            }
        }

        return new ExecutorResult();
    },

    onDrag: (model: Model, args: Array<any>) => {
        const sub = args[1];
        const windowId = parseInt(args[0]);

        if (sub instanceof DocumentSubscription) {
            model.setActiveWindow(windowId);

            const r1 = args[3], c1 = args[4], r2 = args[5], c2 = args[6];

            console.log(args);


        }

        return new ExecutorResult();
    },

    onKey: (model: Model, args: Array<any>) => {
        const sub = args[1];

        if (sub instanceof DocumentSubscription) {
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                let str = "";
                
                for (let i = 2; i < args.length; i++) {
                    const key = args[i];

                    if (typeof key === "string") {
                        let context = doc.getCursorContext(sub.anchorIndex, model.app.languages);
                        let autoIndent = 
                            model.app.languages.contexts.get(context).triggerAutomaticIndentation;

                        if (key.length === 1) {
                            str += key;
                        } else {
                            if (str.length > 0) {
                                doc.insert(sub.anchorIndex, str);
                                str = "";
                            }

                            doc.osKey(sub.anchorIndex, key);
                        }

                        if (autoIndent !== undefined && autoIndent.includes(key)) {
                            if (str.length > 0) {
                                doc.insert(sub.anchorIndex, str);
                                str = "";
                            }
                            doc.automaticallyIndentSelection(sub.anchorIndex);
                        }
                    }
                }
                
                if (str.length > 0)
                    doc.insert(sub.anchorIndex, str);
            }
        }

        return new ExecutorResult();
    },

    cut: (model: Model, arg: Array<any>) => {
        let result = new ExecutorResult();
        model.doActiveDocument((doc, ai) => {
            doc.osCut(ai);
            //result.forceCommit = true;
        });
        return result;
    },

    copy: (model: Model, arg: Array<any>) => {
        let result = new ExecutorResult();
        model.doActiveDocument((doc, ai) => {
            doc.osCopy(ai);
            //result.forceCommit = true;
        });
        return result;
    },

    paste: (model: Model, arg: Array<any>) => {
        let result = new ExecutorResult();
        model.doActiveDocument((doc, ai) => {
            doc.osPaste(ai);
            //result.forceCommit = true;
        });
        return result;
    },

    selectAll: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.selectAll(ai);
        });
        return new ExecutorResult();
    },

    selectAllAndCopy: (model: Model, arg: Array<any>) => {
        let result = new ExecutorResult();
        model.doActiveDocument((doc, ai) => {
            let t = doc.getText();
            clipboard.writeText(replaceAll(t, INSERTION_POINT, ""));
            //result.forceCommit = true;
        });
        return result;
    },

    selectAllAndCut: (model: Model, arg: Array<any>) => {
        let result = new ExecutorResult();
        model.doActiveDocument((doc, ai) => {
            let t = doc.getText();
            clipboard.writeText(replaceAll(t, INSERTION_POINT, ""));
            doc.selectAll(ai);
            doc.remove(ai);
            //result.forceCommit = true;
        });
        return result;
    },

    sponge: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            let targets = "lr";
            if (arg[0] !== undefined && typeof arg[0] === "string") {
                targets = arg[0];
            }

            if (targets.indexOf("l") !== -1) {
                doc.spongeBeforeSelection(ai);
            }

            if (targets.indexOf("r") !== -1) {
                doc.spongeAfterSelection(ai);
            }

            if (targets.indexOf("u") !== -1) {
                doc.spongeAboveSelection(ai);
            }   
            
            if (targets.indexOf("d") !== -1) {
                doc.spongeBelowSelection(ai);
            }  
        });

        return new ExecutorResult();
    },

    halo: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            let targets = "ud";
            if (arg[0] !== undefined && typeof arg[0] === "string") {
                targets = arg[0];
            }
            
            if (targets.indexOf("l") !== -1) {
                doc.haloBeforeSelection(ai);
            }
            if (targets.indexOf("r") !== -1) {
                doc.haloAfterSelection(ai);
            } 
            if (targets.indexOf("u") !== -1) {
                doc.haloAboveSelection(ai);
            } 
            if (targets.indexOf("d") !== -1) {
                doc.haloBelowSelection(ai);
            }
        });

        return new ExecutorResult();
    },

    onCommit: (model: Model, arg: Array<any>) => {
        return new ExecutorResult(false, true);
    },

    insertBetweenLines: (model: Model, arg: Array<any>) => {
        if (arg.length < 2) {
            return;
        }
        const above = arg[0] === "above";
        const location = arg[1];
        
        if (location instanceof SpokenSelection) {
            const targetRow = location.cursor.row + (above ? -1 : 0);
            location.document.insertAt("$n", 
                new Position(targetRow, Number.MAX_SAFE_INTEGER), { escapes: true }
            );
            location.document.setCursorAndMark(
                location.anchorIndex, new Position(targetRow + 1, Number.MAX_SAFE_INTEGER)
            );
            location.document.automaticallyIndentSelection(location.anchorIndex);
        }
        
        return new ExecutorResult();
    }
}