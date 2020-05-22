import * as Store from "../src/store";
import { StoreNode } from "../src/store";
import test from "ava";

test("literal number", t => {
    const node = StoreNode.fromJson(15);
    t.is(node.parent, null);
    t.true(node instanceof Store.NumberNode);
    t.is((node as Store.NumberNode).value, 15);
    t.is(node.getNumber(), 15);
    t.throws(() => {
        node.getString();
    }, {instanceOf: TypeError});
});

test("literal string", t => {
    const node = StoreNode.fromJson("testing");
    t.true(node instanceof Store.StringNode);
    t.is(node.getString(), "testing");
    t.throws(() => {
        node.getNumber();
    }, {instanceOf: TypeError});
});

test("literal boolean", t => {
    const node = StoreNode.fromJson(true);
    t.true(node instanceof Store.BooleanNode);
    t.is(node.getBoolean(), true);
    t.throws(() => {
        node.getNumber();
    }, {instanceOf: TypeError});
});

test("literal null", t => {
    const nodes = [StoreNode.fromJson(null), StoreNode.fromJson(undefined)];
    for (const node of nodes) {
        t.true(node instanceof Store.NullNode);
        t.is(node.getNull(), null);
        t.throws(() => {
            node.getNumber();
        }, {instanceOf: TypeError});
    }
});

test("list of literals", t => {
    const node = StoreNode.fromJson([7, true, "happy", null]);
    t.true(node instanceof Store.ListNode);
    t.assert(node.getListReference().length === 4);
    t.is(node.length(), 4);
    t.is(node.index(0).getNumber(), 7);
    t.is(node.index(1).getBoolean(), true);
    t.is(node.index(2).getString(), "happy");
    t.is(node.index(3).getNull(), null);
    t.is(node.index(-1), undefined);
    t.is(node.index(4), undefined);
    for (let i = 0; i < 4; i++) {
        t.is(node.index(i).parent, node);
    }
});

test("map of literals", t => {
    const node = StoreNode.fromJson({
        name: "Ken",
        age: 33,
        stupid: true,
        typing: null
    });
    t.true(node instanceof Store.MapNode);
    t.is(node.getMapReference().get("name").getString(), "Ken");
    t.deepEqual(node.keys().sort(), ["age", "name", "stupid", "typing"]);
    t.is(node.key("name").getString(), "Ken");
    t.is(node.key("age").getNumber(), 33);
    t.is(node.key("stupid").getBoolean(), true);
    t.is(node.key("typing").getNull(), null);
    for (const key of node.keys()) {
        t.is(node.key(key).parent, node);
    }
});
 
test("parenting & nesting", t => {
    const node = StoreNode.fromJson([
        35,
        { issue: 2, names: ["Fred", "Alice"] },
        [2, 7, 16]
    ]);
    
    t.is(node.index(1).key("names").index(0).getString(), "Fred")

    t.is(node.parent, null);
    t.is(node.index(0).parent, node);
    t.is(node.index(1).parent, node);
    t.is(node.index(1).key("issue").parent, node.index(1));
    t.is(node.index(1).key("names").parent, node.index(1));
    t.is(node.index(1).key("names").index(0).parent, node.index(1).key("names"));
    t.is(node.index(1).key("names").index(1).parent, node.index(1).key("names"));
    t.is(node.index(2).parent, node);
    t.is(node.index(2).index(0).parent, node.index(2));
    t.is(node.index(2).index(1).parent, node.index(2));
    t.is(node.index(2).index(2).parent, node.index(2));
});

test("serialization & aliasing", t => {
    const original : any = [
        35,
        { issue: 2, names: ["Fred", "Alice"] },
        [2, 7, 16]
    ];

    const original_copy : any = [
        35,
        { issue: 2, names: ["Fred", "Alice"] },
        [2, 7, 16]
    ];

    const node = StoreNode.fromJson(original);
    
    // This should only modify original - not node, not original_copy
    original.push("testing for alias");
    original[1].issue = 5;
    
    const serialized = node.getJson();
    
    // This should only modify the node - not the original, not serialized
    node.getListReference().push(new Store.NumberNode(node, 333333));
    
    t.deepEqual(original_copy, serialized);
});

