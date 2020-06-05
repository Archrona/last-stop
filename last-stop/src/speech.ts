// speech.ts

import { TokenizeResult, Token } from "./language";
import { Main } from "./main";
import { Position, INSERTION_POINT, ESCAPE_SUBSPLIT, ESCAPE_KEY, ESCAPE_MOUSE, ESCAPE_SCROLL, ESCAPE_DRAG } from "./shared";
import { Model, DocumentNavigator, Anchor, DocumentSubscription, LineSubscription, Subscription } from "./model";
import { CommandList, Command } from "./commands";
import { inspect } from "util";
import * as fs from "fs";
import { LEFT_MARGIN_COLUMNS } from "./subscription";
import { clipboard } from "electron";

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
        // Apply firstCaps if ident so far is only underscores or empty
        if (/^_*$/.test(original)) {
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
    other: Array<[string, Array<string>]>;
}

class AlphabetEntry {
    constructor(public character: string, public casing: Casing) { }
}

class Alphabet {
    alphabet: Map<string, AlphabetEntry>;
    
    constructor() {
        const data = JSON.parse(
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

        for (const [character, spoken] of data.other) {
            for (const word of spoken) {
                this.alphabet.set(word, new AlphabetEntry(character, new Casing(
                    Capitalization.Raw, Capitalization.Raw, Glue.None
                )));
            }
        }
    }
}

export let ALPHABET = new Alphabet();



interface RemapFileEntry {
    spoken: string;
    internal: string;
}

class Remap {
    replacements: Map<string, string>;
    
    constructor() {
        const data = JSON.parse(
            fs.readFileSync("./specials/remap.json").toString()
        ) as Array<RemapFileEntry>;
        
        this.replacements = new Map();
        
        for (const entry of data) {
            this.replacements.set(entry.spoken, entry.internal);
        }
    }
    
    remap(word: string): string {
        const perhaps = this.replacements.get(word);
        if (perhaps !== undefined) {
            return perhaps;
        }
        return word;
    }
}

export let REMAP = new Remap();


export function reloadSpeechData() {
    ALPHABET = new Alphabet();
    REMAP = new Remap();
}


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
            const location = args[0];

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
    },

    onScroll: (model: Model, args: Array<any>) => {
        const sub = args[2];

        if (sub instanceof DocumentSubscription) {
            const x = parseInt(args[3]);
            const y = parseInt(args[4]);
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                const view = doc.getView(sub.anchorIndex);
                //view.column = Math.max(0, view.column + x);
                view.row = Math.max(-20, Math.min(doc.getLineCount() + 40, view.row + y));
                doc.setView(sub.anchorIndex, view);
            }
        }
    },

    onMouse: (model: Model, args: Array<any>) => {
        const sub = args[1];

        if (sub instanceof DocumentSubscription) {
            const windowRow = args[3];
            const windowCol = args[4];
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                const view = doc.getView(sub.anchorIndex);
                const pos = new Position(
                    windowRow + view.row,
                    windowCol - LEFT_MARGIN_COLUMNS + view.column
                ).normalize(doc);
                doc.setMark(sub.anchorIndex, pos);
                if (args[2] === 0) {
                    doc.setCursor(sub.anchorIndex, pos);
                }
            }
        }
    },

    onKey: (model: Model, args: Array<any>) => {
        const sub = args[1];

        if (sub instanceof DocumentSubscription) {
            const docName = sub.document;
            if (model.documents.hasKey(docName)) {
                const doc = model.documents.get(docName);
                let str = "";

                for (let i = 2; i < args.length; i++) {
                    const key = args[i];

                    if (typeof key === "string") {
                        if (key.length === 1) {
                            str += key;
                        } else {
                            if (str.length > 0) {
                                doc.insert(sub.anchorIndex, str);
                                str = "";
                            }

                            switch (key) {
                                case "Enter":
                                    str += "\n";
                                    break;

                                default:
                                    doc.osKey(sub.anchorIndex, key);
                            }
                        }
                    }
                }
                
                if (str.length > 0)
                    doc.insert(sub.anchorIndex, str);
            }
        }
    },

    cut: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.osCut(ai);
        });
    },

    copy: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.osCopy(ai);
        });
    },

    paste: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.osPaste(ai);
        });
    },

    selectAll: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.selectAll(ai);
        });
    },

    selectAllAndCopy: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.selectAll(ai);
            doc.osCopy(ai);
        });
    },

    selectAllAndCut: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            doc.selectAll(ai);
            doc.osCut(ai);
        });
    },

    sponge: (model: Model, arg: Array<any>) => {
        model.doActiveDocument((doc, ai) => {
            let targets = "lr";
            if (arg[0] !== undefined && typeof arg[0] === "string") {
                targets = arg[0];
            }

            if (targets.indexOf("l") !== -1) {
                doc.spongeBeforeSelection(ai);
            }

            if (targets.indexOf("r") !== -1) {
                doc.spongeAfterSelection(ai);
            }

            if (targets.indexOf("u") !== -1) {
                doc.spongeAboveSelection(ai);
            }   
            
            if (targets.indexOf("d") !== -1) {
                doc.spongeBelowSelection(ai);
            }  
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

class ResumePoint {
    constructor(public token: number, public executed: number, public undoCount: number) { }
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

export class ReviseResult {
    constructor(public undidUntil: number, public elapsed: number) { }
}

export class Speech {
    speech: string;

    baseUndoIndex: number;
    finalUndoIndex: number;

    app: Main;
    tokens: Array<Token>;

    executed: Array<Executed>;
    resumePoints: Array<ResumePoint>;

    private constructor(app: Main, speech: string) {
        this.app = app;
        this.speech = speech;
        this.baseUndoIndex = this.getUndoIndex();
        this.finalUndoIndex = this.baseUndoIndex;   // overwritten after execution
        this.executed = [];
        this.resumePoints = [];

        this.tokens = this.tokenize(this.speech).tokens;
        this.run();
    }

    reviseSpeech(speech: string): ReviseResult {
        const timeStart = process.hrtime.bigint();
        const tokens = this.tokenize(speech).tokens;
        
        // How many tokens are identical between the original speech and the revised speech?
        // Since execution of commands is deterministic (as a function of context and state),
        // we can assume that these tokens do not need to be reprocessed.
        let sameTokens = 0;
        while (sameTokens < tokens.length && sameTokens < this.tokens.length) {
            const old = this.tokens[sameTokens];
            const revised = tokens[sameTokens];
            if (!old.equals(revised)) {
                break;
            } 
            sameTokens++;
        }
    
        let rp = this.resumePoints.length - 1;
        while (rp >= 0 && this.resumePoints[rp].token > sameTokens) {
            rp--;
        }

        // TODO this is an ugly hack and I am ashamed
        // Go back 3 more resume points than we NEED to
        // to prevent the "is" -> "is equal to" style of retroactive
        // token meaning change.
        // There has to be a better way (ruling out future-ambiguous RP's)
        rp -= 3;

        let runFromToken = 0;

        if (rp < 0) {
            this.undo();
        } else {
            runFromToken = this.resumePoints[rp].token;
            this.app.model.store.undo(this.finalUndoIndex - this.resumePoints[rp].undoCount);
            this.finalUndoIndex = this.resumePoints[rp].undoCount;
            this.executed = this.executed.slice(0, this.resumePoints[rp].executed);
            this.tokens = this.tokens.slice(0, this.resumePoints[rp].token);
            this.resumePoints = this.resumePoints.slice(0, rp);
        }

        const undidUntil = this.getUndoIndex();
        this.tokens = tokens;
        this.speech = speech;

        this.run(runFromToken);

        const timeEnd = process.hrtime.bigint();
        const totalElapsed = Number(timeEnd - timeStart) / 1000000;
     
        return new ReviseResult(undidUntil, totalElapsed);
    }

    static execute(app: Main, speech: string): Speech {
        const result = new Speech(app, speech);
        
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
        const name = this.app.languages.contexts.get(context).defaultCasing;
        
        const casing = CASING.get(name);
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

        this.app.model.store.undo(this.finalUndoIndex - this.baseUndoIndex);
        this.finalUndoIndex = this.baseUndoIndex;
        this.executed = [];
        this.resumePoints = [];
        this.speech = "";
        this.tokens = [];
    }


    private tokenize(speech: string): TokenizeResult {
        const result = this.app.languages.tokenize(
            speech, ["spoken_text"], new Position(0, 0), true);

        return result;
    }

    private runExecutor(i: number, length: number, executor: Executor,
        args: Array<any>, context: string): Executed
    {
        const undoIndex = this.getUndoIndex();
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
        const match = Speech.NUMERIC_REFERENCE_PATTERN.exec(text);
        
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

    
    private parseLocation(index: number, recursingFrom = false): [SpokenLocation, number] {
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

        const location = this.convertNumericIntoLocation(numeric)
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

                    const [location2, index2] = this.parseLocation(index, true);
                    
                    if (location2 instanceof SpokenSelection 
                        && location2.document.node === location.document.node
                        && location2.anchorIndex === location.anchorIndex)
                    {
                        const left = Position.min(
                            Position.min(location.mark, location.cursor),
                            Position.min(location2.mark, location2.cursor)
                        );

                        const right = Position.max(
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
                    const [loc, nextIndex] = this.parseLocation(j);
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
            const args = cmd.args.map((x: any) => {
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
            const maybe = this.runMaybeCommand(i, context, cmd);
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
            if (this.tokens[j].type === "event") break;

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
                const info = ALPHABET.alphabet.get(lower);

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
                            const d = parseInt(c) - 1;
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

    private runEvent(i: number, context: string): Executed[] | null {
        const event = this.tokens[i].text;
        const parts = event.substring(1, event.length - 1).split(ESCAPE_SUBSPLIT);
        if (parts.length < 2) {
            return null;
        }

        const type = parts[0][0];
        const windowStr = parts[0].substring(1);
        const window = parseInt(windowStr);
        const sub = this.app.model.subscriptions.getDetails(window);
        if (!sub) {
            return null;
        }

        switch (type) {
            case ESCAPE_KEY:
                return [this.runExecutor(i, 1, EXECUTORS.onKey, 
                    ([windowStr, sub] as any[]).concat(parts.slice(1)), context)];
            
            case ESCAPE_MOUSE:
                const result = [];

                for (let index = 1; index + 2 < parts.length; index += 3) {
                    const button = parseInt(parts[index]);
                    const row = parseInt(parts[index + 1]);
                    const column = parseInt(parts[index + 2]);
                    
                    result.push(this.runExecutor(i, 1, EXECUTORS.onMouse, 
                        [windowStr, sub, button, row, column], context));
                }
                return result;
               

            case ESCAPE_SCROLL:
                return [this.runExecutor(i, 1, EXECUTORS.onScroll, 
                    ([type, windowStr, sub] as any[]).concat(parts.slice(1)), context)];

            case ESCAPE_DRAG:
                // TODO
                break;
        }

        return [this.runExecutor(i, 1, EXECUTORS.nop, [], context)];
    }

    private runOne(
        i: number,
        context: string,
        cmdList: CommandList,
        deferred: DeferredWhite[]
    ): (Executed | DeferredWhite)[]
    {
        const word = this.tokens[i].text;

        if (this.tokens[i].type === "event") {
            const maybe = this.runEvent(i, context);
            if (maybe !== null) return maybe;
        }

        const possibleCommands = cmdList.commandIndex.get(word.toLowerCase());
        if (possibleCommands !== undefined) {
            const maybe = this.runMaybeCommandList(i, context, possibleCommands);
            if (maybe !== null) return [maybe];
        }

        const exec = [];

        for (const d of deferred) {
            exec.push(this.runExecutor(d.first, 1, EXECUTORS.insertExact, [d.text], context));
        }

        exec.push(this.runText(i, context, cmdList));
        return exec;
    }

    private run(i: number = 0): void {
        let deferred: DeferredWhite[] = [];

        while (i < this.tokens.length) {
            const context = this.getContext();
            //console.log("run ctx " + context + ": tok " + i + " = \"" + this.tokens[i].text + "\"");
            //console.log("   deferred: " + inspect(deferred));

            const cmdList = this.getCommandList(context);
            if (cmdList === undefined) {
                throw new Error("run: no command list for context \"" + context + "\"");
            }

            let resumePoint = null;
            if (deferred.length === 0)
                resumePoint = new ResumePoint(i, this.executed.length, this.getUndoIndex());

            const exec = this.runOne(i, context, cmdList, deferred);
            if (exec === null) {
                throw new Error("run: execution must consume at least 1 token");
            }
            
            for (const e of exec) {
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

            // TODO somehow rule out resume points before things like
            //     "is"
            // where appending an "equal to" later on might change the interpretation
            // of the previous command. For now, we just go back a few more RP's
            // than we need to
            if (resumePoint !== null) {
                this.resumePoints.push(resumePoint);
            }
        }

        this.finalUndoIndex = this.app.model.store.getUndoCount();
    }

}
