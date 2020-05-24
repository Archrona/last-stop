import { getRGB, binarySearchSparse, splitIntoLines, listsContainSameElements, arrayEquals } from "../src/shared";
import test from "ava";

test("getRGB", t => {
    t.is(getRGB(20, 40, 60), "rgb(20,40,60)");
})

test("sparse binary search", t => {
    for (let trials = 0; trials < 100; trials++) {
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
