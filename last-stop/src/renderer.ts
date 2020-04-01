// renderer.ts
//   Main client-side entry point.

import './index.css';
import { ipcRenderer, ipcMain } from 'electron';
import { getRGB, DrawableText } from "./shared";

class Application {
    id: number;
    canvas: HTMLCanvasElement;
    backBuffer: HTMLCanvasElement | null;
    subscription: string;

    fontFace: string;
    fontSize: number;
    lineSpacing: number;
    lineCount: number;
    columnCount: number;    
    charWidth: number;
    charHeight: number;
    lineHeight: number;
    margin: number;
    text: Array<DrawableText>;
    isLoaded: boolean;
    
    constructor() {
        this.canvas = null;
        this.backBuffer = null;
        this.id = -1;
        this.subscription = "";
        this.fontFace = "Consolas";
        this.fontSize = 16;
        this.lineCount = 0;
        this.columnCount = 0;
        this.charWidth = 0;
        this.charHeight = 0;
        this.lineHeight = 0;
        this.lineSpacing = 1.25;
        this.margin = 20;
        this.isLoaded = false;
        
        this.registerPreloadHandlers();
    }
    
    registerPreloadHandlers() {
        window.addEventListener("load", (event) => {
            this.canvas = document.getElementById("content") as HTMLCanvasElement;
            this.isLoaded = true;

            this.onMaybeLoaded();
        });
        
        ipcRenderer.on("setId", (event, id) => {
            this.id = id;
            document.getElementById("id").innerText = "#" + this.id;

            this.onMaybeLoaded();
        });
    }

    onMaybeLoaded() {
        if (this.isLoaded && this.id !== -1) {
            this.registerPostloadHandlers();

            this.onResize();
            ipcRenderer.send("ready", {id: this.id});
        }
    }

    registerPostloadHandlers() {
        window.addEventListener("resize", (event) => {
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

        document.getElementById("subscription").innerText = this.subscription;
        this.render();
    }
    
    getGraphics(isFront: boolean) {
        let graphics = (isFront ? this.canvas : this.backBuffer).getContext("2d");
        graphics.font = (this.fontSize * window.devicePixelRatio) + "px " + this.fontFace;
        return graphics;
    }

    render() {
        const back = this.getGraphics(true);

        back.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const text of this.text) {
            const x = this.charWidth * text.column + this.margin;
            const y = this.lineHeight * text.row + this.charHeight + this.margin;

            if (text.background !== null) {
                const bky = this.lineHeight * text.row + this.margin;
                back.fillStyle = text.background;
                back.fillRect(x, bky, this.charWidth * text.text.length, this.lineHeight);
            }

            back.fillStyle = text.foreground;
            back.fillText(text.text, x, y);
        }

        //const front = this.getGraphics(true);
        //front.drawImage(this.backBuffer, 0, 0);
    }

    onResize() {
        this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;

        const graphics = this.getGraphics(true);
        
        this.charWidth = graphics.measureText("w").width;
        this.charHeight = this.fontSize * window.devicePixelRatio;
        this.lineHeight = this.charHeight * this.lineSpacing;

        this.lineCount = Math.floor((this.canvas.height - this.margin * 2) / this.lineHeight);
        this.columnCount = Math.floor((this.canvas.width - this.margin * 2) / this.charWidth);

        if (this.backBuffer === null) {
            this.backBuffer = document.createElement('canvas');
            this.backBuffer.width = this.canvas.width;
            this.backBuffer.height = this.canvas.height;
        }

        this.sendResizeMessage();
    }

    sendResizeMessage() {
        if (this.id === -1) return;

        ipcRenderer.send("resize", {
            id: this.id,
            lines: this.lineCount,
            columns: this.columnCount
        });
    }
} 

let app;

app = new Application();
