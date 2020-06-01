// speech.ts

import { TokenizeResult, Token } from "./language";
import { Main } from "./main";
import { Position, INSERTION_POINT } from "./shared";
import { Model, DocumentNavigator, Anchor, DocumentSubscription, LineSubscription } from "./model";
import { CommandList, Command } from "./commands";
import { inspect } from "util";
import * as fs from "fs";

export type Executor = (model: Model, args: Array<any>) => void

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
    ["tower", new Casing(Capitalization.Upper, Capitalization.Upper, Glue.Underscores)],
    ["shout", new Casing(Capitalization.Upper, Capitalization.Upper, Glue.None)],
    ["midline", new Casing(Capitalization.Lower, Capitalization.Lower, Glue.Dashes)],
    ["raw", new Casing(Capitalization.Raw, Capitalization.Raw, Glue.None)]
]);

const TAKE = new Map<string, number>([
    ["lonely", 1],
    ["couple", 2],
    ["triple", 3],
    ["quadruple", 4]
]);



interface AlphabetFile {
    contextual: Array<Array<string>>;
    lower: Array<Array<string>>;
    upper: Array<Array<string>>;
}

class AlphabetEntry {
    constructor(public character: string, public casing: Casing) { }
}

class Alphabet {
    alphabet: Map<string, AlphabetEntry>;
    
    constructor() {
        let data = JSON.parse(
            fs.readFileSync("./specials/alphabet.json").toString()
        ) as AlphabetFile;

        this.alphabet = new Map();

        for (let i = 0, c = 97; i < 26; i++, c++) {
            for (const [list, caps] of [
                [data.contextual, Capitalization.Raw],
                [data.lower, Capitalization.Lower],
                [data.upper, Capitalization.Upper]])
            {
                for (const word of list[i]) {
                    this.alphabet.set(word, 
                        new AlphabetEntry(String.fromCharCode(c), new Casing(
                            caps as Capitalization, caps as Capitalization, Glue.None
                        ))
                    );
                }
            }
        }
    }
}

export const ALPHABET = new Alphabet();



interface RemapFileEntry {
    spoken: string,
    internal: string
}

class Remap {
    replacements: Map<string, string>;
    
    constructor() {
        let data = JSON.parse(
            fs.readFileSync("./specials/remap.json").toString()
        ) as Array<RemapFileEntry>;
        
        this.replacements = new Map();
        
        for (const entry of data) {
            this.replacements.set(entry.spoken, entry.internal);
        }
    }
    
    remap(word: string): string {
        let perhaps = this.replacements.get(word);
        if (perhaps !== undefined) {
            return perhaps;
        }
        return word;
    }
}

export const REMAP = new Remap();



export const EXECUTORS = {
    nop: (model: Model, args: Array<any>) => {
        // literally do nothing
    },

    step: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            let times = 1;
            if (args[0] !== undefined && /^[1-9]$/.test(args[0])) {
                times = parseInt(args[0]);
            }

            for (; times > 0; times--) {
                doc.step(ai);
            }
        })
    },

    go: (model: Model, args: Array<any>) => {
        if (args.length > 0) {
            let location = args[0];

            if (location instanceof SpokenSelection) {
                location.document.setMark(location.anchorIndex, location.mark);
                location.document.setCursor(location.anchorIndex, location.cursor);
                // TODO activate window
            }

            // TODO other kinds of go reference - window, line, etc.
        }
    },

    insert: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0], {
                enforceSpacing: true,
                escapes: true,
                escapeArguments: ["+$1", "+$2", "+$3"]
            });
        });
    },

    insertExact: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.insert(ai, args[0], { enforceSpacing: true });
        });
    },

    insertAtEOL: (model: Model, args: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.setSelectionEOL(ai, true);
            EXECUTORS.insert(model, args);
        });
    }
}

class Executed {
    constructor(
        public first: number,
        public length: number,
        public executor: Executor,
        public args: Array<any>,
        public undoIndex: number,
        public context: string) { }
}

class DeferredWhite {
    constructor(public first: number, public text: string) { }
}




export abstract class SpokenLocation {
    constructor() {
        // do nothing
    }
}

export class SpokenSelection extends SpokenLocation {
    document: DocumentNavigator;
    anchorIndex: number;
    cursor: Position;
    mark: Position;
    
    constructor(document: DocumentNavigator, anchorIndex: number, cursor: Position, mark: Position) {
        super();
        this.document = document;
        this.anchorIndex = anchorIndex;
        this.cursor = cursor;
        this.mark = mark;
    }
}

export class SpokenWindowReference extends SpokenLocation {
    window: number;
    
    constructor(window: number) {
        super();
        this.window = window;
    }
}

export class SpokenLineReference extends SpokenWindowReference {
    line: number;

    constructor(window: number, line: number) {
        super(window);
        this.line = line;
    }
}

export class SpokenTokenReference extends SpokenLineReference {
    token: number;
    
    constructor(window: number, line: number, token: number) {
        super(window, line);
        this.token = token;
    }
}

class NumericReference {
    private _line: number | null;
    private _token: number | null;
    
    constructor(line: number | null, token: number | null) {
        this._line = line;
        this._token = token;
    }
    
    getLine(): number | null { return this._line; } 
    getToken(): number | null { return this._token; } 
    
    hasLine(): boolean { return this._line !== null; } 
    hasToken(): boolean { return this._token !== null; } 
}

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

    private consumeWhite(index: number): number {
        while (index < this.tokens.length && this.tokens[index].type === "white") {
            index++;
        }

        return index;
    }

    private convertNumericIntoLocation(numeric: NumericReference): SpokenLocation {

        // Try to parse a plain number as a window reference.
        if (!numeric.hasToken() && numeric.hasLine()) {
            const id = numeric.getLine();
            const window = this.app.view.getWindow(id);
            const hasSubscription = this.app.model.subscriptions.has(id);
            if (window !== null && hasSubscription === true) {
                return new SpokenWindowReference(id);
            }

            // Fall through if it's not a window.
        }

        // We need to resolve the line number reference (which might not exist,
        // in which case it refers to the line of the cursor in the active document)
        // to a line index into a non-document window or a line index into a document.
        // Very finicky!

        // If we have only a token, get current document's cursor.
        // Offset into the current line using the token index.
        if (numeric.hasToken() &&! numeric.hasLine()) {
            const document = this.app.model.getActiveDocument();
            if (document === null) {
                return null;
            }
            
            const cursor = document[0].getCursor(document[1]);
            const mark = document[0].getMark(document[1]);
            
            const [left, right] = Position.orderNormalize(cursor, mark, document[0]);
            const tokens = document[0].getLineTokens(right.row);
            let tokenIndex = numeric.getToken();
            tokenIndex = Math.max(0, Math.min(tokens.tokens.length -1, tokenIndex));
            const token = tokens.tokens[tokenIndex];

            return new SpokenSelection(
                document[0],
                document[1],
                token.position,
                new Position(token.position.row, 
                    token.position.column + token.text.length)
            );

        }

        // We have a line number reference now. Let's figure out if it refers
        // to a valid position or not. Once we figure out what window it's part of,
        // we can get the subscription of that window and determine whether
        // we are talking about a document or something else.

        // Ensure that we have a line number. (This should be the case…)
        if (!numeric.hasLine()) {
            return null;
        }

        // Ensure we have a valid window reference.
        const window = this.app.view.getWindowFromLineNumber(numeric.getLine());
        if (window === null) {
            return null;
        }

        const hasSubscription = this.app.model.subscriptions.has(window.id);
        if (hasSubscription === false) {
            return null;
        }

        // Ensure the window has a valid subscription.
        const subscription = this.app.model.subscriptions.getDetails(window.id);
        const windowLineOffset = numeric.getLine() - window.topRowNumber;

        // If we have a document on our hands…
        if (subscription instanceof DocumentSubscription) {
            const document = this.app.model.documents.get(subscription.document);
            const view = document.getView(subscription.anchorIndex);
            const documentLine = view.row + windowLineOffset;
            const pos = new Position(documentLine, 0).normalize(document);
            const tokens = document.getLineTokens(pos.row);

            // If line is all whitespace, just put us at EOL
            if (tokens.tokens.length === 0) {
                return new SpokenSelection(
                    document,
                    subscription.anchorIndex,
                    new Position(documentLine, document.getLine(documentLine).length),
                    new Position(documentLine, document.getLine(documentLine).length)
                );
            }

            if (numeric.hasToken()) {
                let tokenIndex = numeric.getToken();
                tokenIndex = Math.max(0, Math.min(tokens.tokens.length - 1, tokenIndex));
                const token = tokens.tokens[tokenIndex];

                return new SpokenSelection(
                    document,
                    subscription.anchorIndex,
                    token.position,
                    new Position(token.position.row, token.position.column + token.text.length)
                );
            }
            else {
                const tokens = document.getLineTokens(documentLine, false);
                const left = tokens.tokens[0].position;
                const last = tokens.tokens[tokens.tokens.length - 1];
                const right = new Position(
                    last.position.row,
                    last.position.column + last.text.length
                );

                return new SpokenSelection(
                    document, 
                    subscription.anchorIndex,
                    right.normalize(document),
                    left.normalize(document)
                );
            }
        }

        // Line subscriptions constitute all non-document subscriptions with
        // meaningful line number references.
        else if (subscription instanceof LineSubscription) {
            // TODO
            return null;
        }
        
        // If nothing above has matched, then we don't have a valid position.
        return null;
    }


    static NUMERIC_REFERENCE_PATTERN = /^(?!^\.?$)(\d+)?(?:\.(\d+))?$/;

    private parseNumericReference(index: number): NumericReference {
        const text = this.tokens[index].text;
        let match = Speech.NUMERIC_REFERENCE_PATTERN.exec(text);
        
        if (match !== null) {
            // Reminder: Unmatched groups in successful RE return [undefined].
            const integer = match[1] === undefined ? null : parseInt(match[1]);
            const decimal = match[2] === undefined ? null : parseInt(match[2]);
            return new NumericReference(integer, decimal);
        }
        else {
            return null;
        }
    }

    
    private parseLocation(index: number, recursingFrom: boolean = false): [SpokenLocation, number] {
        index = this.consumeWhite(index);
        if (index >= this.tokens.length) {
            return [null, 0];
        }

        // Try parsing raw number. [30], [.2], [30.2]
        let numeric = this.parseNumericReference(index);
        if (numeric !== null) {
            // A remark on error handling:
            // convertNumericIntoLocation() returns [null] on failure.
            // This is how *we* return failure, too.
            return [this.convertNumericIntoLocation(numeric), index + 1];
        }

        const lower = this.tokens[index].text.toLowerCase();
        const operation = REMAP.remap(lower);

        if (!["to", "all", "before", "after", "from"].includes(operation)) {
            return [null, 0];
        }

        index++;
        index = this.consumeWhite(index);
        if (index >= this.tokens.length) {
            return [null, 0];
        }

        numeric = this.parseNumericReference(index);
        if (numeric === null) {
            return [null, 0];
        }

        let location = this.convertNumericIntoLocation(numeric)
        if (location === null) {
            return [null, 0];
        }

        index++;

        switch (operation) {
            case "to":
                // no modifications needed
                break;
            
            case "all":
                if (location instanceof SpokenSelection) {
                    location.mark.column = 0;
                    location.cursor = new Position(
                        location.mark.row + 1,
                        0
                    ).normalize(location.document);
                } 
                break;

            case "before":
                if (location instanceof SpokenSelection) {
                    location.cursor = location.mark = Position.min(location.cursor, location.mark);
                }
                break;

            case "after":
                if (location instanceof SpokenSelection) {
                    location.cursor = location.mark = Position.max(location.cursor, location.mark);
                }
                break;

            case "from":
                if (recursingFrom) {
                    return [null, 0];
                }

                if (location instanceof SpokenSelection) {
                    index = this.consumeWhite(index);
                    if (index >= this.tokens.length) {
                        return [null, 0];
                    }

                    let [location2, index2] = this.parseLocation(index, true);
                    
                    if (location2 instanceof SpokenSelection 
                        && location2.document.node === location.document.node
                        && location2.anchorIndex === location.anchorIndex)
                    {
                        let left = Position.min(
                            Position.min(location.mark, location.cursor),
                            Position.min(location2.mark, location2.cursor)
                        );

                        let right = Position.max(
                            Position.max(location.mark, location.cursor),
                            Position.max(location2.mark, location2.cursor)
                        ); 

                        return [new SpokenSelection(
                            location.document, location.anchorIndex, left, right
                        ), index2];
                    } else {
                        return [null, 0];
                    }
                }
                break;

            default:
                return [null, 0];
        }

        return [location, index];
    }
    
    private runMaybeCommand(i: number, context: string, cmd: Command): Executed {
        const matched = [];

        let j = i;
        let ti = 0;

        while (ti < cmd.tokens.length && j < this.tokens.length) {
            const token = cmd.tokens[ti];

            if (this.tokens[j].type === "white") {
                j++;
                continue;
            }

            // At this point, [ti] will point at the token "$location" and [j] will
            // point at a non-white token in the spoken input.
            switch (token) {
                case "$location":
                    let [loc, nextIndex] = this.parseLocation(j);
                    // console.log(loc);
                    // console.log(nextIndex);

                    if (loc !== null) {
                        matched.push(loc);
                        ti++;
                        j = nextIndex;
                        break;
                    } else {
                        return null;
                    }
                    
                case "$identifier":
                    return null;

                case "$please":
                    return null;

                default:
                    if (token === this.tokens[j].text.toLowerCase()) {
                        ti++;
                        j++;
                    } else {
                        return null;
                    }
            }

            while (j < this.tokens.length && this.tokens[j].type === "white") {
                j++;
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

    private runText(i: number, context: string, cmdList: CommandList): Executed | DeferredWhite {
        const raw = this.getRawInput(context);
        const word = this.tokens[i].text;

        // Whitespace is significant in raw context only
        if (this.tokens[i].type === "white") {
            if (!raw) {
                return this.runExecutor(i, 1, EXECUTORS.nop, [], context);
            } else {
                return new DeferredWhite(i, word);
            }
        }

        // Numbers and punctuation cannot lead identifiers - they stand alone.
        // Raw also outputs as-is.
        if ((raw && REMAP.remap(this.tokens[i].text.toLowerCase()) !== "literally")
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
            const remapped = REMAP.remap(lower);

            if (this.tokens[j].type === "punctuation") break;

            if (this.tokens[j].type === "white") {
                j++;
                continue;
            }

            // Check for literally T
            if (remapped === "literally")
            {
                j++;
                while (j < this.tokens.length && this.tokens[j].type === "white") {
                    j++;
                }
                if (j < this.tokens.length) {
                    const next = this.tokens[j].text;
                    identifier = casing.append(identifier, next);   
                }
                j++;

                if (raw) {
                    // just read this one "literally"; don't do anything else
                    break;
                }

                continue;
            }

            // Break if possibly command.
            // First word is exempt. Always interpret as identifier.
            if (j > i && cmdList.commandIndex.has(lower)) {
                break;
            }

            // Check for alphabet
            if (ALPHABET.alphabet.has(lower)) {
                let info = ALPHABET.alphabet.get(lower);

                if (info.casing.firstCaps == Capitalization.Raw) {
                    // use local casing instead
                    identifier = casing.append(identifier, info.character);
                } else {
                    identifier = info.casing.append(identifier, info.character);
                }

                j++;
                continue;
            }

            // Check for casing commands
            let maybeCasing: Casing;
            if ((maybeCasing = CASING.get(REMAP.remap(remapped))) !== undefined) {
                casing = maybeCasing;
                j++;
                continue;
            }

            // Check for take commands
            let maybeTake: number;
            if ((maybeTake = TAKE.get(remapped)) !== undefined) {
                j++;
                while (j < this.tokens.length && this.tokens[j].type === "white") {
                    j++;
                }
                if (j < this.tokens.length && this.tokens[j].type === "identifier") {
                    const next = this.tokens[j].text;
                    identifier = casing.append(identifier, next.substring(0, maybeTake));
                    j++;
                }
                continue;
            }

            // Check for pick N word
            if (remapped === "pick") {
                j++;
                while (j < this.tokens.length && this.tokens[j].type === "white") {
                    j++;
                }
                if (j < this.tokens.length && /^[1-9]+$/.test(this.tokens[j].text)) {
                    const digits = this.tokens[j].text;
                    j++;
                    while (j < this.tokens.length && this.tokens[j].type === "white") {
                        j++;
                    }
                    if (j < this.tokens.length && this.tokens[j].type === "identifier") {
                        const word = this.tokens[j].text;
                        let result = "";
                        for (const c of digits) {
                            let d = parseInt(c) - 1;
                            if (d < word.length) {
                                result += word[d];
                            }
                        }
                        identifier = casing.append(identifier, result);
                        j++;
                    }
                }
                continue;
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

    private runOne(
        i: number,
        context: string,
        cmdList: CommandList,
        deferred: DeferredWhite[]
    ): (Executed | DeferredWhite)[]
    {
        const word = this.tokens[i].text;
        const possibleCommands = cmdList.commandIndex.get(word.toLowerCase());

        if (possibleCommands !== undefined) {
            let maybe = this.runMaybeCommandList(i, context, possibleCommands);
            if (maybe !== null) return [maybe];
        }

        let exec = [];

        for (let d of deferred) {
            exec.push(this.runExecutor(d.first, 1, EXECUTORS.insertExact, [d.text], context));
        }

        exec.push(this.runText(i, context, cmdList));
        return exec;
    }

    private run(): void {
        let i = 0;
        let deferred: DeferredWhite[] = [];

        while (i < this.tokens.length) {
            const context = this.getContext();
            //console.log("run ctx " + context + ": tok " + i + " = \"" + this.tokens[i].text + "\"");
            //console.log("   deferred: " + inspect(deferred));

            const cmdList = this.getCommandList(context);
            if (cmdList === undefined) {
                throw new Error("run: no command list for context \"" + context + "\"");
            }

            let exec = this.runOne(i, context, cmdList, deferred);
            if (exec === null || (exec instanceof Executed && exec.length <= 0)) {
                throw new Error("run: execution must consume at least 1 token");
            }
            
            //console.log(exec);
            
            for (let e of exec) {
                if (e instanceof Executed) {
                    if (e.executor !== EXECUTORS.nop)
                        this.executed.push(e);
                    deferred = [];
                    i = e.first + e.length;
                } else {
                    deferred.push(e);
                    i = e.first + 1;
                }
            }
        }
    }

}
