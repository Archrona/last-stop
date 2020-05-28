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
const SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY = 1000;
const SERVER_RESTART_DELAY = 1000;


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
            if (request.body.text !== undefined) {
                const spokenText = request.body.text.toString();

                // TODO PATCH IN
                //app.commands.onSpokenText(spokenText);
            }
             
            response.send("ok");
        });

        this.nodeServer = null;
        this.startServer();

        this.consoleProcess = null;
        this.spawnConsoleProcess();
    }

    spawnConsoleProcess() {
        if (this.consoleProcess !== null)
            return;

        this.consoleProcess = execFile("../SpeechConsole/SpeechConsole.exe");
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