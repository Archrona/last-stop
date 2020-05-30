import { Speech } from "./speech";
import { Main } from "./main";


export class Controller {
    app: Main;
    lastSpeech: Speech | null;

    constructor(app: Main) {
        this.app = app;
        this.lastSpeech = null;
    }

    onSpeech(text: string) {
        let description = "Speech: " + this.app.model.store.getUndoCount();

        if (this.lastSpeech !== null) {
            this.lastSpeech.undo();
        }

        description += " -> " + this.app.model.store.getUndoCount();

        this.lastSpeech = Speech.execute(this.app, text);
        this.app.view.updateAllWindows();

        description += " -> " + this.app.model.store.getUndoCount();
        description += " (" + this.lastSpeech.executed.length + " cmds)"

        console.log(description);

    }
}