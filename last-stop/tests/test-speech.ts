import { Model } from "../src/model";
import test from "ava";
import { Main } from "../src/main";
import { Speech } from "../src/speech";
import { Position } from "../src/shared";

function getApp() {
    let app = new Main(true);

    let doc = app.model.documents.add("scratchpad", "basic");
    app.model.subscriptions.set(11, "doc@scratchpad@0");
    app.model.setActiveWindow(11);

    return app;
}

test("basic speech, spacing", t => {
    let app = getApp();
    let doc = app.model.getActiveDocument()[0];

    doc.insert(0, "if () {");
    doc.setCursor(0, new Position(0, 4));
    doc.setMark(0, new Position(0, 4));
    let speech = Speech.execute(app, "  3 is below tower test name [ x . length ( ) ] ");

    t.is(doc.getText(), "if (3 < TEST_NAME[x.length()]) {");
});

test("substitutions", t => {
    let app = getApp();
    let doc = app.model.getActiveDocument()[0];


});





/* TODOs

  - Build out command features one by one
  - Data-drive colors from json file
  - Get scratchpad working completely minus all of the project/etc features
  - Get project/filesystem shit working
  
*/