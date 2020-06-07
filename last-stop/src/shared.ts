// shared.ts
//   Definitions and utility classes common to both client and server.

import { DocumentNavigator } from "./model";

export const INSERTION_POINT = "□";

export const ESCAPE_START = "▸";
export const ESCAPE_END = "◂";
export const ESCAPE_SPLIT = "‖";
export const ESCAPE_SUBSPLIT = "′";
export const ESCAPE_KEY = "κ";
export const ESCAPE_MOUSE = "μ";
export const ESCAPE_SCROLL = "σ";
export const ESCAPE_DRAG = "δ";

export function getRGB(red: number, green: number, blue: number) {
    return "rgb(" + red + "," + green + "," + blue + ")";
}

export function replaceAll(s: string, from: string, to: string): string {
    let result = "";
    let i = 0;

    if (from.length <= 0)
        return s;

    while (i < s.length) {
        if (s.substring(i, i + from.length) === from) {
            result += to;
            i += from.length;
        }
        else {
            result += s[i];
            i += 1;
        }
    }
    
    return result;
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
    biasEqualAfter = true
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
        const nav = doc.clone().goKey("lines");
        const len = nav.getLength();
        const result = this.clone();

        if (result.row < 0) { 
            result.row = 0; 
            result.column = 0;
        }
        else if (result.row >= len) {
            result.row = len - 1; 
            result.column = nav.goIndex(result.row).getString().length;
        } else {
            const cols = nav.goIndex(result.row).getString().length;
            if (result.column < 0) result.column = 0;
            if (result.column > cols) result.column = cols;
        }
        
        return result;
    }

    static min(p1: Position, p2: Position) {
        return p1.compareTo(p2) <= 0 ? p1 : p2;
    }

    static max(p1: Position, p2: Position) {
        return p1.compareTo(p2) <= 0 ? p2 : p1;
    }

    static order(p1: Position, p2: Position) {
        if (p1.compareTo(p2) <= 0) {
            return [p1, p2];
        } else {
            return [p2, p1];
        }
    }

    static orderNormalize(p1: Position, p2: Position, doc: DocumentNavigator) {
        const result1 = p1.normalize(doc);
        const result2 = p2.normalize(doc);

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
        this.spacesRe = new RegExp(" ".repeat(this.spacesPerTab), "mgu");
    }
    
    static tabs(quantity: number): IndentationPolicy {
        return new IndentationPolicy(false, quantity);
    }
    
    static spaces(quantity: number): IndentationPolicy {
        return new IndentationPolicy(true, quantity);
    }

    static splitMarginContent(line: string): [string, string] {
        const match = line.match(/^(\s*)(.*)$/);
        const leadingWhite = match[1];
        const trailingContent = match[2];
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

    normalizeWhite(s: string): string {
        if (this.useSpaces) {
            let result = s.replace(/\t/g, " ".repeat(this.spacesPerTab));
            const remainder = result.length % this.spacesPerTab;
            if (remainder !== 0) {
                result += " ".repeat(this.spacesPerTab - remainder);
            }
            return result;
        }
        else {
            const result = s.replace(this.spacesRe, "\t");
            return result.replace(/ +/g, "\t");
        }
    }  

    normalize(s: string): string {
        const [leadingWhite, trailingContent] = IndentationPolicy.splitMarginContent(s);

        return this.normalizeWhite(leadingWhite) + trailingContent;
    }

    indent(s: string, times = 1): string {
        let [leading, trailing] = IndentationPolicy.splitMarginContent(s);
        leading = this.normalizeWhite(leading);
        
        if (this.useSpaces) {
            leading += " ".repeat(times * this.spacesPerTab);
        }
        else {
            leading += "\t".repeat(times);
        }
        
        return leading + trailing;
    }

    unindent(s: string, times = 1): string {
        let [leading, trailing] = IndentationPolicy.splitMarginContent(s);
        leading = this.normalizeWhite(leading);
        
        if (this.useSpaces) {
            leading = leading.substring(0, Math.max(0, leading.length - times * this.spacesPerTab));
        }
        else {
            leading = leading.substring(0, Math.max(0, leading.length - times));
        }
        
        return leading + trailing;
    }  
    
    getMarginColumns(margin: string): number {
        let count = 0;
        
        for (const c of margin) {
            if (c === ' ') {
                count++;
            } else if (c === '\t') {
                count += this.spacesPerTab;
            } else {
                break;
            }
        }

        return count;
    }

    getTab(): string {
        if (this.useSpaces) {
            return " ".repeat(this.spacesPerTab);
        } else {
            return "\t";
        }
    }
}
 