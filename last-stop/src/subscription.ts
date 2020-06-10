// subscription.ts
//   Renders subscriptions from the store into DrawableText.

import { Main } from "./main";
import { Position, DrawableText, splitIntoLines } from "./shared";
import { Anchor, Subscription, DocumentNavigator, DocumentSubscription, NotFoundSubscription } from "./model";
import { TokenizeResult } from "./language";

export const LEFT_MARGIN_COLUMNS = 6;

function parseSubscription(sub: string) {
    const words = [];
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

function renderError(text: string, app: Main): Array<DrawableText> {
    const lines = splitIntoLines(text);
    const row = 0;

    const result = [];
    for (const line of lines) {
        result.push(new DrawableText(line, "", row, LEFT_MARGIN_COLUMNS, app.view.getColor("error"), null));
    }
    
    return result;
}

function renderMargin(topRow: number, rows: number, app: Main): Array<DrawableText> {
    const result = [];
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
            const selectionColor = app.view.getColor("selection");

            content.push(new DrawableText(
                "", "selection@" + left + "@" + right, viewRow, 0, selectionColor, null
            ));
        }
    }
}

function renderDocumentAnchor(
    anchor: Position, name: string, content: Array<DrawableText>,
    lineIndex: number, view: Position, app: Main, drawRow: number): void
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
        const mark = Math.floor(tokenIndex / 5);
        const markColor = app.view.getColor(mark % 2 === 0 ? "token_0" : "token_5");
        const count = Math.floor((mark - 1) / 2) % 3 + 1;
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

function calculateRightMargin(row: number): number {
    row += 100;
    return Math.floor(Math.log(row) / Math.log(10) + 1);
}

function renderDocument(sub: DocumentSubscription, app: Main, rows: number, columns: number): Array<DrawableText>
{
    const doc = app.model.documents.get(sub.document);
    const anchorIndex = sub.anchorIndex;
    const view = doc.getView(anchorIndex);
    const rightMargin = calculateRightMargin(view.row);

    const result = [];
    const lines = doc.getLineCount();
    const selectionLeft = doc.getSelectionStart(anchorIndex);
    const selectionRight = doc.getSelectionEnd(anchorIndex);

    let longLineIndicator = false;

    for (let r = 0; r < rows; r++) {
        const lineIndex = view.row + r;

        // Indicate EOF by subtle marker
        if (lineIndex < 0 || lineIndex >= lines) {
            const eofColor = app.view.getColor("EOF");
            result.push(new DrawableText(
                "░", "", r, LEFT_MARGIN_COLUMNS, eofColor, null
            ));
            continue;
        } else {
            result.push(new DrawableText(
                (lineIndex + 1).toString(), "", r, columns - rightMargin,
                app.view.getColor("line_number"), null
            ));
        }

        renderDocumentSelection(
            selectionLeft, selectionRight,
            lineIndex, result, view, columns, app, r);

        renderDocumentAnchor(doc.getCursor(anchorIndex), "cursor", 
            result, lineIndex, view, app, r);

        renderDocumentAnchor(doc.getMark(anchorIndex), "mark", 
            result, lineIndex, view, app, r);

        const lineText = doc.getLine(lineIndex);
        const context = doc.getLineContext(lineIndex);
        const tokenization = app.languages.tokenize(
            lineText, context, new Position(lineIndex, 0), false);

        for (let tokenIndex = 0; tokenIndex < tokenization.tokens.length; tokenIndex++) {
            longLineIndicator = renderDocumentToken(tokenization, tokenIndex, view,
                app, columns - rightMargin, r, result, longLineIndicator);
        }
    }

    return result;
}

export function renderSubscription(sub: Subscription, topRow: number, rows: number, columns: number, app: Main): Array<DrawableText>
{
    let drawable = renderMargin(topRow, rows, app);

    try {
        if (sub instanceof DocumentSubscription) {
            drawable = drawable.concat(renderDocument(sub, app, rows, columns));
        } else if (sub instanceof NotFoundSubscription) {
            drawable = drawable.concat(renderError("Subscription not found for this window", app));
        } else {
            drawable = drawable.concat(renderError("Subscription type not recognized", app));
        }
    } catch (e) {
        drawable.concat(renderError("Render error: " + e.message, app));
        console.log(e);
    }

    return drawable;
}