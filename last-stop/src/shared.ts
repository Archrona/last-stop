// shared.ts
//   Definitions and utility classes common to both client and server.

export class Color {
    red: number;
    green: number;
    blue: number;
    
    constructor(red: number, green: number, blue: number) {
        this.red = red;
        this.green = green;
        this.blue = blue;
    }
}

export class DrawableText {
    text: string;
    row: number;
    column: number;
    foreground: Color;
    background: Color;

    constructor(text: string, row: number, column: number, foreground: Color, background: Color) {
        this.text = text;
        this.row = row;
        this.column = column;
        this.foreground = foreground;
        this.background = background;
    }
}

