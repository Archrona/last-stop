import { Model, Anchor } from "../src/model";
import test from "ava";
import { Main } from "../src/main";
import { Position } from "../src/shared";

test("model constructor, empty doc", t => {
    let model = new Model();

    let d = model.documents.add("scratchpad", "basic", null);
    t.is(d.node, model.documents.get("scratchpad").node);
    t.deepEqual(d.getLines(), [""]);
    t.deepEqual(d.getBaseContext(), ["basic"]);
    t.deepEqual(d.getAnchor("cursor_0"), new Anchor(new Position(0, 0), false));
    t.deepEqual(d.getAnchor("mark_0"), new Anchor(new Position(0, 0), false));
    t.deepEqual(d.getAnchor("view_0"), new Anchor(new Position(0, 0), true));
    t.deepEqual(d.getText(), "");
});

test("doc write", t => {
    let model = new Model();
    let d = model.documents.add("scratchpad", "basic", null);

    d.setCheckpoint();
    d.setText("hey!\nMy name is Ken!\nCheck out this test ain't it good\nI know");
    d.setAnchor("cursor_0", new Anchor(new Position(1, 2), false));

    t.deepEqual(d.getLines(), ["hey!", "My name is Ken!", "Check out this test ain't it good", "I know"]);
    t.deepEqual(d.getAnchor("cursor_0"), new Anchor(new Position(1, 2), false));
    
    t.is(d.getRange(new Position(0, 0), new Position(0, 400)), "hey!");
    t.is(d.getRange(new Position(0, 600), new Position(0, -50)), "hey!");
    t.is(d.getRange(new Position(0, 0), new Position(1, 0)), "hey!\n");
    t.is(d.getRange(new Position(0, 100), new Position(1, 0)), "\n");
    t.is(d.getRange(new Position(0, 2), new Position(1, 2)), "y!\nMy");
    t.is(d.getRange(new Position(1, 2), new Position(1, 2)), "");
    t.is(d.getRange(new Position(0, 3), new Position(2, 4)), "!\nMy name is Ken!\nChec");
    t.is(d.getRange(new Position(300, -1010), new Position(-232, 5673476)), d.getText());
    
    model.store.undoUntilCheckpoint();
    t.deepEqual(d.getLines(), [""]);
    t.deepEqual(d.getAnchor("cursor_0"), new Anchor(new Position(0, 0), false));

    model.store.undo(100000);
    t.throws(() => d.checkValid());
});

test("doc insert", t => {
    let model = new Model();
    let d = model.documents.add("scratchpad", "basic", null);

    d.insertText("Hello!", 0);
    t.is(d.getText(), "Hello!");
    d.setAnchor("mark_0", new Anchor(new Position(0, 5), false));
    d.newAnchor("test", new Anchor(new Position(0, 1), false));
    t.deepEqual(d.getAnchor("cursor_0").position, new Position(0, 6));

    d.setAnchor("cursor_0", new Anchor(new Position(0, 3), false));
    d.insertText("AAA\nBBB\nCCCCC", 0);
    t.is(d.getText(), "HelAAA\nBBB\nCCCCClo!");
    t.deepEqual(d.getAnchor("cursor_0").position, new Position(2, 5));
    t.deepEqual(d.getAnchor("mark_0").position, new Position(2, 7));
    t.deepEqual(d.getAnchor("view_0").position, new Position(0, 0));
    t.deepEqual(d.getAnchor("test").position, new Position(0, 1));
})
