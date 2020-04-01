// model.ts
//   Overall data model for the app.

import { Main } from "./main";

export class Model {
    app: Main;
    
    constructor(app: Main) {
        this.app = app;
    }
}