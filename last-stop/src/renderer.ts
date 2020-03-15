
import './index.css';
import { ipcRenderer, ipcMain } from 'electron';

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

