import { Model, Anchor } from "../src/model";
import test from "ava";
import { Main } from "../src/main";
import { Position, binarySearchSparse } from "../src/shared";

test("model constructor, empty doc", t => {
    let model = new Main(true).model;

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
    let model = new Main(true).model;
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
    let model = new Main(true).model;
    let d = model.documents.add("scratchpad", "basic", null);

    d.insert(0, "Hello!");
    t.is(d.getText(), "Hello!");
    d.setAnchor("mark_0", new Anchor(new Position(0, 5), false));
    d.newAnchor("test", new Anchor(new Position(0, 1), false));
    t.deepEqual(d.getAnchor("cursor_0").position, new Position(0, 6));

    d.setAnchor("cursor_0", new Anchor(new Position(0, 3), false));
    d.insertAt("AAA\nBBB\nCCCCC", new Position(0, 3));
    t.is(d.getText(), "HelAAA\nBBB\nCCCCClo!");
    t.deepEqual(d.getAnchor("cursor_0").position, new Position(2, 5));
    t.deepEqual(d.getAnchor("mark_0").position, new Position(2, 7));
    t.deepEqual(d.getAnchor("view_0").position, new Position(0, 0));
    t.deepEqual(d.getAnchor("test").position, new Position(0, 1));
})

test("document remove/cursor replace", t => {
    let model = new Main(true).model;
    let document = model.documents.add("scratchpad", "basic", null);
    
    document.insert(0, "Testing\n345\n\nFish");
    document.newAnchor("test", new Anchor(new Position(3, 3), false));
    document.newAnchor("test_2", new Anchor(new Position(1, 3), false));
    document.removeAt(new Position(0, 2), new Position(1, 1));

    t.is(document.getText(), "Te45\n\nFish");
    t.deepEqual(document.getAnchor("cursor_0").position, new Position(2, 4));
    t.deepEqual(document.getAnchor("test").position, new Position(2, 3));
    t.deepEqual(document.getAnchor("test_2").position, new Position(0, 4));
    
    document.setCursor(0, new Position(0, 2));
    document.setMark(0, new Position(2, 0));
    document.insert(0, "1\n2");

    t.is(document.getText(), "Te1\n2Fish");
    t.deepEqual(document.getCursor(0), new Position(1, 1));
    t.deepEqual(document.getMark(0), new Position(1, 1));
    t.deepEqual(document.getView(0), new Position(0, 0));
    t.deepEqual(document.getAnchor("test").position, new Position(1, 4));
    t.deepEqual(document.getAnchor("test_2").position, new Position(1, 1));
});

test("can get line context #1", t => {
    let model = new Main(true).model;
    let document = model.documents.add("scratchpad", "basic", null);
    
    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.throws(() => document.getLineContext(-1), {instanceOf: Error});
    t.throws(() => document.getLineContext(1), {instanceOf: Error});
    
    document.insert(0, "hello\nmy name is Greg\nI am an onion");

    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.deepEqual(document.getLineContext(1), ["basic"]);
    t.deepEqual(document.getLineContext(2), ["basic"]);
    t.throws(() => document.getLineContext(-1), {instanceOf: Error});
    t.throws(() => document.getLineContext(3), {instanceOf: Error});

    //t.log(document.clone().goKey("contexts").getJson());

    document.setMark(0, new Position(0, 2));
    document.remove(0);

    //t.log(document.clone().goKey("contexts").getJson());
});


test("can get line context #2", t => {
    let model = new Main(true).model;
    let document = model.documents.add("scratchpad", "basic", null);
    
    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.throws(() => document.getLineContext(-1), {instanceOf: Error});
    t.throws(() => document.getLineContext(1), {instanceOf: Error});
    
    document.insert(0, "hello\nmy name is \"Greg\nI am\" an onion\nPlease love me\nlove\nmeeee");

    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.deepEqual(document.getLineContext(1), ["basic"]);
    t.deepEqual(document.getLineContext(2), ["basic", "double_quoted_string"]);
    t.deepEqual(document.getLineContext(3), ["basic"]);
    t.deepEqual(document.getLineContext(4), ["basic"]);
    t.deepEqual(document.getLineContext(5), ["basic"]);

    //t.log(document.clone().goKey("contexts").getJson());

    document.setMark(0, new Position(0, 2));
    document.setCursor(0, new Position(2, 200));
    document.remove(0);

    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.deepEqual(document.getLineContext(1), ["basic"]);
    t.deepEqual(document.getLineContext(2), ["basic"]);
    t.deepEqual(document.getLineContext(3), ["basic"]);

    //t.log(document.clone().goKey("contexts").getJson());

    document.insert(0, "\"");

    t.deepEqual(document.getLineContext(0), ["basic"]);
    t.deepEqual(document.getLineContext(1), ["basic", "double_quoted_string"]);
    t.deepEqual(document.getLineContext(2), ["basic", "double_quoted_string"]);
    t.deepEqual(document.getLineContext(3), ["basic", "double_quoted_string"]);
    
    //t.log(document.clone().goKey("contexts").getJson());
});

test("position context", t => {
    let app = new Main(true);
    let model = app.model;
    let document = model.documents.add("scratchpad", "basic", null);
    document.insert(0, "hello\nUm, \"Greg\nI am\" an onion");

    t.is(document.getPositionContext(new Position(0, 0), app.languages), "basic");
    t.is(document.getPositionContext(new Position(0, 1), app.languages), "basic");
    t.is(document.getPositionContext(new Position(0, 5), app.languages), "basic");
    t.is(document.getPositionContext(new Position(1, 0), app.languages), "basic");
    t.is(document.getPositionContext(new Position(1, 4), app.languages), "basic");
    t.is(document.getPositionContext(new Position(1, 5), app.languages), "double_quoted_string");
    t.is(document.getPositionContext(new Position(1, 100), app.languages), "double_quoted_string");
    t.is(document.getPositionContext(new Position(2, 0), app.languages), "double_quoted_string");
    t.is(document.getPositionContext(new Position(2, 4), app.languages), "double_quoted_string");
    t.is(document.getPositionContext(new Position(2, 5), app.languages), "basic");
    t.is(document.getPositionContext(new Position(2, 100), app.languages), "basic");
})