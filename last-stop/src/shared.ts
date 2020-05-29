// shared.ts
//   Definitions and utility classes common to both client and server.

import { DocumentNavigator } from "./model";

export const INSERTION_POINT = "▢";

export function getRGB(red: number, green: number, blue: number) {
    return "rgb(" + red + "," + green + "," + blue + ")";
}

export function splitIntoLines(str: string) {
    const re = /\r\n|\n|\r/;
    return str.split(re);
}

export function arrayEquals<T>(first: Array<T>, second: Array<T>): boolean {
    if (first.length !== second.length) {
        return false;
    }
    
    for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) {
            return false;
        }
    }
    
    return true;
}
 

export function listsContainSameElements(x: Array<any>, y: Array<any>) {
    if (x.length !== y.length) {
        return false;
    }
    for (const item of x) {
        if (!y.includes(item)) {
            return false;
        }
    }
    return true;
}

// getIndex(n) = i and getIndex(n + 1) = k iff
//    we should return n for i <= target < k   (if biasEqualAfter is true)
//                        or i < target <= k   (if biasEqualAfter is false)
export function binarySearchSparse(
    left: number,
    right: number,
    target: number,
    getIndex: (number) => number,
    biasEqualAfter: boolean = true
): number {
    const length = right;

    if (!biasEqualAfter) {
        target -= 1;
    }

    while (left <= right) {
        const middle = Math.floor((left + right) / 2);

        // Is the insertion point at or right of middle?
        const leftPredicate = (middle === 0 || getIndex(middle - 1) <= target);
        const rightPredicate = (middle < length && getIndex(middle) <= target);

        if (leftPredicate && !rightPredicate) {
            return middle - 1;
        }
        else if (!leftPredicate) {
            right = middle - 1;
        }
        else {
            left = middle + 1;
        }
    }

    throw new Error("getLineContext: binary search failed");
}


export class Position {
    row: number;
    column: number;

    constructor(row: number, column: number) {
        this.row = row;
        this.column = column;
    }

    clone() {
        return new Position(this.row, this.column);
    }

    compareTo(other: Position) {
        if (this.row < other.row || (this.row === other.row && this.column < other.column)) {
            return -1;
        }
        if (this.row === other.row && this.column === other.column) {
            return 0;
        }
        return 1;
    }

    normalize(doc: DocumentNavigator): Position {
        let nav = doc.clone().goKey("lines");
        let len = nav.getLength();
        let result = this.clone();

        if (result.row < 0) { 
            result.row = 0; 
            result.column = 0;
        }
        else if (result.row >= len) {
            result.row = len - 1; 
            result.column = nav.goIndex(result.row).getString().length;
        } else {
            let cols = nav.goIndex(result.row).getString().length;
            if (result.column < 0) result.column = 0;
            if (result.column > cols) result.column = cols;
        }
        
        return result;
    }

    static order(p1: Position, p2: Position) {
        if (p1.compareTo(p2) <= 0) {
            return [p1, p2];
        } else {
            return [p2, p1];
        }
    }

    static orderNormalize(p1: Position, p2: Position, doc: DocumentNavigator) {
        let result1 = p1.normalize(doc);
        let result2 = p2.normalize(doc);

        return this.order(result1, result2);
    }
}

export class DrawableText {
    text: string;
    special: string;
    row: number;
    column: number;
    foreground: string;
    background: string | null;

    constructor(text: string, special: string, row: number, column: number, foreground: string, background: string | null) {
        this.text = text;
        this.special = special;
        this.row = row;
        this.column = column;
        this.foreground = foreground;
        this.background = background;
    }
}

export class IndentationPolicy {
    useSpaces: boolean;
    spacesPerTab: number;
    spacesRe: RegExp;
    
    private constructor(useSpaces: boolean, quantity: number) {
        this.useSpaces = useSpaces;
        this.spacesPerTab = quantity;
        this.spacesRe = new RegExp(" ".repeat(this.spacesPerTab), "g");
    }
    
    static tabs(quantity: number): IndentationPolicy {
        return new IndentationPolicy(false, quantity);
    }
    
    static spaces(quantity: number): IndentationPolicy {
        return new IndentationPolicy(true, quantity);
    }

    static splitMarginContent(line: string): [string, string] {
        let match = line.match(/^(\s*)(.*)$/);
        let leadingWhite = match[1];
        let trailingContent = match[2];
        return [leadingWhite, trailingContent];
    } 

    toString(): string {
        if (this.useSpaces) {
            return "Spaces: " + this.spacesPerTab;
        }
        else {
            return "Tabs: " + this.spacesPerTab + " sp/tab";
        }
    }

    normalize(s: string): string {
        let [leadingWhite, trailingContent] = IndentationPolicy.splitMarginContent(s);
  
        if (this.useSpaces) {
            let result = leadingWhite.replace(/\t/g, " ".repeat(this.spacesPerTab));
            let remainder = result.length % this.spacesPerTab;
            if (remainder !== 0) {
                result += " ".repeat(this.spacesPerTab - remainder);
            }
            return result + trailingContent;
        }
        else {
            let result = leadingWhite.replace(this.spacesRe, "\t");
            return result.replace(/ +/g, "\t") + trailingContent;
        }
    }  
}
 