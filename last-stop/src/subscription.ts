// subscription.ts
//   Renders subscriptions from the store into DrawableText.

import { Main } from "./main";
import { Position, DrawableText, splitIntoLines } from "./shared";
import { Anchor } from "./model";
import { TokenizeResult } from "./language";

export const LEFT_MARGIN_COLUMNS = 6;

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
        const column = LEFT_MARGIN_COLUMNS - lineString.length - 2;
        
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


function renderDocumentSelection(
    selectionLeft: Position, selectionRight: Position,
    lineIndex: number, content: Array<DrawableText>,
    view: Position, columns: number, app: Main, viewRow: number): void
{
    if (selectionLeft.row <= lineIndex && selectionRight.row >= lineIndex) {
        let left = (selectionLeft.row === lineIndex ? selectionLeft.column : 0);
        let right = (selectionRight.row === lineIndex ? selectionRight.column : 1000000);
        left = Math.max(left, view.column) + LEFT_MARGIN_COLUMNS - view.column;
        right = Math.min(right, view.column + columns - LEFT_MARGIN_COLUMNS)
            + LEFT_MARGIN_COLUMNS - view.column;
        
        if (right > 0 && left < columns && left < right) {
            let selectionColor = app.view.getColor("selection");

            content.push(new DrawableText(
                "", "selection@" + left + "@" + right, viewRow, 0, selectionColor, null
            ));
        }
    }
}

function renderDocumentAnchor(
    anchor: Position, name: String, content: Array<DrawableText>,
    lineIndex: number, view: Position, app: Main, drawRow: number) : void
{
    if (anchor.row === lineIndex && anchor.column >= view.column) {
        const anchorColumn = anchor.column - view.column + LEFT_MARGIN_COLUMNS;
        const anchorColor = app.view.getColor("anchor_" + name);

        content.push(new DrawableText(
            "", "anchor@" + name, drawRow, anchorColumn, anchorColor, null
        ));
    }
}

function renderDocumentToken(
    tokenization: TokenizeResult, tokenIndex: number, view: Position, app: Main,
    columns: number, viewRow: number, content: Array<DrawableText>,
    longLineIndicator: boolean): boolean
{
    const token = tokenization.tokens[tokenIndex];
    const displayColumn = token.position.column - view.column + LEFT_MARGIN_COLUMNS;
    const color = app.view.getColor(token.type);
    
    let special = "";
    if (tokenIndex > 0 && tokenIndex % 5 === 0) {
        let mark = Math.floor(tokenIndex / 5);
        let markColor = app.view.getColor(mark % 2 === 0 ? "token_0" : "token_5");
        let count = Math.floor((mark - 1) / 2) % 3 + 1;
        special = "token@" + count + "@" + markColor;
    }

    if (displayColumn >= LEFT_MARGIN_COLUMNS) {
        let lli = false;

        if (displayColumn < columns - 1) {
            if (displayColumn + token.text.length <= columns - 1) {
                content.push(new DrawableText(
                    token.text, special, viewRow, displayColumn, color, null
                ));
            } else {
                content.push(new DrawableText(
                    token.text.substring(0, columns - 1 - displayColumn),
                    special, viewRow, displayColumn, color, null
                ));
                lli = true;
            }
        } else {
            lli = true;
        }

        if (lli && !longLineIndicator) {
            content.push(new DrawableText(
                "»", "", viewRow, columns - 1, app.view.getColor("overflow_indicator"), null
            ));
            longLineIndicator = true;
        }
    }
    else if (displayColumn + token.text.length > LEFT_MARGIN_COLUMNS) {
        content.push(new DrawableText(
            token.text.substring(LEFT_MARGIN_COLUMNS - displayColumn), special, viewRow,
            LEFT_MARGIN_COLUMNS, color, null
        ));
    }

    return longLineIndicator;
}

function renderDocument(terms: Array<string>, app: Main, rows: number, columns: number)
    : Array<DrawableText>
{
    try {
        const name = terms[0];
        const anchorIndex = parseInt(terms[1]);
        if (name.length === 0 || typeof anchorIndex !== "number") {
            throw new Error("invalid format of subscription string");
        }

        const doc = app.model.documents.get(name);
        const cursor = doc.getCursor(anchorIndex);
        const mark = doc.getMark(anchorIndex);
        const view = doc.getView(anchorIndex);

        let content = [];
        let longLineIndicator = false;
        let [selectionLeft, selectionRight] = Position.orderNormalize(cursor, mark, doc);
        let lines = doc.getLineCount();

        for (let viewRow = 0; viewRow < rows; viewRow++) {
            const lineIndex = view.row + viewRow;

            // Indicate EOF by subtle marker
            if (lineIndex < 0 || lineIndex >= lines) {
                let eofColor = app.view.getColor("EOF");
                content.push(new DrawableText(
                    "░", "", viewRow, LEFT_MARGIN_COLUMNS, eofColor, null
                ));
                continue;
            }

            renderDocumentSelection(
                selectionLeft, selectionRight, lineIndex, content,
                view, columns, app, viewRow);

            renderDocumentAnchor(cursor, "cursor", content, lineIndex, view, app, viewRow);
            renderDocumentAnchor(mark, "mark", content, lineIndex, view, app, viewRow);
    
            const lineText = doc.getLine(lineIndex);
            const context = doc.getLineContext(lineIndex);
            const tokenization = app.languages.tokenize(
                lineText, context, new Position(lineIndex, 0), false);
    
            for (let tokenIndex = 0; tokenIndex < tokenization.tokens.length; tokenIndex++) {
                longLineIndicator = renderDocumentToken(tokenization, tokenIndex, view,
                    app, columns, viewRow, content, longLineIndicator);
            }
        }
    
        return content;

    } catch (e) {
        console.log(e);
        return renderError("error rendering document: " + e.message, app);
    }
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