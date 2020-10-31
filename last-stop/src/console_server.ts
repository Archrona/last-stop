// console_server.ts
//   Maintains and talks to the speech console, an external C# process.
//   Listens for JSON over HTTP.

import express, { Express } from 'express';

import { Main } from './main';
import { execFile, ChildProcess } from "child_process";
import { createServer, Server } from 'http';
import axios, { AxiosResponse } from 'axios';
import { inspect } from "util";

const PORT = 6000;
const CONSOLE_PORT = 6001;
export const SPEECH_CONSOLE_CLOSED_RESPAWN_DELAY = 200;
const SERVER_RESTART_DELAY = 200;
const CONSOLE_URI = `http://localhost:${CONSOLE_PORT}/`

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
                this.app.controller.onConsoleSpeech(spokenText);
                break;

            case "copyAndErase":
                this.app.controller.onConsoleCopyAndErase();
                break;

            // case "commitChanges":
            //     this.app.controller.onConsoleCommitChanges();
            //     break;

            case "reloadData":
                this.app.controller.onReloadData();
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
            this.app.controller.onConsoleExit();
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

    postRequest(
        endpoint: string,
        json: any,
        success: (x: any) => any = (x) => {},
        failure: (x: any) => any = (x) => { console.log("postRequest: POST " + inspect(json) + " failed"); }
    ): Promise<AxiosResponse<any>> {
        return axios.post(CONSOLE_URI + endpoint, json).then(success, failure);
    }

    requestCommit(success?: (x: any) => any) {
        this.postRequest("requestCommit", {}, success);
    }

    focus() {
        // impose a 100 ms delay to prevent subsequent input events
        // to a renderer window from stealing focus BACK if this message
        // completes quickly
        setTimeout(() => {
            this.postRequest("focus", {});
        }, 100);
    }
}