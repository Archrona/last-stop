import { getRGB, binarySearchSparse, splitIntoLines, listsContainSameElements, arrayEquals, IndentationPolicy } from "../src/shared";
import test from "ava";

test("getRGB", t => {
    t.is(getRGB(20, 40, 60), "rgb(20,40,60)");
})

test("sparse binary search", t => {
    for (let trials = 0; trials < 10; trials++) {
        for (let changes = 0; changes < 10; changes++) {
            let dense = [];
            let sparse = [];

            let index = Math.floor(Math.random() * 4);
            while (dense.length < index) {
                dense.push(-1);
            }

            for (let c = 0; c < changes; c++) {
                sparse.push(index);
                index += Math.floor(Math.random() * 6) + 1;
                while (dense.length < index) {
                    dense.push(c);
                }
                
            }
            
            let ans = [];

            for (let i = 0; i < index; i++) {
                ans.push(binarySearchSparse(0, index, i, (x) => sparse[x]));
            }

            t.deepEqual(ans, dense);

            if (!arrayEquals(dense, ans)) {
                t.log("FAILING CASE:");
                t.log(sparse);
                t.log(dense);
                t.log(ans);
            }
        }
    }
});

test("indentation policy", t => {
    t.is(IndentationPolicy.tabs(2).toString(), "Tabs: 2 sp/tab");
    t.is(IndentationPolicy.spaces(4).toString(), "Spaces: 4");

    t.is(IndentationPolicy.tabs(2).normalize("    grgr asd"), "\t\tgrgr asd");
    t.is(IndentationPolicy.tabs(4).normalize("    grgr"), "\tgrgr");
    t.is(IndentationPolicy.tabs(4).normalize("     grgr"), "\t\tgrgr");
    t.is(IndentationPolicy.spaces(4).normalize("    \tgrgr"), "        grgr");
    t.is(IndentationPolicy.spaces(2).normalize(" asd"), "  asd");
    t.is(IndentationPolicy.spaces(4).normalize("   \t  "), "            ");

    t.is(IndentationPolicy.spaces(2).indent("    hello"), "      hello");
    t.is(IndentationPolicy.spaces(4).indent("    hello"), "        hello");
    t.is(IndentationPolicy.spaces(4).indent("     hello"), "            hello");
    t.is(IndentationPolicy.spaces(4).indent("   hello", 3), "                hello");
    t.is(IndentationPolicy.tabs(2).indent("    hello", 2), "\t\t\t\thello");

    t.is(IndentationPolicy.spaces(3).unindent("   hello"), "hello");
    t.is(IndentationPolicy.spaces(3).unindent("    hello"), "   hello");
    t.is(IndentationPolicy.spaces(3).unindent("  hello"), "hello");
    t.is(IndentationPolicy.spaces(3).unindent("      hello", 2), "hello");
    t.is(IndentationPolicy.spaces(3).unindent("      hello", 200), "hello");
    t.is(IndentationPolicy.tabs(4).unindent("    \thello"), "\thello");
    t.is(IndentationPolicy.tabs(4).unindent("\t\t\t\thello", 3), "\thello");
    t.is(IndentationPolicy.tabs(4).unindent("\t\t\t\thello", 5), "hello");
});

 