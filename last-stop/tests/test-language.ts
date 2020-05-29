import { Languages, Token } from "../src/language";
import test from "ava";
import { Position } from "../src/shared";

test("shouldSpace works", t => {
    let languages = new Languages();

    t.is(languages.shouldSpace("basic", "argjh.", "abc 145 a"), false);
    t.is(languages.shouldSpace("basic", "fw t4 abc", ".arsg(214d)"), false);
    t.is(languages.shouldSpace("basic", "", ""), false);
    t.is(languages.shouldSpace("basic", ".athat", "adthba."), true);  
    t.is(languages.shouldSpace("basic", "asd", ""), false);
    t.is(languages.shouldSpace("basic", "", "asd"), false);
});

test("tokenize unicode", t => {
    let languages = new Languages();

    let result = languages.tokenize("□", ["basic"], new Position(0, 0), true);
    t.deepEqual(result.tokens, [
        new Token("□", new Position(0, 0), "unknown", "basic")
    ]);
})