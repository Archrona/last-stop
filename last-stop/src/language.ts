// language.ts
//   Lexing, parsing, and other support functionality

import { Position, splitIntoLines } from "./shared";
import * as fs from "fs";
import { inspect } from "util";
import * as glob from "glob";

interface TokenContext {
    type: string,
    pattern: string,
    re: RegExp
}

interface ContextChange {
    token: string,
    action: string,
    target?: string,
    style: string,
    requiresParent?: string
}

interface SpacingRule {
    before?: string,
    after?: string,
    either?: string,
    rule: boolean,
    what: string,

    // Computed properties
    beforeRe: RegExp | null,
    afterRe: RegExp | null,
    orMode: boolean
    isDefault: boolean
}

interface LanguageContext {
    name: string,
    extensions: Array<string>,
    tokens: Array<TokenContext>,
    commands: Array<string>,
    contextChanges: Array<ContextChange>,
    rawInput: boolean,
    defaultCasing: string,
    spacing: Array<SpacingRule>
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
        let data = [] as Array<LanguageContext>;

        for (let fn of glob.sync("./contexts/*.json", {})) {
            data.push(JSON.parse(fs.readFileSync(fn).toString()));
        }

        let result = new Map();

        for (const languageData of data) {
            for (const tokenTypeInformation of languageData.tokens) {
                tokenTypeInformation.re = new RegExp(tokenTypeInformation.pattern, 'my');
            }

            for (const rule of languageData.spacing) {
                if (rule.after !== undefined || rule.before !== undefined) {
                    rule.afterRe = (rule.after ? new RegExp("^(?:" + rule.after + ")", "mu") : null);
                    rule.beforeRe = (rule.before ? new RegExp("(?:" + rule.before + ")$", "mu") : null);
                    rule.orMode = false;
                    rule.isDefault = false;
                } else if (rule.either !== undefined) {
                    rule.afterRe = new RegExp("^(?:" + rule.either + ")", "mu");
                    rule.beforeRe = new RegExp("(?:" + rule.either + ")$", "mu");
                    rule.orMode = true;
                    rule.isDefault = false;
                } else {
                    rule.isDefault = true;
                }

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

                    if (includeWhite || type.type !== "white")
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
                tokens.push(new Token(text[i], pos.clone(), "unknown", context));
                foundText = text[i];
                i++;
                pos.column += 1;
            }

            for (const change of lang.contextChanges) {
                if (change.token !== foundText) {
                    continue;
                }

                if (change.requiresParent !== undefined
                    && (contextStack.length < 2 
                        || contextStack[contextStack.length - 2] !== change.requiresParent))
                {
                    continue;
                }
                
                if (change.style !== undefined) {
                    tokens[tokens.length - 1].type = change.style;
                }

                if (change.action === "pop") {
                    contextStack.pop();
                } 
                else if (change.action === "push") {
                    contextStack.push(change.target);
                }
                break;
            }
        }

        const result = new TokenizeResult(tokens, contextStack);
        return result;
    }

    shouldSpace(context: string, before: string, after: string): boolean {
        let rules = this.contexts.get(context).spacing;

        for (let rule of rules) {
            if (rule.isDefault) {
                return rule.rule;
            } else if (rule.orMode) {
                if (rule.beforeRe !== null && rule.beforeRe.test(before)) {
                    return rule.rule;
                } else if (rule.afterRe !== null && rule.afterRe.test(after)) {
                    return rule.rule;
                }
            } else {
                if ((rule.beforeRe === null || rule.beforeRe.test(before)) &&
                    (rule.afterRe === null || rule.afterRe.test(after)))
                {
                    return rule.rule;
                }
            }
        }

        throw new Error("shouldSpace: spacing rules for ctx " + context + " not exhaustive");
    }

    shouldSpaceExplain(context: string, before: string, after: string): string {
        let rules = this.contexts.get(context).spacing;

        for (let rule of rules) {
            let desc = (rule.rule + "").toUpperCase() + " by " + rule.what + "\n";
            if (rule.isDefault) {
                return desc + "  --> Triggered default";
            } else if (rule.orMode) {
                if (rule.beforeRe !== null && rule.beforeRe.test(before)) {
                    return desc + "  --> before (\"" + before + "\") matched " + inspect(rule.beforeRe);
                } else if (rule.afterRe !== null && rule.afterRe.test(after)) {
                    return desc + "  --> after (\"" + after + "\") matched " + inspect(rule.afterRe);
                }
            } else {
                if ((rule.beforeRe === null || rule.beforeRe.test(before)) &&
                    (rule.afterRe === null || rule.afterRe.test(after)))
                {
                    desc += "  --> before " + (rule.beforeRe === null ? "was absent"
                        : "(\"" + before + "\") matched " + inspect(rule.beforeRe));
                    desc += "  --> after " + (rule.afterRe === null ? "was absent"
                        : "(\"" + after + "\") matched " + inspect(rule.afterRe));
                    return desc;
                }
            }
        }

        return "THROWS by fallthrough";
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