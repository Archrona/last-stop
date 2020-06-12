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
    context: string;

    resizeTimeout: number;

    // hasFocus: boolean;
    
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
        this.lineSpacing = 1.35;
        this.margin = 20;
        this.resizeTimeout = 0;
        this.context = "";

        this.isLoaded = false;
        // this.hasFocus = false;
        
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
            this.onMouseEvent("down", event.offsetX, event.offsetY, event.button, event.buttons);
            event.preventDefault();
        });
        
        this.canvas.addEventListener("mouseup", (event) => {
            this.onMouseEvent("up", event.offsetX, event.offsetY, event.button, event.buttons);
            event.preventDefault();
        });

        this.canvas.addEventListener("mousemove", (event) => {
            this.onMouseEvent("move", event.offsetX, event.offsetY, -1, event.buttons);
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

        window.addEventListener("wheel", (event) => {
            this.onWheelEvent(event.deltaX, event.deltaY, event.deltaMode);
            event.preventDefault();
        });
        
        ipcRenderer.on("update", (event, data) => {
            const subscription = data.subscription;
            const text = data.text as Array<DrawableText>;
            const expectedLines = data.lines;
            const expectedColumns = data.columns;
            const accentColor = data.modeAccent as string;
            
            if (expectedLines !== this.lineCount || expectedColumns !== this.columnCount) {
                this.sendResizeMessage();
            }
            else {
                this.onUpdate(subscription, text, accentColor, data);
            }
        });
    }

    onUpdate(subscription: string, text: Array<DrawableText>, accentColor: string, data: any) {
        console.log("update: " + subscription + ", " + text.length + " DrawableText objects");
        this.text = text;
        this.subscription = subscription;
        this.context = data.context as string;
        document.getElementById("subscription").innerText = this.subscription;
        document.getElementById("top").style.borderColor = accentColor;
        document.getElementById("context").innerText = this.context;
        
 
        this.render();
    }

    onMouseEvent(type: string, domX: number, domY: number, button: number, buttons: number) {
        const pixelX = domX * window.devicePixelRatio;
        const pixelY = domY * window.devicePixelRatio;

        let buttonList = [];
        if ((buttons & 0x01) !== 0) buttonList.push(0);
        if ((buttons & 0x02) !== 0) buttonList.push(2);
        if ((buttons & 0x04) !== 0) buttonList.push(1);
        if ((buttons & 0x08) !== 0) buttonList.push(3);
        if ((buttons & 0x10) !== 0) buttonList.push(4);
        
        const row = Math.floor((pixelY - this.margin) / this.lineHeight);
        const column = Math.floor((pixelX - this.margin) / this.charWidth + 0.5);

        this.sendMouseMessage(type, button, row, column, buttonList);
    }  

    onKeyboardEvent(type: string, key: string, shift: boolean, control: boolean, alt: boolean, meta: boolean) {
        const modifiers = [];
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

    onWheelEvent(x: number, y: number, mode: number): void {
        if (mode === 0) {
            const ratio = window.devicePixelRatio / this.lineHeight;
            x *= ratio;
            y *= ratio;
        }
        
        this.sendScrollMessage(x, y);
    } 

    getGraphics() {
        const graphics = this.canvas.getContext("2d");
        graphics.font = (this.fontSize * window.devicePixelRatio) + "px " + this.fontFace;
        return graphics;
    }

    render() {
        const context = this.getGraphics();

        context.textBaseline = "top";
        context.fillStyle = "rgb(20,20,20)";
        context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (const text of this.text) {
            const x = this.charWidth * text.column + this.margin;
            const y = this.lineHeight * text.row + this.margin;

            if (text.background !== null) {
                const bky = this.lineHeight * text.row + this.margin;
                context.fillStyle = text.background;
                context.fillRect(x, bky, this.charWidth * text.text.length, this.lineHeight);
            }

            if (text.special !== "") {
                const parts = text.special.split("@");
                if (parts[0] === "token") {
                    const count = parseInt(parts[1]);
                    context.fillStyle = parts[2];
                    for (let c = 0; c < count; c++) {
                        context.beginPath();
                        context.arc(x + 0.35 * this.charWidth + 9 * c, y + this.charHeight * 1.1, 3, 0, Math.PI * 2);
                        context.fill();
                    }
                } else if (parts[0] === "anchor") {
                    context.lineWidth = 3;
                    context.strokeStyle = text.foreground;
                    context.beginPath();
                    context.moveTo(x, y - (this.lineHeight - this.charHeight) * 0.5);
                    context.lineTo(x, y + this.lineHeight - (this.lineHeight - this.charHeight) * 0.5);
                    context.stroke();
                } else if (parts[0] === "selection") {
                    const leftColumn = parseInt(parts[1]);
                    const rightColumn = parseInt(parts[2]);

                    const left = this.charWidth * leftColumn + this.margin;
                    const right = this.charWidth * rightColumn + this.margin;
                    const top = y - (this.lineHeight - this.charHeight) * 0.5;
                    const bottom = top + this.lineHeight + 1;
 
                    context.fillStyle = text.foreground;
                    context.fillRect(left, top, right - left, bottom - top);
                }
                 
            }

            context.fillStyle = text.foreground;
            context.fillText(text.text, x, y);
        }
    }

    onResize() {
        if (this.resizeTimeout > 0) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
            this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
            this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
            
            const graphics = this.getGraphics();
            
            this.charWidth = graphics.measureText("w").width;
            this.charHeight = this.fontSize * window.devicePixelRatio;
            this.lineHeight = this.charHeight * this.lineSpacing;
    
            this.lineCount = Math.floor((this.canvas.height - this.margin * 2) / this.lineHeight);
            this.columnCount = Math.floor((this.canvas.width - this.margin * 2) / this.charWidth) - 1;
    
            this.sendResizeMessage();
        }, 100) as unknown as number;

        
    }

    sendResizeMessage() {
        if (this.id === -1) return;

        ipcRenderer.send("resize", {
            id: this.id,
            lines: this.lineCount,
            columns: this.columnCount
        });
    }

    sendMouseMessage(type: string, button: number, row: number,
        column: number, buttons: Array<number>)
    {
        if (this.id === -1) {
            return;
        }
        
        ipcRenderer.send("mouse", {
            id: this.id,
            type: type,
            button: button,
            row: row,
            column: column,
            buttons: buttons
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

    sendScrollMessage(x: number, y: number): void {
        if (this.id === -1) {
            return;
        }
        
        ipcRenderer.send("scroll", {
            id: this.id,
            x: x,
            y: y
        });
    }
} 

window["app"] = new Application();
