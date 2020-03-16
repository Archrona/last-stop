// shared.ts
//   Definitions and utility classes common to both client and server.

export function getRGB(red: number, green: number, blue: number) {
    return "rgb(" + red + "," + green + "," + blue + ")";
}

export class DrawableText {
    text: string;
    row: number;
    column: number;
    foreground: string;
    background: string | null;

    constructor(text: string, row: number, column: number, foreground: string, background: string | null) {
        this.text = text;
        this.row = row;
        this.column = column;
        this.foreground = foreground;
        this.background = background;
    }
}

