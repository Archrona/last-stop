import { Model, Anchor } from "../src/model";
import test from "ava";
import { Main } from "../src/main";
import { Position, binarySearchSparse } from "../src/shared";
import { Speech } from "../src/speech";

function getApp() {
    let app = new Main(true);

    let doc = app.model.documents.add("scratchpad", "basic");
    app.model.subscriptions.set(11, "doc@scratchpad@0");
    app.model.setActiveWindow(11);

    return app;
}

test("model constructor, empty doc", t => {
    let app = getApp();

    let speech = Speech.execute(app, "  test name below 3 plus equals group ");

    t.log(speech.executed);
});
