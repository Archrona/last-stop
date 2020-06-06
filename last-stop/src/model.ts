import { Store, Navigator, DataType, PathComponent } from "./store";
import { Position, splitIntoLines, binarySearchSparse, arrayEquals, IndentationPolicy, INSERTION_POINT, replaceAll } from "./shared";
import { Languages, TokenizeResult } from "./language";
import { Main } from "./main";
import { Speech } from "./speech";
import { inspect } from "util";
import { clipboard, contextBridge } from "electron";

export interface InsertOptions {
    lockMark?: boolean;
    enforceSpacing?: boolean;
    explainSpacing?: boolean;
    escapes?: boolean;
    escapeArguments?: Array<string>;
}

export class Anchor {
    constructor(public position: Position, public fixed: boolean) {
    
    }
}

export abstract class Subscription {
    constructor(public type: string) { }
}

export class DocumentSubscription extends Subscription {
    document: string;
    anchorIndex: number;

    constructor(document: string, anchorIndex: number) {
        super("doc");
        this.document = document;
        this.anchorIndex = anchorIndex;
    }
}

export class LineSubscription extends Subscription {
    line: number;

    constructor(type: string, line: number) {
        super(type);
        this.line = line;
    }
}


export class SubscriptionsNavigator extends Navigator {
    constructor(base: Navigator) {
        super(base.store, base.age, base.path.concat("subscriptions"));
    }
    
    set(windowId: number, subscription: string): SubscriptionsNavigator {
        this.setKey(windowId.toString(), subscription);
        return this;
    }
    
    get(windowId: number): string {
        return this.clone().goKey(windowId.toString()).getString();
    }
    
    getDetails(windowId: number): Subscription {
        const str = this.get(windowId);

        const parts = str.trim().split("@");
        if (parts.length <= 0) {
            throw new Error("Empty subscription on window " + windowId);
        }

        switch (parts[0]) {
            case "doc": 
                if (parts.length <= 2 || parts[1].length <= 0 || !/^\d+$/.test(parts[2])) {
                    throw new Error("Invalid doc subscription");
                }   
                return new DocumentSubscription(parts[1], parseInt(parts[2]));

            case "project":
            case "documents":
            case "imagination":
                if (parts.length <= 1 || !/^\d+$/.test(parts[1])) {
                    throw new Error("Invalid " + parts[0] + " subscription");
                }
                return new LineSubscription(parts[0], parseInt(parts[1]));

            default:
                throw new Error("Invalid subscription type " + parts[0]);
        }
    }

    remove(windowId: number): SubscriptionsNavigator {
        this.clearKey(windowId.toString());
        return this;
    }

    has(windowId: number): boolean {
        return this.hasKey(windowId.toString());
    }
}
 

export class DocumentsNavigator extends Navigator {
    app: Main;

    constructor(base: Navigator, app: Main) {
        super(base.store, base.age, base.path.concat("documents"));
        this.app = app;
    }

    add(name: string, baseContext: string, filename: string | null = null): DocumentNavigator {
        if (this.hasKey(name)) {
            throw new Error("Cannot add document that already exists");
        }
        if (name === "") {
            throw new Error("Cannot create document with empty name");
        }

        this.setKey(name, {
            name: name,
            modified: null,
            lines: [""],
            contexts: [[baseContext]],
            anchors: {
                "cursor_0": { row: 0, column: 0, fixed: false },
                "mark_0": { row: 0, column: 0, fixed: false },
                "view_0": { row: 0, column: 0, fixed: true },
            },
            filename: filename
        });

        return this.get(name);
    }

    get(name: string): DocumentNavigator {
        return new DocumentNavigator(this, name, this.app);
    }
}



export class DocumentNavigator extends Navigator {
    app: Main;

    constructor(base: DocumentsNavigator, name: string, app: Main) {
        super(base.store, base.age, base.path.concat(name));
        this.app = app;
    }

    getText(): string {
        const nav = this.clone().goKey("lines");
        let result = "";
        let first = true;
        
        nav.mapList(n => {
            if (!first) result += "\n";
            first = false;
            result += n.getString();
        });

        return result;
    }

    getRange(p1: Position, p2: Position) {
        const [left, right] = Position.orderNormalize(p1, p2, this);
        const nav = this.clone().goKey("lines").goIndex(left.row);

        let result = "";
        for (let line = left.row; line <= right.row; line++, nav.goNextSibling()) {
            if (line > left.row) {
                result += "\n";
            }
            
            const text = nav.getString();
            result += text.substring(
                line === left.row ? left.column : 0,
                line === right.row ? right.column : undefined
            )
        }

        return result;
    }

    getLine(index: number): string {
        return this.clone().goKey("lines").goIndex(index).getString();
    }

    getLines(): Array<string> {
        return this.clone().goKey("lines").getJson() as Array<string>;
    }

    getLineCount(): number {
        return this.clone().goKey("lines").getLength();
    }

    getBaseContext(): Array<string> {
        return this.clone().goKey("contexts").goIndex(0).getJson() as Array<string>;
    }

    getAnchor(name: string): Anchor {
        const nav = this.clone().goKey("anchors").goKey(name);
        const row = nav.goKey("row").getNumber();
        const col = nav.goParent().goKey("column").getNumber();
        const fixed = nav.goParent().goKey("fixed").getBoolean();
        return new Anchor(new Position(row, col), fixed);
    }

    getAnchorNames(): Array<string> {
        return this.clone().goKey("anchors").getKeys();
    }

    getCursor(anchorIndex: number): Position {
        return this.getAnchor("cursor_" + anchorIndex).position;
    }  

    getMark(anchorIndex: number): Position {
        return this.getAnchor("mark_" + anchorIndex).position;
    }

    getView(anchorIndex: number): Position {
        return this.getAnchor("view_" + anchorIndex).position;
    }  

    getSelectionStart(anchorIndex: number): Position {
        const cursor = this.getCursor(anchorIndex);
        const mark = this.getMark(anchorIndex);
        if (cursor.compareTo(mark) < 0) {
            return cursor;
        }
        else {
            return mark;
        }
    } 
    
    getSelectionEnd(anchorIndex: number): Position {
        const cursor = this.getCursor(anchorIndex);
        const mark = this.getMark(anchorIndex);
        if (cursor.compareTo(mark) > 0) {
            return cursor;
        }
        else {
            return mark;
        }
    }

    getLineContext(index: number): Array<string> {
        const contexts = this.clone().goKey("contexts");
        const length = contexts.getLength();

        if (index < 0 || index >= this.getLineCount()) {
            throw new Error("getLineContext: invalid line index");
        }       

        contexts.goIndex(index);
        return contexts.getJson() as Array<string>;
    }

    getLineTokens(index: number, includeWhite = false): TokenizeResult {
        const lineContext = this.getLineContext(index);
        const lineText = this.getLine(index);

        return this.app.languages.tokenize(
            lineText, lineContext, new Position(index, 0), includeWhite
        );
    }

    getPositionContext(position: Position): string {
        position = position.normalize(this);
        const lineContext = this.getLineContext(position.row);
        const lineText = this.getLine(position.row);

        const tokenization = this.app.languages.tokenize(
            lineText, lineContext, new Position(position.row, 0), true
        );
        
        const found = binarySearchSparse(0, tokenization.tokens.length, position.column, (x) =>
            tokenization.tokens[x].position.column
        );

        if (found === -1) {
            return lineContext[lineContext.length - 1];
        }
        else {
            return tokenization.tokens[found].context;
        }
    }

    getAnchorContext(anchor: string, languages: Languages): string {
        return this.getPositionContext(this.getAnchor(anchor).position);
    }

    getCursorContext(anchorIndex: number, languages: Languages): string {
        return this.getAnchorContext("cursor_" + anchorIndex, languages);
    }

    getIndentationPolicy(): IndentationPolicy {
        // TODO
        // TODO
        // TODO

        return IndentationPolicy.spaces(4);
    }

    getSelection(anchorIndex: number): string {
        return this.getRange(this.getCursor(anchorIndex), this.getMark(anchorIndex));
    }

    findInRange(s: string, p1: Position, p2: Position, onlyFirst = false): Array<Position> {
        if (s.length <= 0) {
            throw new Error("findInRange: search string must not be empty");
        }

        const [left, right] = Position.orderNormalize(p1, p2, this);
        const nav = this.clone().goKey("lines").goIndex(left.row);
        const result = [];

        for (let line = left.row; line <= right.row; line++, nav.goNextSibling()) {
            const text = nav.getString();

            const margin = (line === left.row ? left.column : 0);
            const inScope = text.substring(
                line === left.row ? left.column : 0,
                line === right.row ? right.column : undefined
            );

            let col = inScope.indexOf(s);
            while (col !== -1) {
                result.push(new Position(line, margin + col));
                if (onlyFirst) {
                    return result;
                }

                col = inScope.indexOf(s, col + s.length);
            }
        }

        return result;
    }

    findFirstInRange(s: string, p1: Position, p2: Position): Position | null {
        const result = this.findInRange(s, p1, p2, true);

        if (result.length === 0) {
            return null;
        } else {
            return result[0];
        }
    }

    replaceInRange(from: string, to: string, p1: Position, p2: Position): DocumentNavigator {
        const text = this.getRange(p1, p2);
        const replaced = replaceAll(text, from, to);

        if (text !== replaced) {
            const [left, right] = Position.orderNormalize(p1, p2, this);
            this.removeAt(left, right);
            this.insertAt(replaced, left);
        }

        return this;
    }

    setLine(index: number, text: string): void {
        this.clone().goKey("lines").goIndex(index).setString(text);
    }

    setText(text: string): void {
        this.clearKey("lines");
        this.setKey("lines", splitIntoLines(text));
    }

    setAnchor(name: string, anchor: Anchor): DocumentNavigator {
        const nav = this.clone().goKey("anchors").goKey(name);
        nav.goKey("row").setNumber(anchor.position.row);
        nav.goSiblingKey("column").setNumber(anchor.position.column);
        nav.goSiblingKey("fixed").setBoolean(anchor.fixed);
        return this;
    }

    setAnchorPosition(
        name: string,
        position: Position,
        normalize = true
    ): DocumentNavigator {
        const nav = this.clone().goKey("anchors").goKey(name);

        if (normalize) {
            position = position.normalize(this);
        }

        nav.goKey("row").setNumber(position.row);
        nav.goSiblingKey("column").setNumber(position.column);
        return this;
    }

    setCursor(anchorIndex: number, position: Position): DocumentNavigator {
        this.setAnchorPosition("cursor_" + anchorIndex, position);
        return this;
    }
    
    setMark(anchorIndex: number, position: Position): DocumentNavigator {
        this.setAnchorPosition("mark_" + anchorIndex, position);
        return this;
    }

    setCursorAndMark(anchorIndex: number, position: Position): DocumentNavigator {
        this.setCursor(anchorIndex, position);
        this.setMark(anchorIndex, position);
        return this;
    }

    setSelection(anchorIndex: number, p1: Position, p2: Position): DocumentNavigator {
        const [left, right] = Position.orderNormalize(p1, p2, this);
        this.setMark(anchorIndex, left);
        this.setCursor(anchorIndex, right);
        return this;
    }

    setSelectionEOL(anchorIndex: number, removeInsertionPoints = false): DocumentNavigator {
        const [left, right] = Position.orderNormalize(
            this.getCursor(anchorIndex), this.getMark(anchorIndex), this);

        if (removeInsertionPoints) {
            const eol = new Position(left.row, this.getLine(left.row).length);
            this.replaceInRange(INSERTION_POINT, "", left, eol);
        }

        this.setCursorAndMark(anchorIndex, 
            new Position(right.row, this.getLine(right.row).length));
            
        return this;
    }
    
    setView(anchorIndex: number, position: Position): DocumentNavigator {
        this.setAnchorPosition("view_" + anchorIndex, position, false);
        return this;
    }

    newAnchor(name: string, anchor: Anchor): void {
        const nav = this.clone().goKey("anchors");
        if (nav.hasKey(name)) {
            throw new Error("newAnchor: anchor " + name + " already exists");
        }

        nav.setKey(name, {
            row: anchor.position.row,
            column: anchor.position.column,
            fixed: anchor.fixed
        });
    }

    // Lines [firstLine, lastLine) were modified.
    // Assuming firstLine is still STARTING at the same context,
    // update up to and including lastLine (if it exists)
    // and keep going if necessary until all contexts are updated
    protected _updateContexts(firstLine: number, lastLine: number) {

        let lineStartContext = this.app.languages.tokenize(
            this.getLine(firstLine) + "\n", this.getLineContext(firstLine),
            new Position(firstLine, 0), false
        ).finalContextStack;

        let i = firstLine + 1;
        const length = this.getLineCount();

        while (i < length) {
            if (i >= lastLine && arrayEquals(lineStartContext, this.getLineContext(i))) {
                break;
            }

            this.clone().goKey("contexts").setIndex(i, lineStartContext);
            lineStartContext = this.app.languages.tokenize(
                this.getLine(i) + "\n", lineStartContext,
                new Position(i, 0), false
            ).finalContextStack;

            i++;
        }
    }

    protected _insertUpdateAnchors(pos: Position, lines: Array<string>) {
        const names = this.getAnchorNames();
        for (const name of names) {
            const anchor = this.getAnchor(name);

            if (anchor.fixed) continue;
            if (anchor.position.compareTo(pos) < 0) continue;

            if (anchor.position.row === pos.row) {
                if (lines.length === 1) {
                    anchor.position.column += lines[0].length;
                } else {
                    anchor.position.column += lines[lines.length - 1].length - pos.column;
                }
            }

            anchor.position.row += lines.length - 1;

            this.setAnchor(name, anchor);
        }
    }

    protected _insertUpdateContexts(pos: Position, lines: Array<string>): void {
        // Resize if appropriate
        const contexts = this.clone().goKey("contexts");

        if (lines.length > 1) {
            const toInsert = [];
            for (let i = 1; i < lines.length; i++) {
                toInsert.push(null);
            }
            contexts.insertItems(pos.row + 1, toInsert);    
        }

        this._updateContexts(pos.row, pos.row + lines.length);
    }

    protected _insertProcessEscapes(text: string, options: InsertOptions, targetLine: string): string {
        if (options.escapes !== true) {
            return text;
        }
        
        let leading = IndentationPolicy.splitMarginContent(targetLine)[0];
        const policy = this.getIndentationPolicy();
        let spongeWhite = false;
        let result = "";
        let i = 0;
        
        while (i < text.length) {
            if (text[i] === "$" && i + 1 < text.length) {
                switch (text[i + 1]) {
                    case "$":
                        result += "$";
                        break;

                    case "n":
                        result += "\n" + leading;
                        break;

                    case "u":
                        leading = policy.indent(leading);
                        result += "\n" + leading;
                        break;

                    case "d":
                        leading = policy.unindent(leading);
                        result += "\n" + leading;
                        break;

                    case "t":
                        result += "\t";
                        break;

                    case "g":
                        // no-op. glue doesn't output anything
                        break;

                    case "_":
                        result += INSERTION_POINT;
                        break;

                    case "1":
                    case "2":
                    case "3":
                        {
                            const index = parseInt(text[i + 1]) - 1;
                            if (options.escapeArguments === undefined || index >= options.escapeArguments.length) {
                                throw new Error("_insertProcessEscapes: argument " + (index + 1) + " not found");
                            }
                            
                            result += options.escapeArguments[index];
                        }
                        break;
                    
                    default:
                        result += text[i + 1];
                }

                i += 2;
            }
            else {
                result += text[i];
                i += 1;
            }
        }

        return result;
    }

    insertAt(text: string, position: Position, options: InsertOptions = {}): DocumentNavigator {
        const pos = position.normalize(this);
        const targetLine = this.getLine(pos.row);
        const before = targetLine.substring(0, pos.column);
        let after = targetLine.substring(pos.column);

        if (options.enforceSpacing === true) {
            const context = this.getPositionContext(position);
            const spaceLeft = this.app.languages.shouldSpace(context, before, text);
            const spaceRight = this.app.languages.shouldSpace(context, text, after);

            if (options.explainSpacing === true) {
                console.log("---");
                console.log("BEFORE to TEXT: ");
                console.log(this.app.languages.shouldSpaceExplain(context, before, text));
                console.log("TEXT to AFTER: ");
                console.log(this.app.languages.shouldSpaceExplain(context, text, after));
            }
            
            if (spaceLeft) {
                text = " " + text;
            }

            if (spaceRight) {
                text += " ";
            }
        }

        const escaped = this._insertProcessEscapes(text, options, targetLine);
        const linesToInsert = splitIntoLines(escaped);

        // Fix janky spacing on last line of multiline insert
        if (options.escapes === true
            && linesToInsert.length > 1 
            && /^\s*$/.test(linesToInsert[linesToInsert.length - 1]))
        {
            after = after.trimLeft();
        }

        if (linesToInsert.length === 1) {
            this.setLine(pos.row, before + escaped + after);
        } else {
            const toInsert = linesToInsert.slice(1);
            toInsert[toInsert.length - 1] += after;
            this.setLine(pos.row, before + linesToInsert[0]);
            this.clone().goKey("lines").insertItems(pos.row + 1, toInsert);
        }

        this._insertUpdateAnchors(pos, linesToInsert);
        this._insertUpdateContexts(pos, linesToInsert);

        return this;
    }

    seekInsertionPoint(anchorIndex: number, from: Position, to: Position): void {
        const found = this.findInRange(INSERTION_POINT, from, to);
        if (found.length > 0) {
            this.setMark(anchorIndex, found[0]);
            found[0].column++;
            this.setCursor(anchorIndex, found[0]);
        }
    }

    insert(anchorIndex: number, text: string, options: InsertOptions = {}): DocumentNavigator {
        const cursor = this.getAnchor("cursor_" + anchorIndex);
        const mark = this.getAnchor("mark_" + anchorIndex);

        if (cursor.position.compareTo(mark.position) !== 0) {
            this.removeAt(cursor.position, mark.position);
        }
 
        const pos = this.getCursor(anchorIndex);
        const result = this.insertAt(text, pos, options);

        if (options.lockMark === true) {
            this.setMark(anchorIndex, mark.position);
        } else {
            if (options.escapes === true) {
                this.seekInsertionPoint(anchorIndex, pos, this.getCursor(anchorIndex));
            }
        }

        return result;
    }



    protected _removeUpdateAnchors(left: Position, right: Position): void {
        const names = this.getAnchorNames();

        for (const name of names) {
            const anchor = this.getAnchor(name);
            
            if (anchor.fixed || anchor.position.compareTo(left) <= 0) {
                continue;
            }
            else if (anchor.position.compareTo(right) <= 0) {
                anchor.position = left;
            }
            else {
                if (anchor.position.row === right.row) {
                    anchor.position.column = left.column + (anchor.position.column - right.column);
                }
                anchor.position.row -= right.row - left.row;
            }

            this.setAnchorPosition(name, anchor.position);
        }
    }

    protected _removeUpdateContexts(left: Position, right: Position): void {
        // Resize if appropriate
        const contexts = this.clone().goKey("contexts");

        if (right.row > left.row) {
            contexts.removeItems(left.row + 1, right.row + 1);    
        }

        this._updateContexts(left.row, left.row + 1);
    }

    removeAt(p1: Position, p2: Position): DocumentNavigator {
        const [left, right] = Position.orderNormalize(p1, p2, this);
        
        const before = this.getLine(left.row).substring(0, left.column);
        const after = this.getLine(right.row).substring(right.column);
        
        if (right.row > left.row) {
            this.clone().goKey("lines").removeItems(left.row + 1, right.row + 1);
        }
        
        this.clone().goKey("lines").goIndex(left.row).setString(before + after);
        this._removeUpdateAnchors(left, right);
        this._removeUpdateContexts(left, right);

        return this;
    }

    remove(anchorIndex: number): DocumentNavigator {
        const cursor = this.getAnchor("cursor_" + anchorIndex);
        const mark = this.getAnchor("mark_" + anchorIndex);
            
        return this.removeAt(cursor.position, mark.position);
    }

    removeLine(index: number): DocumentNavigator {
        if (index < 0 || index >= this.getLineCount()) {
            throw new Error("removeLine: Can't remove nonexistent line (out of range)");
        }

        return this.removeAt(new Position(index, 0), new Position(index + 1, 0));
    }

    removeAdjacentInsertionPoints(anchorIndex: number): DocumentNavigator {
        if (this.getSelection(anchorIndex).trim() === INSERTION_POINT) {
            this.remove(anchorIndex);
        } else {
            const [first, last] = Position.orderNormalize(
                this.getCursor(anchorIndex), this.getMark(anchorIndex), this);

            const lastNext = new Position(last.row, last.column + 1);
            if (this.getRange(last, lastNext) === INSERTION_POINT) {
                this.removeAt(last, lastNext);
            }

            if (first.column > 0) {
                const firstPrev = new Position(first.row, first.column - 1);
                if (this.getRange(firstPrev, first) === INSERTION_POINT) {
                    this.removeAt(firstPrev, first);
                }
            }
        }
        
        return this;
    }

    spongeIfEmptyLine(anchorIndex: number): DocumentNavigator {
        const cursor = this.getCursor(anchorIndex);
        const line = this.getLine(cursor.row);
        
        if (/^\s*$/.test(line)) {
            this.removeLine(cursor.row);
            this.setCursorAndMark(anchorIndex, new Position(cursor.row - 1, Number.MAX_SAFE_INTEGER));
        }

        return this;
    }

    spongeAfterSelection(anchorIndex: number): DocumentNavigator {
        const end = this.getSelectionEnd(anchorIndex);
        const line = this.getLine(end.row);

        let right = end.column;
        while (right < line.length && (line[right] === ' ' || line[right] === '\t')) {
            right++;
        }

        this.removeAt(end, new Position(end.row, right));
        return this;
    }

    spongeBeforeSelection(anchorIndex: number): DocumentNavigator {
        const begin = this.getSelectionStart(anchorIndex);
        const line = this.getLine(begin.row);

        let left = begin.column;
        while (left > 0 && (line[left - 1] === ' ' || line[left - 1] === '\t')) {
            left--;
        }

        this.removeAt(new Position(begin.row, left), begin);
        return this;
    }

    spongeSides(anchorIndex: number): DocumentNavigator {
        this.spongeAfterSelection(anchorIndex);
        return this.spongeBeforeSelection(anchorIndex);
    }

    spongeAboveSelection(anchorIndex: number): DocumentNavigator {
        const begin = this.getSelectionStart(anchorIndex);
        let top = begin.row;
        
        while (top > 0 && /^\s*$/.test(this.getLine(top - 1))) {
            top--;

        }
        if (top < begin.row) {
            const start = new Position(top, 0);
            const end = new Position(begin.row, 0);
            this.removeAt(start, end);
        }
        
        return this;
    }

    spongeBelowSelection(anchorIndex: number): DocumentNavigator {
        const end = this.getSelectionEnd(anchorIndex);
        let bottom = end.row;
        
        while (bottom < this.getLineCount() - 1 && /^\s*$/.test(this.getLine(bottom + 1))) {
            bottom++;
        }
        if (bottom > end.row) {
            const start = new Position(end.row + 1, 0);
            const finish = new Position(bottom + 1, 0);
            this.removeAt(start, finish);
        }
        
        return this;
    }

    haloBeforeSelection(anchorIndex: number): DocumentNavigator {
        this.spongeBeforeSelection(anchorIndex);
        let target = this.getSelectionStart(anchorIndex);
        this.insertAt(" ", target, {  });
        return this;
    } 
    
    haloAfterSelection(anchorIndex: number): DocumentNavigator {
        this.spongeAfterSelection(anchorIndex);
        let target = this.getSelectionEnd(anchorIndex);
        this.insertAt(" ", target, {  });
        return this;
    } 
    
    haloAboveSelection(anchorIndex: number): DocumentNavigator {
        this.spongeAboveSelection(anchorIndex); 
        
        let target = this.getSelectionStart(anchorIndex);
        target.column = 0; 
        
        this.insertAt("$n", target, { escapes: true });
        return this;
    } 
    
    haloBelowSelection(anchorIndex: number): DocumentNavigator {
        this.spongeBelowSelection(anchorIndex); 
        
        let target = this.getSelectionEnd(anchorIndex);
        target.row++;
        target.column = 0;
        
        this.insertAt("$n", target, { escapes: true });
        return this;
    } 
    

    step(anchorIndex: number): DocumentNavigator {
        this.removeAdjacentInsertionPoints(anchorIndex);
        this.spongeIfEmptyLine(anchorIndex);

        const cursor = this.getCursor(anchorIndex);
        const endScope = new Position(cursor.row + 10, Number.MAX_SAFE_INTEGER);
        
        const found = this.findFirstInRange(INSERTION_POINT, cursor, endScope);

        if (found !== null) {
            const nextChar = new Position(found.row, found.column + 1);
            this.setSelection(anchorIndex, found, nextChar);
        }

        return this;
    }

    osPaste(anchorIndex: number): DocumentNavigator {
        const text = clipboard.readText();

        // paste before first non-white character?
        // perform indentation adjustment to match doc
        const left = this.getSelectionStart(anchorIndex);
        const leftLine = this.getLine(left.row);
        const indent = this.getIndentationPolicy();
        const lines = splitIntoLines(text);
        const parts = lines.map(x => IndentationPolicy.splitMarginContent(x));
        
        // One line paste after left margin -- just a plain insert
        if (lines.length === 1 && left.column > parts[0].length) {
            return this.insert(anchorIndex, text, {
                enforceSpacing: true
            });
        }

        // One line paste at left margin -- FOR NOW, just a plain insert
        // TODO: auto-indent based on previous line?
        if (lines.length === 1) {
            return this.insert(anchorIndex, text, {
                enforceSpacing: true
            });
        }

        // Multi-line paste
        // Get min indent across all lines excepting first
        let min = Number.MAX_SAFE_INTEGER;
        const sizes = parts.map(x => indent.getMarginColumns(x[0]));
        for (let i = 1; i < sizes.length; i++) {
            if (sizes[i] < min && parts[i][1].length > 0) {
                min = sizes[i];
            }
        }

        if (min === Number.MAX_SAFE_INTEGER) {
            min = 0;
        }

        let newMargin = indent.normalizeWhite(IndentationPolicy.splitMarginContent(leftLine)[0]);
        let toInsert = "";

        // If we're at BOL of 1st line, replace indent
        if (left.column > parts[0].length) {
            this.spongeBeforeSelection(anchorIndex);
            this.spongeAfterSelection(anchorIndex);
            toInsert += newMargin;
        }
        toInsert += parts[0][1];

        let mod = this.app.languages.shouldIndent(this.getPositionContext(left), parts[0][1]);
        if (mod > 0) {
            newMargin = indent.indent(newMargin, 1);
        } else if (mod < 0) {
            newMargin = indent.unindent(newMargin, 1);
        }

        console.log(min);
        console.log(mod);
        console.log(parts);
        console.log(sizes);

        let lastSize = sizes[0];

        for (let i = 1; i < parts.length; i++) {
            if (parts[i][1].length === 0) {
                toInsert += "\n" + indent.normalizeWhite(newMargin + " ".repeat(lastSize - min));;
            } else {
                const lineMargin = indent.normalizeWhite(newMargin + " ".repeat(sizes[i] - min));
                lastSize = sizes[i];
                toInsert += "\n" + lineMargin + parts[i][1];
            }
        }

        return this.insert(anchorIndex, toInsert, {
            enforceSpacing: true;
        });
    }

    osCopy(anchorIndex: number): DocumentNavigator {
        const text = this.getSelection(anchorIndex);
        clipboard.writeText(text);
        return this;
    } 
    
    osCut(anchorIndex: number): DocumentNavigator {
        const text = this.getSelection(anchorIndex);
        this.remove(anchorIndex);
        clipboard.writeText(text);
        return this;
    }

    selectAll(anchorIndex: number): DocumentNavigator {
        this.setMark(anchorIndex, new Position(0, 0));
        let cursor = new Position(this.getLineCount(), 0).normalize(this);
        this.setCursor(anchorIndex, cursor);
        return this;
    }

    osCursorUp(anchorIndex: number): DocumentNavigator {
        let cursor = this.getSelectionStart(anchorIndex);
        if (cursor.row > 0) {
            cursor.row--;
            this.setCursorAndMark(anchorIndex, cursor);
        }
        return this;
    }

    osCursorDown(anchorIndex: number): DocumentNavigator {
        let cursor = this.getSelectionEnd(anchorIndex);
        if (cursor.row + 1 < this.getLineCount()) {
            cursor.row++;
            this.setCursorAndMark(anchorIndex, cursor);
        }
        return this;
    } 
    
    osCursorLeft(anchorIndex: number): DocumentNavigator {
        let cursor = this.getSelectionStart(anchorIndex);
        if (cursor.column > 0) {
            cursor.column--;
        } else {
            cursor = new Position(cursor.row - 1, Number.MAX_SAFE_INTEGER);
        }

        this.setCursorAndMark(anchorIndex, cursor);
        return this;
    }

    osCursorRight(anchorIndex: number): DocumentNavigator {
        let cursor = this.getSelectionStart(anchorIndex);
        if (cursor.column < this.getLine(cursor.row).length) {
            cursor.column++;
        } else {
            cursor = new Position(cursor.row + 1, 0);
        }

        this.setCursorAndMark(anchorIndex, cursor);
        return this;
    }

    osBackspace(anchorIndex: number): DocumentNavigator {
        if (this.getCursor(anchorIndex).compareTo(this.getMark(anchorIndex)) === 0) {
            const original = this.getCursor(anchorIndex);
            this.osCursorLeft(anchorIndex);
            this.removeAt(this.getCursor(anchorIndex), original);
        }
        else {
            this.remove(anchorIndex);
        }
        return this;
    }

    osDelete(anchorIndex: number): DocumentNavigator {
        if (this.getCursor(anchorIndex).compareTo(this.getMark(anchorIndex)) === 0) {
            const original = this.getCursor(anchorIndex);
            this.osCursorRight(anchorIndex);
            this.removeAt(this.getCursor(anchorIndex), original);
        }
        else {
            this.remove(anchorIndex);
        }
        return this;
    }

    osKey(anchorIndex: number, key: string): DocumentNavigator {
        switch (key) {
            case "C-v":
                this.osPaste(anchorIndex);
                break;
            case "C-c":
                this.osCopy(anchorIndex);
                break;
            case "C-x":
                this.osCut(anchorIndex);
                break;
            case "C-a":
                this.selectAll(anchorIndex);
                break;
            case "ArrowUp":
                this.osCursorUp(anchorIndex);
                break;
            case "ArrowDown":
                this.osCursorDown(anchorIndex);
                break;
            case "ArrowLeft":
                this.osCursorLeft(anchorIndex);
                break;
            case "ArrowRight":
                this.osCursorRight(anchorIndex);
                break;
            case "Backspace":
                this.osBackspace(anchorIndex);
                break;
            case "Delete":
                this.osDelete(anchorIndex);
                break;
        }

        return this;
    }
}

export class Model {
    app: Main;
    store: Store;
    documents: DocumentsNavigator;
    subscriptions: SubscriptionsNavigator;
    project: Navigator;
    
    constructor(app: Main) {
        this.app = app;

        this.store = new Store({
            documents: { },
            subscriptions: { },
            project: {
                basePath: process.cwd(),
            },
            activeWindow: 0
        });
        
        this.documents = new DocumentsNavigator(this.store.getNavigator(), this.app);
        this.subscriptions = new SubscriptionsNavigator(this.store.getNavigator());
        this.project = this.store.getNavigator().goKey("project");
    }

    getActiveWindow(): number {
        return this.store.getNavigator().goKey("activeWindow").getNumber();
    }

    setActiveWindow(index: number): void {
        this.store.getNavigator().goKey("activeWindow").setNumber(index);
    }

    getActiveDocument(): [DocumentNavigator, number] | null {
        const info = this.subscriptions.getDetails(this.getActiveWindow());

        if (info instanceof DocumentSubscription) {
            const docName = (info as DocumentSubscription).document;
            if (this.documents.hasKey(docName)) {
                return [this.documents.get(docName), (info as DocumentSubscription).anchorIndex];
            }
        }

        return null;
    }
    
    doActiveDocument(callback: (doc: DocumentNavigator, anchorIndex: number) => void) {
        let doc: [DocumentNavigator, number];
        if ((doc = this.getActiveDocument()) !== null) {
            callback(doc[0], doc[1]);
        }
    }

    getWindowContext(window: number): string {
        const sub = this.subscriptions.get(window);
        const parts = sub.split("@");

        if (parts[0] === "doc") {
            const name = parts[1];
            const anchorIndex = parseInt(parts[2]);
            
            if (name === undefined || name.length < 0 || typeof anchorIndex !== "number") {
                throw new Error("Can't get context for malformed document subscription");
            }

            const doc = this.documents.get(name);
            return doc.getCursorContext(anchorIndex, this.app.languages);
        } else {
            return "basic";
        }
    }

    getCurrentContext(): string {
        const window = this.getActiveWindow();

        if (window === null) {
            return "basic";
        } else {
            return this.getWindowContext(window);
        }
    }
}
