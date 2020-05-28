// speech.ts

import { TokenizeResult, Token } from "./language";
import { Main } from "./main";
import { Position } from "./shared";
import { Model, DocumentNavigator } from "./model";
import { CommandList, Command } from "./commands";


export type Executor = (model: Model, args: Array<any>) => void

export const EXECUTORS = {
    nop: (model: Model, args: Array<any>) => {
        // literally do nothing
    },

    skip: (model: Model, args: Array<any>) => {

    },

    go: (model: Model, args: Array<any>) => {

    },

    insert: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0]);
        })
    },

    insertExact: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0]);
        })
    },
}

class Executed {
    constructor(
        public first: number,
        public length: number,
        public executor: Executor,
        public args: Array<any>,
        public undoIndex: number,
        public context: string) {}
}

enum Capitalization {
    Raw,
    Lower,
    First,
    Upper
}

enum Glue {
    None,
    Underscores,
    Dashes
}

class Casing {
    constructor(
        public firstCaps: Capitalization,
        public laterCaps: Capitalization,
        public glue: Glue
    ) { }

    clone() {
        return new Casing(this.firstCaps, this.laterCaps, this.glue);
    }

    applyCaps(s: string, c: Capitalization): string {
        if (c === Capitalization.Raw) {
            return s;
        } else if (c === Capitalization.First) {
            return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
        } else if (c === Capitalization.Lower) {
            return s.toLowerCase();
        } else if (c === Capitalization.Upper) {
            return s.toUpperCase();
        } else {
            throw new Error("Unexpected capitalization");
        }
    }

    getGlue(): string {
        if (this.glue === Glue.None) {
            return "";
        } else if (this.glue === Glue.Underscores) {
            return "_";
        } else {
            return "-";
        }
    }

    append(original: string, next: string) {
        if (original.length <= 0) {
            return this.applyCaps(next, this.firstCaps);
        } else {
            return original + this.getGlue() + this.applyCaps(next, this.laterCaps);
        }
    }
}

const CASING = new Map<string, Casing>([
    ["flat", new Casing(Capitalization.Lower, Capitalization.Lower, Glue.None)],
    ["snake", new Casing(Capitalization.Lower, Capitalization.Lower, Glue.Underscores)],
    ["camel", new Casing(Capitalization.Lower, Capitalization.First, Glue.None)],
    ["big", new Casing(Capitalization.First, Capitalization.First, Glue.None)],
    ["great", new Casing(Capitalization.First, Capitalization.First, Glue.None)],
    ["tower", new Casing(Capitalization.Upper, Capitalization.Upper, Glue.Underscores)],
    ["shout", new Casing(Capitalization.Upper, Capitalization.Upper, Glue.None)],
    ["midline", new Casing(Capitalization.Lower, Capitalization.Lower, Glue.Dashes)],
]);

const TAKE = new Map<string, number>([
    ["lonely", 1],
    ["couple", 2],
    ["triple", 3],
    ["quadruple", 4]
]);

export class Speech {
    speech: string;
    undone: boolean;

    baseUndoIndex: number;
    finalUndoIndex: number;

    app: Main;
    tokens: Array<Token>;

    executed: Array<Executed>;

    private constructor(app: Main, speech: string) {
        this.app = app;
        this.speech = speech;
        this.undone = false;
        this.baseUndoIndex = this.getUndoIndex();
        this.finalUndoIndex = this.baseUndoIndex;   // overwritten after execution
        this.executed = [];

        this.tokenize();
        this.run();

        this.finalUndoIndex = app.model.store.getUndoCount();
    }

    static execute(app: Main, speech: string): Speech {
        let result = new Speech(app, speech);
        
        return result;
    }

    private getContext(): string {
        return this.app.model.getCurrentContext();
    }

    private getUndoIndex(): number {
        return this.app.model.store.getUndoCount();
    }

    private getCommandList(context: string): CommandList {
        return this.app.commands.languages.get(context);  
    }

    private getDefaultCasing(context: string): Casing {
        let name = this.app.languages.contexts.get(context).defaultCasing;
        
        let casing = CASING.get(name);
        if (casing === undefined) {
            throw new Error("getDefaultCasing: Unrecognized casing name \"" + name + "\"");
        }

        return casing.clone();
    }

    private getRawInput(context: string): boolean {
        return this.app.languages.contexts.get(context).rawInput;
    }

    undo(): void {
        if (this.app.model.store.getUndoCount() !== this.finalUndoIndex) {
            throw new Error("Undo requested but final undo count does not match");
        }

        if (this.undone) {
            throw new Error("Can't undo twice");
        }

        this.app.model.store.undo(this.finalUndoIndex - this.baseUndoIndex);
        this.undone = true;
    }


    private tokenize(): void {
        let result = this.app.languages.tokenize(
            this.speech, ["spoken_text"], new Position(0, 0), true);

        this.tokens = result.tokens;
    }

    private runExecutor(i: number, length: number, executor: Executor,
        args: Array<string>, context: string): Executed
    {
        let undoIndex = this.getUndoIndex();
        executor(this.app.model, args);
        return new Executed(i, length, executor, args, undoIndex, context);
    }

    private runMaybeCommand(i: number, context: string, cmd: Command): Executed {
        const matched = [];

        let j = i;
        let ti = 0;

        while (ti < cmd.tokens.length && j < this.tokens.length) {
            const token = cmd.tokens[ti];

            switch (token) {
                case "$location":
                    return null;

                case "$identifier":
                    return null;

                case "$please":
                    return null;
            }

            if (token === this.tokens[j].text.toLowerCase()) {
                ti++;
                j++;
            } else {
                return null;
            }
        }

        // If we match the command in full, perform it
        if (ti >= cmd.tokens.length) {

            // Remap command matches to arguments
            let args = cmd.args.map((x: any) => {
                if (typeof x === "string" && /^\$\d$/.test(x)) {
                    return matched[parseInt(x[1]) - 1];
                } else {
                    return x;
                }
            });

            return this.runExecutor(i, j - i, cmd.command, args, context);
        } else {
            return null;
        }
    }

    private runMaybeCommandList(
        i: number, context: string, possibleCommands: Array<Command>): Executed
    {
        for (const cmd of possibleCommands) {
            let maybe = this.runMaybeCommand(i, context, cmd);
            if (maybe !== null) {
                return maybe;
            }
        }

        return null;
    }

    private runText(i: number, context: string, cmdList: CommandList): Executed {
        const raw = this.getRawInput(context);
        const word = this.tokens[i].text;

        // Whitespace is significant in raw context only
        if (this.tokens[i].type === "white") {
            if (!raw) {
                return this.runExecutor(i, 1, EXECUTORS.nop, [], context);
            } else {
                return this.runExecutor(i, 1, EXECUTORS.insertExact, [word], context);
            }
        }

        // Numbers and punctuation cannot lead identifiers - they stand alone.
        // Raw also outputs as-is.
        if (raw
            || this.tokens[i].type === "number"
            || this.tokens[i].type === "punctuation")
        {
            return this.runExecutor(i, 1, EXECUTORS.insertExact, [word], context);
        }

        // Folks, we have an identifier
        // Be greedy but stop when we encounter the first word of any user-defined command
        // The term "literally" overrides.
        let j = i;
        let casing = this.getDefaultCasing(context);
        let identifier = "";

        while (j < this.tokens.length) {
            
            const lower = this.tokens[j].text.toLowerCase();

            if (this.tokens[j].type === "punctuation") break;
            if (this.tokens[j].type === "white") {
                j++;
                continue;
            }

            // Break if possibly command.
            // First word is exempt. Always interpret as identifier.
            if (j > i && cmdList.commandIndex.has(lower)) {
                break;
            }

            // Check for literally T
            if (lower === "literally" && j + 1 < this.tokens.length)
            {
                const next = this.tokens[j + 1].text;
                identifier = casing.append(identifier, next);
                j += 2;
                continue;
            }

            // Check for casing commands
            let maybeCasing: Casing;
            if ((maybeCasing = CASING.get(lower)) !== undefined) {
                casing = maybeCasing;
                j++;
                continue;
            }

            // Check for take commands
            let maybeTake: number;
            if ((maybeTake = TAKE.get(lower)) !== undefined) {
                if (j + 1 < this.tokens.length
                    && this.tokens[j + 1].type === "identifier")
                {
                    const next = this.tokens[j + 1].text;
                    identifier = casing.append(identifier, next.substring(0, maybeTake));
                    j += 2;
                    continue;
                }
                else {
                    identifier = casing.append(identifier, word);
                    j++;
                    continue;
                }
            }

            // Check for pick N word
            if (lower === "pick") {
                // /^\d+$/.test(this.tokens[j + 1].text)
                break; // TODO
            }

            // Well, it's got to be an identifier now!
            identifier = casing.append(identifier, this.tokens[j].text);
            j++;
        }
        
        if (identifier.length === 0) {
            return this.runExecutor(i, j - i, EXECUTORS.nop, [], context);
        } else {
            return this.runExecutor(i, j - i, EXECUTORS.insertExact, [identifier], context);
        }
    }

    private runOne(i: number, context: string, cmdList: CommandList): Executed {
        const word = this.tokens[i].text;
        const possibleCommands = cmdList.commandIndex.get(word);

        if (possibleCommands === undefined) {
            return this.runText(i, context, cmdList);
        } else {
            let maybe = this.runMaybeCommandList(i, context, possibleCommands);
            if (maybe !== null) return maybe;

            return this.runText(i, context, cmdList);
        }
    }

    private run(): void {
        let i = 0;

        while (i < this.tokens.length) {
            const context = this.getContext();
            const cmdList = this.getCommandList(context);
            if (cmdList === undefined) {
                throw new Error("run: no command list for context \"" + context + "\"");
            }

            let exec = this.runOne(i, context, cmdList);
            if (exec === null || exec.length <= 0) {
                throw new Error("run: execution must consume at least 1 token");
            }
            
            if (exec.executor !== EXECUTORS.nop)
                this.executed.push(exec);

            
            i += exec.length;
        }
    }

}
