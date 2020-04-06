// renderer.ts
//   Main client-side entry point.

import './index.css';
import { ipcRenderer } from 'electron';
import { DrawableText } from "./shared";

class Application {
    id: number;
    canvas: HTMLCanvasElement;
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


        this.canvas.addEventListener("mousedown", (event) => {
            this.onMouseEvent("down", event.offsetX, event.offsetY, event.button);
            event.preventDefault();
        });
        
        this.canvas.addEventListener("mouseup", (event) => {
            this.onMouseEvent("up", event.offsetX, event.offsetY, event.button);
            event.preventDefault();
        });
        
        window.addEventListener("keydown", (event) => {
            this.onKeyboardEvent("down", event.key, event.shiftKey, event.ctrlKey, event.altKey, event.metaKey);
            event.preventDefault();
        });
        
        window.addEventListener("keyup", (event) => {
            this.onKeyboardEvent("up", event.key, event.shiftKey, event.ctrlKey, event.altKey, event.metaKey);
            event.preventDefault();
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

    onMouseEvent(type: string, domX: number, domY: number, button: number) {
        const pixelX = domX * window.devicePixelRatio;
        const pixelY = domY * window.devicePixelRatio;
        
        const row = Math.floor((pixelY - this.margin) / this.lineHeight);
        const column = Math.floor((pixelX - this.margin) / this.charWidth);
        
        this.sendMouseMessage(type, button, row, column);
    }  

    onKeyboardEvent(type: string, key: string, shift: boolean, control: boolean, alt: boolean, meta: boolean) {
        let modifiers = [];
        if (shift) {
            modifiers.push("shift");
        }
        if (control) {
            modifiers.push("control");
        }
        if (alt) {
            modifiers.push("alt");
        }
        if (meta) {
            modifiers.push("meta");
        }
        
        this.sendKeyboardMessage(type, key, modifiers);
    }  
    
    getGraphics() {
        let graphics = this.canvas.getContext("2d");
        graphics.font = (this.fontSize * window.devicePixelRatio) + "px " + this.fontFace;
        return graphics;
    }

    render() {
        const context = this.getGraphics();

        context.textBaseline = "top";
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (const text of this.text) {
            const x = this.charWidth * text.column + this.margin;
            const y = this.lineHeight * text.row + this.margin;

            if (text.background !== null) {
                const bky = this.lineHeight * text.row + this.margin;
                context.fillStyle = text.background;
                context.fillRect(x, bky, this.charWidth * text.text.length, this.lineHeight);
            }

            context.fillStyle = text.foreground;
            context.fillText(text.text, x, y);
        }
    }

    onResize() {
        this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
        
        const graphics = this.getGraphics();
        
        this.charWidth = graphics.measureText("w").width;
        this.charHeight = this.fontSize * window.devicePixelRatio;
        this.lineHeight = this.charHeight * this.lineSpacing;

        this.lineCount = Math.floor((this.canvas.height - this.margin * 2) / this.lineHeight);
        this.columnCount = Math.floor((this.canvas.width - this.margin * 2) / this.charWidth) - 1;

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

    sendMouseMessage(type: string, button: number, row: number, column: number) {
        if (this.id === - 1) {
            return;
        }
        
        ipcRenderer.send("mouse", {
            id: this.id,
            type: type,
            button: button,
            row: row,
            column: column
        });
    }
    
    sendKeyboardMessage(type: string, key: string, modifiers: Array<string>) {
        if (this.id === -1) {
            return;
        }
        
        ipcRenderer.send("key", {
            id: this.id,
            type: type,
            key: key,
            modifiers: modifiers
        });
    }
} 

window["app"] = new Application();
