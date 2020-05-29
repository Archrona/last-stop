import { Store, Navigator, DataType, PathComponent } from "./store";
import { Position, splitIntoLines, binarySearchSparse, arrayEquals } from "./shared";
import { Languages } from "./language";
import { Main } from "./main";

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
        let str = this.get(windowId);

        let parts = str.trim().split("@");
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

export interface InsertOptions {
    lockMark?: boolean,
    enforceSpacing?: boolean,
    explainSpacing?: boolean
}

export class DocumentNavigator extends Navigator {
    app: Main;

    constructor(base: DocumentsNavigator, name: string, app: Main) {
        super(base.store, base.age, base.path.concat(name));
        this.app = app;
    }

    getText(): string {
        let nav = this.clone().goKey("lines");
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
        let [left, right] = Position.orderNormalize(p1, p2, this);
        let nav = this.clone().goKey("lines").goIndex(left.row);

        let result = "";
        for (let line = left.row; line <= right.row; line++, nav.goNextSibling()) {
            if (line > left.row) {
                result += "\n";
            }
            
            let text = nav.getString();
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
        let nav = this.clone().goKey("anchors").goKey(name);
        let row = nav.goKey("row").getNumber();
        let col = nav.goParent().goKey("column").getNumber();
        let fixed = nav.goParent().goKey("fixed").getBoolean();
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

    getLineContext(index: number): Array<string> {
        const contexts = this.clone().goKey("contexts");
        const length = contexts.getLength();

        if (index < 0 || index >= this.getLineCount()) {
            throw new Error("getLineContext: invalid line index");
        }       

        contexts.goIndex(index);
        return contexts.getJson() as Array<string>;
    }

    getPositionContext(position: Position): string {
        position = position.normalize(this);
        const lineContext = this.getLineContext(position.row);
        const lineText = this.getLine(position.row);

        const tokenization = this.app.languages.tokenize(
            lineText, lineContext, new Position(position.row, 0), true
        );
        
        let found = binarySearchSparse(0, tokenization.tokens.length, position.column, (x) =>
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

    setLine(index: number, text: string): void {
        this.clone().goKey("lines").goIndex(index).setString(text);
    }

    setText(text: string): void {
        this.clearKey("lines");
        this.setKey("lines", splitIntoLines(text));
    }

    setAnchor(name: string, anchor: Anchor): DocumentNavigator {
        let nav = this.clone().goKey("anchors").goKey(name);
        nav.goKey("row").setNumber(anchor.position.row);
        nav.goSiblingKey("column").setNumber(anchor.position.column);
        nav.goSiblingKey("fixed").setBoolean(anchor.fixed);
        return this;
    }

    setAnchorPosition(name: string, position: Position): DocumentNavigator {
        let nav = this.clone().goKey("anchors").goKey(name);
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
    
    setView(anchorIndex: number, position: Position): DocumentNavigator {
        this.setAnchorPosition("view_" + anchorIndex, position);
        return this;
    }

    newAnchor(name: string, anchor: Anchor): void {
        let nav = this.clone().goKey("anchors");
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
            this.getLine(firstLine), this.getLineContext(firstLine),
            new Position(firstLine, 0), false
        ).finalContextStack;

        let i = firstLine + 1;
        let length = this.getLineCount();

        while (i < length) {
            if (i >= lastLine && arrayEquals(lineStartContext, this.getLineContext(i))) {
                break;
            }

            this.clone().goKey("contexts").setIndex(i, lineStartContext);
            lineStartContext = Main.getApp().languages.tokenize(
                this.getLine(i), lineStartContext,
                new Position(i, 0), false
            ).finalContextStack;

            i++;
        }

        //console.log("_updateContexts [" + firstLine + ", " + lastLine + ") updated to " + (i - 1));
    }

    protected _insertUpdateAnchors(pos: Position, lines: Array<string>) {
        let names = this.getAnchorNames();
        for (const name of names) {
            let anchor = this.getAnchor(name);

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
        let contexts = this.clone().goKey("contexts");

        if (lines.length > 1) {
            let toInsert = [];
            for (let i = 1; i < lines.length; i++) {
                toInsert.push(null);
            }
            contexts.insertItems(pos.row + 1, toInsert);    
        }

        this._updateContexts(pos.row, pos.row + lines.length);
    }

    insertAt(text: string, position: Position, options: InsertOptions = {}): DocumentNavigator {
        
        const pos = position.normalize(this);
        let targetLine = this.getLine(pos.row);
        let before = targetLine.substring(0, pos.column);
        let after = targetLine.substring(pos.column);

        if (options.enforceSpacing === true) {
            let context = this.getPositionContext(position);
            let spaceLeft = this.app.languages.shouldSpace(context, before, text);
            let spaceRight = this.app.languages.shouldSpace(context, text, after);

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

        const linesToInsert = splitIntoLines(text);
        
        

        if (linesToInsert.length === 1) {
            this.setLine(pos.row, before + text + after);
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

    insert(anchorIndex: number, text: string, options: InsertOptions = {}): DocumentNavigator {
        let cursor = this.getAnchor("cursor_" + anchorIndex);
        let mark = this.getAnchor("mark_" + anchorIndex);

        if (cursor.position.compareTo(mark.position) !== 0) {
            this.removeAt(cursor.position, mark.position);
        }
 
        let result = this.insertAt(text, this.getAnchor("cursor_" + anchorIndex).position, options);

        if (options.lockMark === true) {
            this.setMark(anchorIndex, mark.position);
        }

        return result;
    }

    protected _removeUpdateAnchors(left: Position, right: Position): void {
        let names = this.getAnchorNames();

        for (const name of names) {
            let anchor = this.getAnchor(name);
            
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
        let contexts = this.clone().goKey("contexts");

        if (right.row > left.row) {
            contexts.removeItems(left.row + 1, right.row + 1);    
        }

        this._updateContexts(left.row, left.row + 1);
    }

    removeAt(p1: Position, p2: Position): DocumentNavigator {
        let [left, right] = Position.orderNormalize(p1, p2, this);
        
        let before = this.getLine(left.row).substring(0, left.column);
        let after = this.getLine(right.row).substring(right.column);
        
        if (right.row > left.row) {
            this.clone().goKey("lines").removeItems(left.row + 1, right.row + 1);
        }
        
        this.clone().goKey("lines").goIndex(left.row).setString(before + after);
        this._removeUpdateAnchors(left, right);
        this._removeUpdateContexts(left, right);

        return this;
    }

    remove(anchorIndex: number): DocumentNavigator {
        let cursor = this.getAnchor("cursor_" + anchorIndex);
        let mark = this.getAnchor("mark_" + anchorIndex);
            
        return this.removeAt(cursor.position, mark.position);
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
        let info = this.subscriptions.getDetails(this.getActiveWindow());

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
        let sub = this.subscriptions.get(window);
        let parts = sub.split("@");

        if (parts[0] === "doc") {
            let name = parts[1];
            let anchorIndex = parseInt(parts[2]);
            
            if (name === undefined || name.length < 0 || typeof anchorIndex !== "number") {
                throw new Error("Can't get context for malformed document subscription");
            }

            let doc = this.documents.get(name);
            return doc.getCursorContext(anchorIndex, this.app.languages);
        } else {
            return "basic";
        }
    }

    getCurrentContext(): string {
        let window = this.getActiveWindow();

        if (window === null) {
            return "basic";
        } else {
            return this.getWindowContext(window);
        }
    }
}
