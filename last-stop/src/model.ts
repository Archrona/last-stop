import { Store, Navigator, DataType, PathComponent } from "./store";
import { Position, splitIntoLines } from "./shared";

export class Anchor {
    constructor(public position: Position, public fixed: boolean) {
    
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
    
    remove(windowId: number): SubscriptionsNavigator {
        this.clearKey(windowId.toString());
        return this;
    }

    has(windowId: number): boolean {
        return this.hasKey(windowId.toString());
    }
}
 

export class DocumentsNavigator extends Navigator {
    constructor(store: Store, age: number, path: Array<PathComponent> = []) {
        super(store, age, path);
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
            contextChanges: [],
            anchors: {
                "cursor_0": { row: 0, column: 0, fixed: false },
                "mark_0": { row: 0, column: 0, fixed: false },
                "view_0": { row: 0, column: 0, fixed: true },
            },
            filename: filename,
            baseContext: [baseContext]
        });

        return this.get(name);
    }

    get(name: string): DocumentNavigator {
        return new DocumentNavigator(this, name);
    }
}

export class DocumentNavigator extends Navigator {
    constructor(base: DocumentsNavigator, name: string) {
        super(base.store, base.age, base.path.concat(name));
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
        return this.clone().goKey("baseContext").getJson() as Array<string>;
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
        return this.getBaseContext();   // TODO ACTUALLY DO IT
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

    insertAt(text: string, position: Position): DocumentNavigator {
        const linesToInsert = splitIntoLines(text);
        const pos = position.normalize(this);

        let targetLine = this.getLine(pos.row);
        let before = targetLine.substring(0, pos.column);
        let after = targetLine.substring(pos.column);

        if (linesToInsert.length === 1) {
            this.setLine(pos.row, before + text + after);
        } else {
            const toInsert = linesToInsert.slice(1);
            toInsert[toInsert.length - 1] += after;
            this.setLine(pos.row, before + linesToInsert[0]);
            this.clone().goKey("lines").insertItems(pos.row + 1, toInsert);
        }

        this._insertUpdateAnchors(pos, linesToInsert);
        return this;
    }

    insert(anchorIndex: number, text: string): DocumentNavigator {
        let cursor = this.getAnchor("cursor_" + anchorIndex);
        let mark = this.getAnchor("mark_" + anchorIndex);

        if (cursor.position.compareTo(mark.position) !== 0) {
            this.removeAt(cursor.position, mark.position);
        }
 
        return this.insertAt(text, this.getAnchor("cursor_" + anchorIndex).position);
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

    removeAt(p1: Position, p2: Position): DocumentNavigator {
        let [left, right] = Position.orderNormalize(p1, p2, this);
        
        let before = this.getLine(left.row).substring(0, left.column);
        let after = this.getLine(right.row).substring(right.column);
        
        if (right.row > left.row) {
            this.clone().goKey("lines").removeItems(left.row + 1, right.row + 1);
        }
        
        this.clone().goKey("lines").goIndex(left.row).setString(before + after);
        this._removeUpdateAnchors(left, right);
        return this;
    }
}

export class Model {
    store: Store;
    documents: DocumentsNavigator;
    subscriptions: SubscriptionsNavigator;
    views: Navigator;
    project: Navigator;
    
    constructor() {
        this.store = new Store({
            documents: { },
            subscriptions: { },
            views: { },
            project: {
                basePath: process.cwd()
            }
        });
        
        this.documents = this.store.getSpecialNavigator(DocumentsNavigator, ["documents"]);
        this.subscriptions = new SubscriptionsNavigator(this.store.getNavigator());
        this.views = this.store.getNavigator().goKey("views");
        this.project = this.store.getNavigator().goKey("project");
    }

}
