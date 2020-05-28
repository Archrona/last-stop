
// Commands consist of a sequence of tokens
// Tokens may be:
//    A literal string ("if", "-", "1")
//    "$location" (parsed elsewhere - ex. "13.5", "all of 100", "left margin")
//    "$identifier" (parsed elsewhere - ex. "tower pick 134 hello there")
//    "$please" (parsed elsewhere - ex. "blah blah 145 if blah please")

import { Main } from "./main";
import * as fs from "fs";
import { Executor, EXECUTORS } from "./speech";

const COMMANDS_FILENAME = "commands.json";

interface CommandType {
    spoken: Array<string>,
    run?: string,
    insert?: string,
    arguments?: Array<string>
}
 
interface CommandGroupType {
    group: string,
    commands: Array<CommandType>
}

type CommandsFile = Array<CommandGroupType>;



export class Command {
    tokens: Array<string>;
    command: Executor;
    args: Array<string>;

    constructor(tokens: Array<string>, command: Executor, args: Array<string>) {
        this.tokens = tokens;
        this.command = command;
        this.args = args;
    }
}


export class CommandList {
    // Grouped by first token, which is always a literal word
    commandIndex: Map<string, Array<Command>>;

    constructor(app: Main, context: string, commands: CommandsFile) {
        this.commandIndex = new Map<string, Array<Command>>();

        const ctx = app.languages.contexts.get(context);
        
        for (const groupName of ctx.commands) {
            for (const commandGroup of commands) {
                if (commandGroup.group === groupName) {
                    for (const command of commandGroup.commands) {
                        this._addCommand(command);
                    }
                }
            }
        }

        let keys = Array.from(this.commandIndex.keys());
        for (const k of keys) {
            this.commandIndex.set(k, this.commandIndex.get(k).sort((a, b) => {
                return b.tokens.length - a.tokens.length;
            }));
        }
    }

    private _addCommand(c: CommandType): void {
        for (const spoken of c.spoken) {
            const words = spoken.trim().toLowerCase().split(/\s+/);

            if (words.length <= 0) {
                throw new Error("Found empty command, can't parse");
            }

            let command: Command;
            if (c.run !== undefined) {
                let ex = EXECUTORS[c.run];
                if (ex === undefined) {
                    throw new Error("Could not find run command " + c.run);
                }

                let args = c.arguments;
                if (args === undefined) {
                    args = [];
                }

                command = new Command(words, ex, args);
            }
            else {
                let ins = c.insert;
                if (ins === undefined) {
                    throw new Error("Could not find insert for " + spoken);
                }

                let args = [ins];
                for (const w of words) {
                    if (w[0] === "$") {
                        args.push("$" + (args.length));
                    }
                }

                command = new Command(words, EXECUTORS.insert, args);
            }

            const first = words[0];
            if (this.commandIndex.has(first)) {
                this.commandIndex.get(first).push(command);
            } else {
                this.commandIndex.set(first, [command]);
            }
        }
    }
}


export class Commands {
    app: Main;
    languages: Map<string, CommandList>
    commandsFile: CommandsFile

    constructor(app: Main) {
        this.app = app;

        this.commandsFile = 
            JSON.parse(fs.readFileSync(COMMANDS_FILENAME).toString()) as CommandsFile;

        const contexts = app.languages.contexts;

        this.languages = new Map();

        for (const [contextName, ctx] of contexts) {
            this.languages.set(contextName,
                new CommandList(app, contextName, this.commandsFile));
        }
    }

}