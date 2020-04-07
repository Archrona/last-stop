// shared.ts
//   Definitions and utility classes common to both client and server.

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

