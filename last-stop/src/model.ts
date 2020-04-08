// model.ts
//   Overall data model for the app.

import { Main } from "./main";
import { Store, getType, DataTypes, StoreData } from "./store";
import { Position } from "./shared";
 
const STORE_INITIAL_STATE = {
    documents: {
        "scratchpad": {
            name: "scratchpad",
            modified: null,
            lines: [
                "export class View {",
                "    app: Main;",
                "    windows: Array<Window>;",
                "    nextWindowId: number;",
                "",
                "    constructor(app: Main) {",
                "        this.app = app;",
                "        this.windows = [];",
                "        this.nextWindowId = 11;",
                "",
                "        this.createWindow();",
                "    }",
                "",
                "    test() {",
                "        let str = \"asd \\\"haha\\\" 3+4-5\";",
                "        let multiLine = \"this is a test",
                "            of the emergency broadcasting",
                "            system!\";",
                "    }",
                "",
                "    checkpoint(): number {",
                "        this.undoStack.push(new DeltaPair(DeltaPairType.Checkpoint, (store) => true, (store) => true));",
                "        return this.undoStack.length;",
                "    }",
                "}",
            ],
            anchors: [
                {
                    type: "cursor_0",
                    row: 4,
                    column: 0
                },
                {
                    type: "mark_0",
                    row: 5,
                    column: 15
                },
                {
                    type: "view_0",
                    row: 0,
                    column: 12       
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

        console.log(this.store.get([]));
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
}