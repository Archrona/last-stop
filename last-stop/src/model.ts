import { Store, Navigator, DataType, PathComponent } from "./store";
import { Position, splitIntoLines } from "./shared";

export class Anchor {
    constructor(public position: Position, public fixed: boolean) {
    
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

    setLine(index: number, text: string): void {
        this.clone().goKey("lines").goIndex(index).setString(text);
    }

    setText(text: string): void {
        this.clearKey("lines");
        this.setKey("lines", splitIntoLines(text));
    }

    setAnchor(name: string, anchor: Anchor): void {
        let nav = this.clone().goKey("anchors").goKey(name);
        nav.goKey("row").setNumber(anchor.position.row);
        nav.goParent().goKey("column").setNumber(anchor.position.column);
        nav.goParent().goKey("fixed").setBoolean(anchor.fixed);
        return;
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

    insertTextAt(text: string, position: Position) {
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
            this.clone().goKey("lines").insert(pos.row + 1, toInsert);
        }

        this._insertUpdateAnchors(pos, linesToInsert);
    }

    insertText(text: string, anchorIndex: number) {
        // TODO: deal with remove if cursor !== mark

        this.insertTextAt(text, this.getAnchor("cursor_" + anchorIndex).position);
    }
}

export class Model {
    store: Store;
    documents: DocumentsNavigator;
    subscriptions: Navigator;
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
        this.subscriptions = this.store.getNavigator().goKey("subscriptions");
        this.views = this.store.getNavigator().goKey("views");
        this.project = this.store.getNavigator().goKey("project");

        
    }

}
