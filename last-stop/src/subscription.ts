// subscription.ts
//   Renders subscriptions from the store into DrawableText.

import { Main } from "./main";
import { getRGB, Position, DrawableText, splitIntoLines } from "./shared";
import { View } from "./view";
import { Anchor } from "./model";

const LEFT_MARGIN_COLUMNS = 5;

function parseSubscription(sub: string) {
    let words = [];
    let accumulator = "";
    
    for (let i = 0; i < sub.length; i++) {
        if (sub[i] === "\\") {
            if (i + 1 < sub.length) {
                accumulator += sub[i + 1];
                i++;
            }
        }
        else if (sub[i] === "@") {
            words.push(accumulator);
            accumulator = "";
        }
        else {
            accumulator += sub[i];
        }
    }
    
    words.push(accumulator);
    
    return {
        command: words[0],
        arguments: words.slice(1)
    };
}

function renderError(text: string, app: Main) : Array<DrawableText> {
    const lines = splitIntoLines(text);
    let row = 0;

    let result = [];
    for (const line of lines) {
        result.push(new DrawableText(line, "", row, LEFT_MARGIN_COLUMNS, app.view.getColor("error"), null));
    }
    
    return result;
}

function renderMargin(topRow: number, rows: number, app: Main) : Array<DrawableText> {
    let result = [];
    for (let i = 0; i < rows; i++) {
        const line = topRow + i;
        const lineString = line.toString();
        const column = LEFT_MARGIN_COLUMNS - lineString.length - 1;
        
        result.push(new DrawableText(
            lineString,
            "",
            i,
            column,
            app.view.getColor("window_line_number"),
            null
        ));
    }
    
    return result;
}

function renderUnknownWindow(terms: Array<string>, app: Main, rows: number, columns: number) {
    return renderError("this window has no subscription", app);
}

class RenderDocumentInfo {
    constructor(
        public text: Array<string>,
        public cursor: Anchor,
        public mark: Anchor,
        public view: Anchor
    ) {
        
    }
}

function renderDocumentReadState(terms: Array<string>, app: Main) { 
    let fail = (message) => {
        return { success: false, display: renderError(message, app), info: null };
    };

    if (terms.length < 1) return fail("doc requires name");
    
    const name = terms[0];
    const text = app.model.getDocumentText(name);

    if (text === undefined) return fail("doc of that name not found");
    if (terms.length < 2) return fail("doc requires anchor index");
    
    const anchorIndex = parseInt(terms[1]);

    if (anchorIndex === NaN) return fail("doc requires integer for anchor index");
    
    const anchors = app.model.getAnchors(name);

    if (!anchors.has("cursor_" + anchorIndex)) return fail("cursor not found");
    if (!anchors.has("mark_" + anchorIndex)) return fail("mark not found");
    if (!anchors.has("view_" + anchorIndex)) return fail("view anchor not found");
    


    return {
        success: true,
        display: null,
        info: new RenderDocumentInfo(
            text, 
            anchors.get("cursor_" + anchorIndex),
            anchors.get("mark_" + anchorIndex),
            anchors.get("view_" + anchorIndex)
        )  
    };
}

function renderDocument(terms: Array<string>, app: Main, rows: number, columns: number)
    : Array<DrawableText>
{
    const checkedTerms = renderDocumentReadState(terms, app);
    if (!checkedTerms.success) {
        return checkedTerms.display;
    }

    let info = checkedTerms.info as RenderDocumentInfo;
    let text = info.text;
    let view = info.view.position;

    let content = [];
    let position = new Position(view.row, 0);
 
    let selectionLeft = info.cursor.position;
    let selectionRight = info.mark.position;
    if (selectionLeft.compareTo(selectionRight) > 0) {
        let temporary = selectionLeft;
        selectionLeft = selectionRight;
        selectionRight = temporary;
    }

    let longLineIndicator = false;
 
    for (let i = 0; i < rows; i++) {
        const lineIndex = view.row + i;
        
        if (lineIndex >= 0 && lineIndex < text.length) {

            if (selectionLeft.row <= lineIndex && selectionRight.row >= lineIndex) {
                let left = (selectionLeft.row === lineIndex ? selectionLeft.column : 0);
                let right = (selectionRight.row === lineIndex ? selectionRight.column : 1000000);
                left = Math.max(left, view.column) + LEFT_MARGIN_COLUMNS - view.column;
                right = Math.min(right, view.column + columns - LEFT_MARGIN_COLUMNS)
                    + LEFT_MARGIN_COLUMNS - view.column;
                
                if (right > 0 && left < columns && left < right) {
                    let selectionColor = app.view.getColor("selection");
    
                    content.push(new DrawableText(
                        "", "selection@" + left + "@" + right, i, 0, selectionColor, null
                    ));
                }
            }

            for (const name of ["mark", "cursor"]) {
                const anchor = info[name];
                if (anchor.position.row === lineIndex && anchor.position.column >= view.column) {
                    const anchorColumn = anchor.position.column - view.column + LEFT_MARGIN_COLUMNS;
                    const anchorColor = app.view.getColor("anchor_" + name);
 
                    content.push(new DrawableText(
                        "", "anchor@" + name, i, anchorColumn, anchorColor, null
                    ));
                }
            }
 
            const lineText = text[lineIndex];
            const context = app.model.getLineContext(terms[0], lineIndex);
 
            position.row = lineIndex;

            const result = app.languages.tokenize(
                lineText + "\n",
                context.context,
                position,
                false
            );
            
            let tokens = result.tokens;
            
            for (let t = 0; t < tokens.length; t++) {
                const token = tokens[t];
                const displayColumn = token.position.column - view.column + LEFT_MARGIN_COLUMNS;
                const color = app.view.getColor(token.type);
                
                let special = "";
                if (t > 0 && t % 5 === 0) {
                    let mark = Math.floor(t / 5);
                    let markColor = app.view.getColor(mark % 2 === 0 ? "token_0" : "token_5");
                    let count = Math.floor((mark - 1) / 2) % 3 + 1;
                    special = "token@" + count + "@" + markColor;
                }

                if (displayColumn >= LEFT_MARGIN_COLUMNS) {
                    let lli = false;

                    if (displayColumn < columns - 1) {
                        if (displayColumn + token.text.length <= columns - 1) {
                            content.push(new DrawableText(
                                token.text, special, i, displayColumn, color, null
                            ));
                        } else {
                            content.push(new DrawableText(
                                token.text.substring(0, columns - 1 - displayColumn),
                                special, i, displayColumn, color, null
                            ));
                            lli = true;
                        }
                    } else {
                        lli = true;
                    }

                    if (lli && !longLineIndicator) {
                        content.push(new DrawableText(
                            "»", "", i, columns - 1, app.view.getColor("overflow_indicator"), null
                        ));
                        longLineIndicator = true;
                    }
                }
                else if (displayColumn + token.text.length > LEFT_MARGIN_COLUMNS) {
                    content.push(new DrawableText(
                        token.text.substring(LEFT_MARGIN_COLUMNS - displayColumn), special, i,
                        LEFT_MARGIN_COLUMNS, color, null
                    ));
                }
            }

        }
    }

    return content;
}

type Renderer = (terms: string[], app: Main, rows: number, columns: number) => DrawableText[];

const RENDERERS: Map<string, Renderer> = new Map([
    ["doc", renderDocument],
    ["unknown_window", renderUnknownWindow],

]);

export function renderSubscription(sub: string, topRow: number, rows: number, columns: number, app: Main)
    : Array<DrawableText>
{
    const margin = renderMargin(topRow, rows, app);

    const parsed = parseSubscription(sub);
    const renderer = RENDERERS.get(parsed.command);
    let content = [];
    
    if (renderer === undefined) {
        content = renderError("That subscription (" + parsed.command + ") is not recognized.", app);
    }
    else {
        content = renderer(parsed.arguments, app, rows, columns);
    }
     
    return margin.concat(content);
}