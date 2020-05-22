import * as Store from "../src/store";
import { Navigator, StoreNode } from "../src/store";
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

test("store & followPath", t => {
    const store = new Store.Store([12, [3, 2], { a: 1, b: [7, 5] }]);

    t.is(store.age, 0);
    
    t.is(store.followPath([]), store.root);
    t.is(store.followPath([0]), store.root.index(0));
    t.is(store.followPath([1]), store.root.index(1));
    t.is(store.followPath([2]), store.root.index(2));
    t.is(store.followPath([1, 0]), store.root.index(1).index(0));
    t.is(store.followPath([1, 1]), store.root.index(1).index(1));
    t.is(store.followPath([2, "a"]), store.root.index(2).key("a"));
    t.is(store.followPath([2, "b", 0]), store.root.index(2).key("b").index(0));

    t.is(store.followPath([- 1]), null);
    t.is(store.followPath([3]), null);
    t.is(store.followPath(["fail"]), null);
    t.is(store.followPath([1, 2]), null);
    t.is(store.followPath([2, "fail"]), null);
    t.is(store.followPath([2, 0]), null);
});

test("basic navigator", t => {
    const store = new Store.Store(34);
    const navigator = store.getNavigator();
    t.is(navigator.obsolete(), false);
    t.deepEqual(navigator.getJson(), 34);
    t.deepEqual(navigator.getType(), Store.DataType.Number);
    t.is(navigator.getNumber(), 34);
    t.throws(() => {
        navigator.getString();
    }, {instanceOf: TypeError});
    t.deepEqual(navigator.getPath(), []);
    t.is(navigator.getAge(), 0);
    t.is(navigator.getStore(), store);
    t.is(navigator.hasParent(), false);
    t.is(navigator.hasIndex(0), false);
    t.is(navigator.hasKey("fail"), false);
    t.throws(() => {
        navigator.goParent();
    }, {instanceOf: Error});
    t.throws(() => {
        navigator.goIndex(0);
    }, {instanceOf: Error});
    t.throws(() => {
        navigator.goKey("fail");
    }, {instanceOf: Error});
    t.throws(() => {
        navigator.goSibling(1);
    }, {instanceOf: Error});
});

test("basic age/obsolete", t => {
    const store = new Store.Store(null);
    const navigator = store.getNavigator();

    t.is(store.age, 0);
    t.is(navigator.getAge(), 0);
    
    store.wasModified();
    t.is(store.age, 1);
    t.is(navigator.getAge(), 0);

    t.is(navigator.obsolete(), true);
    t.notThrows(() => {
        navigator.checkValid();
    });
    t.is(store.age, 1);
    t.is(navigator.getAge(), 1);
});

test("navigator lists", t => {
    const store = new Store.Store([[1, 2], 3, 5, [7, 8]]);
    const navigator = store.getNavigator();
    t.deepEqual(navigator.getJson(), [[1, 2], 3, 5, [7, 8]]);
    t.deepEqual(navigator.getType(), Store.DataType.List);
    t.is(navigator.getLength(), 4);
    t.is(navigator.hasIndex(0), true);
    t.is(navigator.hasIndex(3), true);
    t.is(navigator.hasIndex(- 1), false);
    t.is(navigator.hasIndex(4), false);
    navigator.goIndex(0);
    t.is(navigator.hasParent(), true);
    t.is(navigator.getLength(), 2);
    t.deepEqual(navigator.getJson(), [1, 2]);
    navigator.goIndex(0);
    t.is(navigator.getNumber(), 1);
    t.is(navigator.goSibling(1), true);
    t.is(navigator.getNumber(), 2);
    t.is(navigator.goPreviousSibling(), true);
    t.is(navigator.getNumber(), 1);
    t.is(navigator.goPreviousSibling(), false);
    t.is(navigator.getNumber(), 1);
    navigator.goParent();
    navigator.goParent();
    navigator.goIndex(2);
    t.is(navigator.getNumber(), 5);
    t.deepEqual(navigator.getJson(), 5);
    t.is(navigator.goNextSibling(), true);
    t.deepEqual(navigator.getJson(), [7, 8]);
    navigator.goIndex(1);
    t.is(navigator.getNumber(), 8);
    t.deepEqual(navigator.getPath(), [3, 1]);
    navigator.goRoot();
    t.deepEqual(navigator.getJson(), [[1, 2], 3, 5, [7, 8]]);
});

test("navigator maps", t => {
    const json = {
        cheese: "cheddar",
        friends: [2, 6],
        names: { first: "John", last: "Smith" }
    };
    const store = new Store.Store(json);
    const navigator = store.getNavigator();

    t.deepEqual(navigator.getJson(), json);
    t.deepEqual(navigator.getType(), Store.DataType.Map);
    t.deepEqual(navigator.getKeys(), ["cheese", "friends", "names"]);
    t.is(navigator.hasKey("friends"), true);
    t.is(navigator.hasKey("sauce"), false);
    t.throws(() => {
        navigator.getLength();
    }, {instanceOf: TypeError});
    t.is(navigator.hasIndex(0), false);
    
    t.throws(() => {
        navigator.goKey("sauce");
    }, {instanceOf: Error});
    navigator.goKey("cheese");
    t.is(navigator.getString(), "cheddar");
    navigator.goSiblingKey("friends");
    t.deepEqual(navigator.getJson(), [2, 6]);
    navigator.goIndex(1);
    t.is(navigator.getNumber(), 6);
    t.deepEqual(navigator.getPath(), ["friends", 1]);
    t.is(navigator.goSibling(- 1), true);
    t.is(navigator.getNumber(), 2);
    t.deepEqual(navigator.getPath(), ["friends", 0]);
    t.throws(() => {
        navigator.goSiblingKey("fail");
    }, {instanceOf: Error});
    t.deepEqual(navigator.getPath(), ["friends", 0]);
    t.is(navigator.getNumber(), 2);
    navigator.goParent();
    navigator.goSiblingKey("names");
    t.deepEqual(navigator.getJson(), { first: "John", last: "Smith" });
    t.deepEqual(navigator.getPath(), ["names"]);
    navigator.goKey("first");
    t.is(navigator.getString(), "John");
    navigator.goSiblingKey("last");
    t.is(navigator.getString(), "Smith");
    t.throws(() => {
        navigator.goSiblingKey("middle");
    }, {instanceOf: Error});
    t.is(navigator.getString(), "Smith");
    t.deepEqual(navigator.getPath(), ["names", "last"]);    
});

