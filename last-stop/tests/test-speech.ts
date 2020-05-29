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
    doc.setCursorAndMark(0, new Position(0, 4));
    let speech = Speech.execute(app, "  3 is below tower test name [ x . length ( ) ] ");

    t.is(doc.getText(), "if (3 < TEST_NAME[x.length()]) {");
});

test("substitutions", t => {
    let app = getApp();
    let doc = app.model.getActiveDocument()[0];

    let s1 = Speech.execute(app, "group");
    t.deepEqual(doc.getMark(0), new Position(0, 1));
    t.deepEqual(doc.getCursor(0), new Position(0, 2));
    
    s1.undo();
    t.is(doc.getText(), "");
    t.deepEqual(doc.getMark(0), new Position(0, 0));
    t.deepEqual(doc.getCursor(0), new Position(0, 0));
    
    s1 = Speech.execute(app, "if x is below 5 step snake p callback call finish");
});

// Data as of 5/29/2020:
//    command execute/undo pair:  34 us   (135,000 clocks)
//      delta execute/undo pair:   5 us   ( 20,000 clocks)
//
//    appx. 3x slower when cold
//
// test("benchmark", t => {
//     let speech = "if x plus 56 is below array.length call step do thing call finish step step".repeat(10);

//     let app = getApp();
//     let doc = app.model.getActiveDocument()[0];
//     let cmds = 0, deltas = 0;

//     for (let cycle = 0; cycle < 10; cycle++) {
//         let s1 = Speech.execute(app, speech);
//         cmds += s1.executed.length;
//         deltas += s1.finalUndoIndex - s1.baseUndoIndex;
//         s1.undo();
//     }

//     //t.log("Did " + cmds + " cmds and " + deltas + " do-undo deltas");
//     t.is(true, true);
// });




/* TODOs

  - Build out command features one by one
  - Data-drive colors from json file
  - Get scratchpad working completely minus all of the project/etc features
  - Get project/filesystem shit working
  
*/