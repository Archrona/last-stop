// model.ts
//   Overall data model for the app.

import { Main } from "./main";
import { Store } from "./store";

const STORE_INITIAL_STATE = {
    buffers: {
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
                "}"
            ],
            anchors: [
                {
                    type: "cursor",
                    row: 0,
                    column: 0
                }
            ],
            filename: null,
            baseContext: "basic"
        }  
    },
    windows: {
        "11": {
            subscription: "buffer/scratchpad",
            showLine: 0,
            showColumn: 0
        }
    },
    view: {
        activeWindow: "11"
    },
    project: {
        basePath: null
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
}