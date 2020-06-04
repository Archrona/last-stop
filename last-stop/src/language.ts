// language.ts
//   Lexing, parsing, and other support functionality

import { Position, splitIntoLines } from "./shared";
import * as fs from "fs";
import { inspect } from "util";
import * as glob from "glob";

interface TokenContext {
    type: string;
    pattern: string;
    re: RegExp;
}

/**
 * A [ContextChange] describes conditions which, if met, would indicate that
 * either a new context should be pushed onto the context stack or that
 * the existing context should be popped from the context stack.
 * 
 * [token] is the text of the token which triggers the context change.
 * 
 * If [action] is ["pop"], then the context stack should be popped.
 * If [action] is ["push"], then [target] will be pushed onto the context
 * stack.
 * 
 * If [requiresParent] is provided, the context change will not match
 * unless the immediate parent of the current context on the stack is
 * equal to [requiresParent].
 * 
 * [style] will be applied to syntax highlight the given token if the
 * context change is successful.
 * 
 * Example:
 * 
 *      {
 *          "token": "/*",
 *          "action": "push",
 *          "target": "comment_multiple_line",
 *          "style": "comment"
 *      }
*/
interface ContextChange {
    token: string;
    action: string;
    target?: string;
    style: string;
    requiresParent?: string;
}

/**
 * A [SpacingRule] describes conditions on the text before and after 
 * the cursor which, if applicable, determine whether whitespace is
 * desired. This is used to automatically space spoken code.
 * 
 * There are two kinds of spacing rule. If [either] is provided, then
 * it must match on either the left or right or both. In this case,
 * [orMode] will be true. 
 * 
 * On the other hand, if [either] is not provided,
 * then [before] and [after], if present, must both be satisfied.
 * [before] is matched on the *left* of the cursor; [after] is matched on
 * the *right* of the cursor. [orMode] will be false in this case. If only
 * one of [before] and [after] is provided, only the given pattern must match.
 * 
 * The raw JSON file does not support regular expressions, so the
 * interface has computed properties [beforeRe] and [afterRe] so that
 * the compiled regular expressions can be cached. These are computed
 * at load time, and subsequent usage can assume they exist.
 * 
 * As an example, the below rule removes spaces after certain symbols:
 * 
 *      {
 *          "what": "after opening punctuation",
 *          "before": "[(\\[{$#@~\\\\!]",
 *          "rule": false
 *      }
*/
interface SpacingRule {
    before?: string;
    after?: string;
    either?: string;
    rule: boolean;
    what: string;

    // Computed properties
    beforeRe: RegExp | null;
    afterRe: RegExp | null;
    orMode: boolean;
    isDefault: boolean;
}

/**
 * A [LanguageContext] is a description of a single context.
 * 
 * Each [LanguageContext] is loaded from a .json file in the [./contexts]
 * directory. For this reason, we use an interface rather than a class.
*/
interface LanguageContext {
    name: string;
    extensions: Array<string>;
    tokens: Array<TokenContext>;
    commands: Array<string>;
    contextChanges: Array<ContextChange>;
    rawInput: boolean;
    defaultCasing: string;
    spacing: Array<SpacingRule>;
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
        const data = [] as Array<LanguageContext>;

        for (const fn of glob.sync("./contexts/*.json", {})) {
            data.push(JSON.parse(fs.readFileSync(fn).toString()));
        }

        const result = new Map();

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

        const baseContext = contextStack[0];
        const pos = initialPosition.clone();
        let i = 0;

        const tokens: Array<Token> = [];

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
        const rules = this.contexts.get(context).spacing;

        for (const rule of rules) {
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
        const rules = this.contexts.get(context).spacing;

        for (const rule of rules) {
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
        const delta = (offset < 0 ? - 1 : 1);
        let positiveOffset = (offset < 0 ? -offset : offset);
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

    get(offset = 0): Token | null {
        this.checkValid();
        const offsetIndex = this.offset(offset);
        return (offsetIndex === null ? null : this.tokens[offsetIndex]);
    }

    shift(offset = 1) {
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