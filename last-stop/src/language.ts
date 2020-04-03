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
    target: string | undefined
}

interface LanguageContext {
    name: string,
    extensions: Array<string>,
    tokens: Array<TokenContext>,
    contextChanges: Array<ContextChange>
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

        let tokens = [];

        while (i < text.length) {
            const context = (contextStack.length > 0 ?
                contextStack[contextStack.length - 1] : baseContext);
            const lang = this.contexts.get(context);
            const tokenTypes = lang.tokens;
            let found = false;

            for (const type of tokenTypes) {
                type.re.lastIndex = i;
                const matchResult = type.re.exec(text);
                
                if (matchResult !== null) {
                    const text = matchResult[0];

                    if (includeWhite || type.type !== "white")
                        tokens.push(new Token(text, pos.clone(), type.type, context));

                    if (type.type === "newline") {
                        pos.row++;
                        pos.column = 0;
                    } else {
                        pos.column += text.length;
                    }

                    found = true;
                    i += text.length;
                    break;
                }
            }

            if (!found) {
                tokens.push(new Token(text[i], pos, "unknown", context));
                i++;
                pos.column++;
            }

            const foundText = tokens[tokens.length - 1].text;

            for (const change of lang.contextChanges) {
                if (change.token === foundText) {
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