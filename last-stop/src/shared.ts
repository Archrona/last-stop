// shared.ts
//   Definitions and utility classes common to both client and server.

import { DocumentNavigator } from "./model";

export enum InputMode {
    Speech,
    Direct
}

export function getRGB(red: number, green: number, blue: number) {
    return "rgb(" + red + "," + green + "," + blue + ")";
}

export function splitIntoLines(str: string) {
    const re = /\r\n|\n|\r/;
    return str.split(re);
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

