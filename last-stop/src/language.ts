// language.ts
//   Lexing, parsing, and other support functionality

import { Position, splitIntoLines } from "./shared";
import * as fs from "fs";

interface TokenContext {
    type: string,
    pattern: string,
    re: RegExp
}

interface ContextChange {
    token: string,
    action: string,
    target: string | undefined,
    style: string,
}

interface LanguageContext {
    name: string,
    extensions: Array<string>,
    tokens: Array<TokenContext>,
    commands: Array<string>,
    contextChanges: Array<ContextChange>,
    rawInput: boolean,
    defaultCasing: string
}

export class TokenizeResult {
    constructor(public tokens: Array<Token>, public finalContextStack: Array<string>) {

    }
}

export class Token {
    constructor(public text: string, public position: Position, public type: string, public context: string) {

    }
}

export class Languages {
    contexts: Map<string, LanguageContext>;
    
    constructor() {
        this.contexts = Languages.loadContexts("contexts.json");
    }
    
    static loadContexts(filename: string) {
        let data = JSON.parse(fs.readFileSync(filename).toString()) as Array<LanguageContext>;
        let result = new Map();

        for (const languageData of data) {
            for (const tokenTypeInformation of languageData.tokens) {
                tokenTypeInformation.re = new RegExp(tokenTypeInformation.pattern, 'my');
            }
            result.set(languageData.name, languageData);
        }

        return result;
    }

    tokenize(text: string, contextStack: Array<string>, initialPosition: Position, includeWhite: boolean): TokenizeResult {
        if (contextStack.length == 0) throw "zeroed out context stack";
        contextStack = contextStack.slice();

        let baseContext = contextStack[0];
        let pos = initialPosition.clone();
        let i = 0;

        let tokens: Array<Token> = [];

        while (i < text.length) {
            const context = (contextStack.length > 0 ?
                contextStack[contextStack.length - 1] : baseContext);
            const lang = this.contexts.get(context);
            const tokenTypes = lang.tokens;
            let found = false;
            let foundText = "";

            for (const type of tokenTypes) {
                type.re.lastIndex = i;
                const matchResult = type.re.exec(text);
                
                if (matchResult !== null) {
                    foundText = matchResult[0];

                    if (includeWhite || (type.type !== "white" && type.type !== "newline"))
                        tokens.push(new Token(foundText, pos.clone(), type.type, context));

                    if (type.type === "newline") {
                        pos.row++;
                        pos.column = 0;
                    } else {
                        pos.column += foundText.length;
                    }

                    found = true;
                    i += foundText.length;
                    break;
                }
            }

            if (!found) {
                tokens.push(new Token(text[i], pos, "unknown", context));
                foundText = text[i];
                i++;
                pos.column++;
            }

            for (const change of lang.contextChanges) {
                if (change.token === foundText) {
                    if (change.style !== undefined) {
                        tokens[tokens.length - 1].type = change.style;
                    }
                    if (change.action === "pop") {
                        contextStack.pop();
                    } else if (change.action === "push") {
                        contextStack.push(change.target);
                    }
                }
            }
        }

        return new TokenizeResult(tokens, contextStack);
    }
}

export class TokenIterator {
    tokens: Array<Token>;
    index: number;
    includeWhite: boolean;
 
    constructor(tokens: Array<Token>, includeWhite: boolean) {       
        this.tokens = tokens; 
        this.reset(includeWhite);
    }
    
    private offsetIncludingWhite(offset: number): number | null {
        const result = this.index + offset;
        
        if (result < 0 || result >= this.tokens.length) {
            return null;
        }
        else {
            return result;
        }
    }

    private absorbWhite(current: number, delta: number) {
        while (current >= 0 && current < this.tokens.length && this.tokens[current].type === "white") {
            current += delta;
        }
        return current;
    }  
    
    private offsetExcludingWhite(offset: number): number | null {
        let delta = (offset < 0 ? - 1 : 1);
        let positiveOffset = (offset < 0 ? - offset : offset);
        let current = this.index;
        
        current = this.absorbWhite(current, delta);
        
        while (positiveOffset > 0 && current >= 0 && current < this.tokens.length) {
            if (this.tokens[current].type === "white") {
                throw "algorithm broken (offsetExcludingWhite: 1)";
            }
            
            current += delta;
            current = this.absorbWhite(current, delta);
            positiveOffset--;
        }
        
        if (positiveOffset === 0 && current >= 0 && current < this.tokens.length) {
            return current;
        }
        else {
            return null;
        }
    }

    private offset(offset: number) {
        if (this.includeWhite) {
            return this.offsetIncludingWhite(offset);
        }
        else {
            return this.offsetExcludingWhite(offset);
        }
    }  

    valid(): boolean {
        return this.index >= 0 && this.index < this.tokens.length;
    }

    private checkValid() {
        if (!this.valid()) {
            throw "token iterator invalid (valid: 1)";
        }      
    }

    get(offset: number = 0): Token | null {
        this.checkValid();
        const offsetIndex = this.offset(offset);
        return (offsetIndex === null ? null : this.tokens[offsetIndex]);
    }

    shift(offset: number = 1) {
        this.checkValid();
        const index = this.offset(offset);
 
        if (index === null) {
            this.index = (offset < 0 ? -1 : this.tokens.length);
        }
        else {
            this.index = index;
        }
    }

    reset(includeWhite: boolean) {
        this.index = 0;
        this.includeWhite = includeWhite;
        if (this.includeWhite === false) {
            this.index = this.absorbWhite(0, 1);
        }
    }
}