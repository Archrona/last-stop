// renderer.ts
//   Main client-side entry point.

import './index.css';
import { ipcRenderer, ipcMain } from 'electron';
import { Color, DrawableText } from "./shared";


class Application {
    id: number;
    canvas: HTMLCanvasElement;
    subscription: string;

    fontFace: string;
    fontSize: number;
    lineCount: number;
    columnCount: number;    
    charWidth: number;
    charHeight: number;
    text: Array<DrawableText>;
    
    constructor() {
        this.canvas = document.getElementById("content") as HTMLCanvasElement;
        this.id = -1;
        this.subscription = "";
        this.fontFace = "Consolas";
        this.fontSize = 16;
        this.lineCount = 0;
        this.columnCount = 0;
        this.charWidth = 0;
        this.charHeight = 22;
        
        this.registerEventHandlers();
    }
    
    registerEventHandlers() {
        window.addEventListener("resize", (event) => {
            this.onResize();
        });
        
        ipcRenderer.on("setId", (event, id) => {
            this.id = id;
            document.getElementById("id").innerText = "#" + this.id;
            this.onResize();
        });

        ipcRenderer.on("update", (event, data) => {
            const subscription = data.subscription;
            const text = data.text as Array<DrawableText>;
            const expectedLines = data.lines;
            const expectedColumns = data.columns;
            
            if (expectedLines !== this.lineCount || expectedColumns !== this.columnCount) {
                this.sendResizeMessage();
            }
            else {
                this.onUpdate(subscription, text);
            }
        });
    }

    onUpdate(subscription: string, text: Array<DrawableText>) {
        console.log("update: " + subscription + ", " + text.length + " DrawableText objects");
        this.text = text;
        this.subscription = subscription;

        // TODO
    }
    
    onResize() {
        if (this.id === -1) return;

        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

        let graphics = this.canvas.getContext("2d");
        graphics.font = this.fontSize + "px " + this.fontFace;
        
        this.charWidth = graphics.measureText("w").width;
        this.lineCount = Math.floor(this.canvas.height / this.charHeight);
        this.columnCount = Math.floor(this.canvas.width / this.charWidth);

        this.sendResizeMessage();
    }

    sendResizeMessage() {
        ipcRenderer.send("resize", {
            id: this.id,
            lines: this.lineCount,
            columns: this.columnCount
        });
    }
}

window.addEventListener("load", () => {
    const app = new Application();
});

