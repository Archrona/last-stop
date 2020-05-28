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

    let speech = Speech.execute(app, "flat test name stop snake test name");

    t.log(speech.executed);
    t.log(app.model.getActiveDocument()[0].getText());
});


/* TODOs

  1. Test DocumentNavigator.getPositionContext
  2. Fix DocumentNavigator.get/setLineContext - either make algo or refactor to flat array
  3. Figure out what to do with contextual glue
  4. Build out command features one by one
  5. Get scratchpad working completely minus all of the project/etc features
  6. Get project/filesystem shit working
  */
 