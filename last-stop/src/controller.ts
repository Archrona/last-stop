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

    onSpeech(text: string) {
        let t0 = process.hrtime.bigint();

        let description = "Speech: " + this.app.model.store.getUndoCount();
        if (this.lastSpeech !== null) {
            this.lastSpeech.undo();
        }

        let t1 = process.hrtime.bigint();

        description += " -> " + this.app.model.store.getUndoCount();
        this.lastSpeech = Speech.execute(this.app, text);

        let t2 = process.hrtime.bigint();

        this.app.view.updateAllWindows();
        
        let t3 = process.hrtime.bigint();

        description += " -> " + this.app.model.store.getUndoCount();
        //description += " (" + this.lastSpeech.executed.length + " cmds)"
        description += "  undo " + (t1 - t0) + " ns; action " + (t2 - t1) + " ns; view " + (t3 - t2) + " ns";
        description += "  rss " + process.memoryUsage().rss;
        console.log(description);
        

    }

    onCopyAndErase() {
        let doc = this.app.model.getActiveDocument();

        if (doc === null) {
            return;
        }

        let text = doc[0].getText();
        text = replaceAll(text, INSERTION_POINT, "");

        clipboard.writeText(text);
    }

    onCommitChanges() {
        this.lastSpeech = null;
    }
}