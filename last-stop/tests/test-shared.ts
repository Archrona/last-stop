import { getRGB, splitIntoLines, listsContainSameElements } from "../src/shared";
import test from "ava";

test("getRGB", t => {
    t.is(getRGB(20, 40, 60), "rgb(20,40,60)");
})

