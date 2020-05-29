import { Languages } from "../src/language";
import test from "ava";

test("shouldSpace works", t => {
    let languages = new Languages();

    t.is(languages.shouldSpace("basic", "argjh.", "abc 145 a"), false);
    t.is(languages.shouldSpace("basic", "fw t4 abc", ".arsg(214d)"), false);
    t.is(languages.shouldSpace("basic", "", ""), false);
    t.is(languages.shouldSpace("basic", ".athat", "adthba."), true);  
    t.is(languages.shouldSpace("basic", "asd", ""), false);
    t.is(languages.shouldSpace("basic", "", "asd"), false);

    
});
