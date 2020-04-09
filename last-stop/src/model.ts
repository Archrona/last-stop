// model.ts
//   Overall data model for the app.

import { Main } from "./main";
import { Store, getType, DataTypes, StoreData } from "./store";
import { Position, splitIntoLines } from "./shared";
import { contentTracing } from "electron";
 
const STORE_INITIAL_STATE = {
    documents: {
        "scratchpad": {
            name: "scratchpad",
            modified: null,
            lines: [
                "aaaaa", "bbbbb", "ccccc", "ddddd"
                // "export class View {",
                // "    app: Main;",
                // "    windows: Array<Window>;",
                // "    nextWindowId: number;",
                // "",
                // "    constructor(app: Main) {",
                // "        this.app = app;",
                // "        this.windows = [];",
                // "        this.nextWindowId = 11;",
                // "",
                // "        this.createWindow();",
                // "    }",
                // "",
                // "    test() {",
                // "        let str = \"asd \\\"haha\\\" 3+4-5\";",
                // "        let multiLine = \"this is a test",
                // "            of the emergency broadcasting",
                // "            system!\";",
                // "    }",
                // "",
                // "    checkpoint(): number {",
                // "        this.undoStack.push(new DeltaPair(DeltaPairType.Checkpoint, (store) => true, (store) => true));",
                // "        return this.undoStack.length;",
                // "    }",
                // "}",
            ],
            anchors: [
                {
                    type: "cursor_0",
                    row: 1,
                    column: 1,
                    fixed: false
                },
                {
                    type: "mark_0",
                    row: 2,
                    column: 4,
                    fixed: false
                },
                {
                    type: "view_0",
                    row: 0,
                    column: 0,
                    fixed: true   
                },
            ],
            filename: null,
            baseContext: ["basic"]
        }  
    },
    subscriptions: {
        "11": "doc@scratchpad@0"
    },
    view: {
        activeWindow: "11"
    },
    project: {
        basePath: "c:\\last-stop\\"
    }
};



export class Model {
    app: Main;
    store: Store;

    constructor(app: Main) {
        this.app = app;
        this.store = new Store();

        this.store.setNormalized([], STORE_INITIAL_STATE);
        this.store.checkpoint();

        this.insert("scratchpad", "hello\nthere!!!", new Position(2, 1));
        console.log(this.getStandardAnchors("scratchpad", 0));
        console.log(this.getDocumentText("scratchpad"));
        
        this.store.undoUntilCheckpoint();
        console.log(this.getDocumentText("scratchpad"));
        this.store.redoAll();
        console.log(this.getDocumentText("scratchpad"));
        
    }

    getBaseContext(document: string): Array<string> | undefined {
        const context = this.store.get(["documents", document, "baseContext"]);
        if (context === undefined) {
            return undefined;
        }
        if (getType(context) !== DataTypes.Array) {
            throw "invalid base context in store: " + context.toString();
        }
        return context as Array<string>;
    }

    getSubscription(id: number) : string | undefined {
        const sub = this.store.get(["subscriptions", id.toString()]);
        if (sub === undefined) return undefined;
        return sub.toString();
    }
    
    getDocumentText(document: string) : Array<string> | undefined {
        const text = this.store.get(["documents", document, "lines"]);
        if (text === undefined) {
            return undefined;
        }
        
        return text as Array<string>;
    }  

    private normalizeUnchecked(lines: Array<string>, position: Position) {
        if (position.row < 0) {
            return new Position(0, 0);
        }
        if (position.row >= lines.length) {
            return new Position(lines.length - 1, lines[lines.length - 1].length);
        }
        if (position.column < 0) {
            return new Position(position.row, 0);
        }
        if (position.column > lines[position.row].length) {
            return new Position(position.row, lines[position.row].length);
        }
        return position;
    }

    getDocumentTextRange(document: string, left: Position, right: Position) {
        const text = this.getDocumentText(document);
        if (text === undefined) {
            return undefined;
        }
        
        if (left.compareTo(right) > 0) {
            const temporary = left;
            left = right;
            right = temporary;
        }
        
        let result = "";
        left = this.normalizeUnchecked(text, left);
        right = this.normalizeUnchecked(text, right);
        
        for (let line = left.row; line <= right.row; line++) {
            if (line > left.row) {
                result += "\n";
            }
             
            if (line === left.row && line === right.row) {
                result += text[line].substring(left.column, right.column);
            }
            else if (line === left.row) {
                result += text[line].substring(left.column);
            }
            else if (line === right.row) {
                result += text[line].substring(0, right.column);
            }
            else {
                result += text[line];
            }
        }
        
        return result;
    }  

    getStandardAnchors(document: string, anchorIndex: number) {
        const anchors = this.store.get(["documents", document, "anchors"]);
        if (anchors === undefined) {
            return undefined;
        }
        
        const result: Map<string, Position> = new Map();

        for (const anchor of anchors) {
            if (getType(anchor) !== DataTypes.Map) {
                continue;
            }
             
            const map = anchor as Map<string, StoreData>;
            const name = map.get("type").toString();

            if (name.endsWith("_" + anchorIndex)) {
                const row = map.get("row");
                if (getType(row) !== DataTypes.Number) throw "anchor in store has non-numeric row";

                const column = map.get("column");
                if (getType(column) !== DataTypes.Number) throw "anchor in store has non-numeric column";
                
                result.set(
                    name.substring(0, name.length - 2),
                    new Position(row as number, column as number)
                );
            }
        }
        
        return result;
    }

    insertUpdateAnchors(document: string, position: Position, lines: Array<string>) {
        const anchorsRaw = this.store.get(["documents", document, "anchors"]);
        if (anchorsRaw === undefined) {
            throw "anchors should exist (insertUpdateAnchors: 1)";
        }

        const anchors = anchorsRaw as unknown as Array<Map<string, StoreData>>;
        
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            const cursor = new Position(anchor.get("row") as number, anchor.get("column") as number);

            if (!anchor.get("fixed") as boolean && position.compareTo(cursor) <= 0) {
                if (lines.length > 1) {
                    const modifyResult = this.store.setNoClone(
                        ["documents", document, "anchors", i, "row"],
                        cursor.row + lines.length - 1
                    );
                    if (!modifyResult.success) {
                        throw "anchor row set should have succeeded (insertUpdateAnchors: 2)";
                    }
                }

                let column = cursor.column;
                if (cursor.row === position.row) {
                    if (lines.length === 1) {
                        column = cursor.column + lines[0].length;
                    } else {
                        column = lines[lines.length - 1].length + cursor.column - position.column;
                    }
                }

                if (column !== cursor.column) {
                    const modifyResult = this.store.setNoClone(
                        ["documents", document, "anchors", i, "column"],
                        column
                    );
                    if (!modifyResult.success) {
                        throw "anchor column set should have succeeded (insertUpdateAnchors: 3)";
                    }
                }
            }
        }
        
        return true;
    }  

    insert(document: string, text: string, position: Position) {
        const linesToInsert = splitIntoLines(text);
        const lines = this.getDocumentText(document);
        
        if (lines === undefined) {
            return false;
        }
        
        let actualPosition = this.normalizeUnchecked(lines, position);
        let beforeText = lines[actualPosition.row].substring(0, actualPosition.column);
        let afterText = lines[actualPosition.row].substring(actualPosition.column);

        if (linesToInsert.length === 1) {
            let updatedLine = beforeText + linesToInsert[0] + afterText;
            
            let storeResult = this.store.setNoClone(
                ["documents", document, "lines", actualPosition.row],
                updatedLine
            );
            if (!storeResult.success) {
                throw "store set should have succeeded (insert: 1)";
            }
        }
        else {
            let originalLine = beforeText + linesToInsert[0];
            let insertLines = linesToInsert.slice(1);
            insertLines[insertLines.length - 1] += afterText;

            let modifyResult = this.store.setNoClone(
                ["documents", document, "lines", actualPosition.row],
                originalLine
            );
            if (!modifyResult.success) {
                throw "store set should have succeeded (insert: 2)";
            }

            let insertResult = this.store.insertList(
                ["documents", document, "lines"],
                actualPosition.row + 1,
                insertLines
            );
            if (!insertResult.success) {
                throw "store insert lines should have succeeded (insert: 3)";
            }
        }

        this.insertUpdateAnchors(document, actualPosition, linesToInsert);
        return true;        
    }

    remove(document: string, left: Position, right: Position) {
        const lines = this.getDocumentText(document);
        if (lines === undefined) {
            return false;
        }
        
        left = this.normalizeUnchecked(lines, left);
        right = this.normalizeUnchecked(lines, right);
        
        if (left.compareTo(right) > 0) {
            const temporary = left;
            left = right;
            right = temporary;
        }
        
        let beforeText = lines[left.row].substring(0, left.column);
        let afterText = lines[right.row].substring(right.column);
        
        if (right.row > left.row) {
            let rowsToRemove = right.row - left.row;
            let storeResult = this.store.removeList(
                ["documents", document, "lines"],
                left.row + 1,
                right.row + 1
            );
            if (!storeResult.success) {
                throw "line removal should have worked (remove: 1)";
            }
        }

        let modifyResult = this.store.setNoClone(
            ["documents", document, "lines", left.row],
            beforeText + afterText
        );
        if (!modifyResult.success) {
            throw "store set should have succeeded (remove: 2)";
        }
        
        return true;
        
    }  
}