// console_server.ts
//   Maintains and talks to the speech console, an external C# process.
//   Listens for JSON over HTTP on port 5000 (us) and port 5001 (the console).

import { Express } from 'express';
import express from 'express';
import { Main } from './main';
import { execFile, ChildProcess } from "child_process";
import { createServer, Server } from 'http';
import { TouchBarSlider } from 'electron';

const PORT = 5000;
const CONSOLE_PORT = 5001;
const SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY = 200;
const SERVER_RESTART_DELAY = 200;


export class ConsoleServer {
    expressServer: Express;
    nodeServer: Server | null;
    app: Main;
    consoleProcess: ChildProcess | null;

    constructor(app: Main) {
        this.app = app;

        this.expressServer = express();
        this.expressServer.use(express.json());

        this.expressServer.post("/", (request, response) => {
            this.processIncoming(request, response);
        });

        this.nodeServer = null;
        this.startServer();

        this.consoleProcess = null;
        this.spawnConsoleProcess();
    }

    processIncoming(request: any, response: any): void {
        if (request.body.command === undefined) {
            response.send("error: undefined command");
            return;
        }

        switch (request.body.command) {
            case "speech":
                const spokenText = request.body.text.toString();
                this.app.controller.onSpeech(spokenText);
                break;

            case "copyAndErase":
                this.app.controller.onCopyAndErase();
                break;

            case "commitChanges":
                this.app.controller.onCommitChanges();
                break;

            default:
                response.send("error: unrecognized command");
                return;
        }
         
        response.send("ok");
    }

    spawnConsoleProcess() {
        if (this.consoleProcess !== null)
            return;

        this.consoleProcess = execFile("../SpeechConsole/SpeechConsole.exe");

        // TODO what if .exe isn't there, etc
        
        this.consoleProcess.on("exit", (code, signal) => {
            console.log("Console process exited...");
            this.consoleProcess = null;

            setTimeout(() => {
                this.spawnConsoleProcess();
            }, SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY);
        })
    }

    startServer() {
        if (this.nodeServer !== null)
            return;

        this.nodeServer = createServer(this.expressServer);
        this.nodeServer.listen(PORT, "127.0.0.1");

        this.nodeServer.on('listening', function() {
            console.log('Server started!')
        });

        this.nodeServer.on('error', function() {
            console.log('Server errored starting up! Retrying soon...');
            this.nodeServer = null;

            setTimeout(() => { this.startServer(); }, SERVER_RESTART_DELAY);
        })
    }
}