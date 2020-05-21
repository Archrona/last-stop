// model.ts
//   Overall data model for the app.

import { Main } from "./main";
import { Store, getType, DataTypes, StoreData } from "./store";
import { Position, splitIntoLines } from "./shared";

type Context = [number, Array<string>];

export class Anchor {
    constructor(public position: Position, public fixed: boolean) {
    
    }
}
 
const STORE_INITIAL_STATE = {
    documents: {
        "scratchpad": {
            name: "scratchpad",
            modified: null,
            lines: [
                'Boo "asd\\n" a "asd',
                'asd", "fefe\\nfe" a'
            ],
            contextChanges: [
                [1, ["basic", "double_quoted_string"]]
            ],
            anchors: {
                "cursor_0": {
                    row: 0,
                    column: 0,
                    fixed: false
                },
                "mark_0": {
                    row: 0,
                    column: 0,
                    fixed: false
                },
                "view_0": {
                    row: 0,
                    column: 0,
                    fixed: true   
                },
            },
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

        for (let i = 0; i <= 0; i++) {
            console.log(this.getLineContext("scratchpad", i));
        }
        
        let position = new Position(0, 0);
        let text = this.getDocumentText("scratchpad");
        while (position.row < text.length) {
            let context = this.getPositionContext("scratchpad", position);
            console.log(position.row + " " + position.column + ": " + context);
            position.column++;
            if (position.column > text[position.row].length) {
                position.row++;
                position.column = 0;
            }
        }
 
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

    getAnchor(document: string, name: string): Anchor | undefined {
        const anchor = this.store.get(["documents", document, "anchors", name]);
        if (anchor === undefined) {
            return undefined;
        }
        
        return new Anchor(
            new Position(
                (anchor as Map<string, StoreData>).get("row") as number,
                (anchor as Map<string, StoreData>).get("column") as number
            ),
            (anchor as Map<string, StoreData>).get("fixed") as boolean
        );
    }  

    getAnchors(document: string) {
        const anchors = this.store.get(["documents", document, "anchors"]);
        if (anchors === undefined) {
            return undefined;
        }
        
        const result: Map<string, Anchor> = new Map();

        for (const [name, anchor] of (anchors as Map<string, StoreData>).entries()) {
            if (getType(anchor) !== DataTypes.Map) {
                continue;
            }
             
            const map = anchor as Map<string, StoreData>;
            
            const row = map.get("row");
            if (getType(row) !== DataTypes.Number) throw "anchor in store has non-numeric row";

            const column = map.get("column");
            if (getType(column) !== DataTypes.Number) throw "anchor in store has non-numeric column";
            
            const fixed = map.get("fixed");
            if (getType(fixed) !== DataTypes.Boolean) throw "anchor in store has non-boolean fixed";
            
            result.set(
                name,
                new Anchor(new Position(row as number, column as number), fixed as boolean)
            );
        }
        
        return result;
    }

    getContexts(document: string) : Array<Context> {
        const contexts = this.store.get(["documents", document, "contextChanges"]);
        if (contexts === undefined) {
            throw "document has no contexts (getContext: 3)";
        }

        return contexts as Array<Context>;
    } 

    getLineContextUnchecked(baseContext: Array<string>, contexts: Array<Context>, row: number) {
        let lowest = 0;
        let highest = contexts.length;

        while (lowest <= highest) {
            let middle = Math.floor((highest + lowest) / 2);
            
            let leftPredicate = (middle === 0 || contexts[middle - 1][0] <= row);
            let rightPredicate = middle < contexts.length && contexts[middle][0] <= row;
            
            if (leftPredicate && !rightPredicate) {
                if (middle === 0) {
                    return {
                        context: baseContext,
                        index: null
                    };
                }
                else {
                    return {
                        context: contexts[middle - 1][1],
                        index: middle - 1
                    };
                }
            }
            else if (!leftPredicate) {
                highest = middle - 1;
            }
            else {
                lowest = middle + 1;
            }
        }

        throw "binary search could not reveal context (getLineContextUnchecked: 2)";
    }

    getLineContext(document: string, row: number) {
        const lines = this.getDocumentText(document);
        const baseContext = this.getBaseContext(document);
        
        if (lines === undefined || baseContext === undefined) {
            throw "cannot find document " + document + " (getLineContext: 2)";
        }     
        if (row < 0 || row >= lines.length) {
            throw "cannot get context of nonexistent row " + row + " (getLineContext: 1)";
        }
        
        return this.getLineContextUnchecked(baseContext, this.getContexts(document), row);         
    } 

    getPositionContext(document: string, position: Position) {
        const lineContext = this.getLineContext(document, position.row);
        const lines = this.getDocumentText(document);

        let result = this.app.languages.tokenize(
            lines[position.row], lineContext.context, new Position(position.row, 0), true
        );

        //console.log(result.tokens);

        let left = 0;
        let right = result.tokens.length;

        while (left <= right) {
            let middle = Math.floor((left + right) / 2);
            
            let leftPredicate = (middle === 0 || result.tokens[middle - 1].position.column <= position.column);
            let rightPredicate = middle < result.tokens.length && result.tokens[middle].position.column <= position.column;
            
            if (leftPredicate && !rightPredicate) {
                if (middle === 0) {
                    //console.log("middle: 0");
                    return lineContext.context[lineContext.context.length - 1];
                }
                else {
                    //console.log("middle: " + middle);
                    return result.tokens[middle - 1].context;
                }
            }
            else if (!leftPredicate) {
                right = middle - 1;
            }
            else {
                left = middle + 1;
            }
        }

        throw "binary search could not reveal context (getPositionContext: 1)";
    }  

    updateContexts(document: string, topRow: number, bottomRow: number) {
        // BIG TODO
        // recalculate contexts for lines [topRow, bottomRow) by tokenizing
        // if bottomRow would be left in a context state inconsistent with what is already in
        // the context list, keep tokenizing and updating down the file

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
        this.updateContexts(document, actualPosition.row, actualPosition.row + linesToInsert.length);
 
        return true;        
    }

    removeUpdateAnchors(document: string, left: Position, right: Position) {
        const anchorsRaw = this.store.get(["documents", document, "anchors"]);
        if (anchorsRaw === undefined) {
            throw "anchors should exist (removeUpdateAnchors: 1)";
        }
        
        const anchors = anchorsRaw as unknown as Array<Map<string, StoreData>>;
        
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            const cursor = new Position(anchor.get("row") as number, anchor.get("column") as number);
            
            if (!anchor.get("fixed") as boolean && left.compareTo(cursor) < 0) {
                let targetRow = left.row;
                let targetColumn = left.column;
                
                if (right.compareTo(cursor) < 0) {
                    targetRow = cursor.row - (right.row - left.row);
                    
                    if (right.row === cursor.row) {
                        if (left.row === right.row) {
                            targetColumn -= right.column - left.column;
                        }
                        else {
                            targetColumn -= right.column;
                        }
                    } else {
                        targetColumn = cursor.column;
                    }
                }
                
                if (targetRow !== cursor.row) {
                    const modifyResult = this.store.setNoClone(
                        ["documents", document, "anchors", i, "row"],
                        targetRow
                    );
                    if (!modifyResult.success) {
                        throw "anchor row set should have succeeded (removeUpdateAnchors: 2)";
                    }
                }

                if (targetColumn !== cursor.column) {
                    const modifyResult = this.store.setNoClone(
                        ["documents", document, "anchors", i, "column"],
                        targetColumn
                    );
                    if (!modifyResult.success) {
                        throw "anchor column set should have succeeded (removeUpdateAnchors: 3)";
                    }
                }                
            }
        }

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
        
        this.removeUpdateAnchors(document, left, right);
        this.updateContexts(document, left.row, left.row + 1);
 
        return true;
    }

    getCursorContext(document: string, viewIndex: number): string {
        const cursor = this.getAnchor(document, "cursor_" + viewIndex);
        const mark = this.getAnchor(document, "mark_" + viewIndex);

        if (cursor === undefined || mark === undefined) {
            throw "could not find cursor or mark for context (getCursorContext: 1)";
        }       
        
        let left = (cursor.position.compareTo(mark.position) < 0 ? cursor : mark).position;
        const context = this.getPositionContext(document, left);
        
        return context;
    }

    
}