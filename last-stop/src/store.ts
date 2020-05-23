
export enum DataType {
    Number,
    String, 
    Boolean,
    Null,
    List,
    Map
}

export type PathComponent = string | number;
export type Path = Array<PathComponent>;

export type Transform = (store: Store) => any;

export abstract class StoreNode {
    parent: StoreNode;
    
    constructor(parent: StoreNode) {
        this.parent = parent;
    }
    
    // Disconnects from parent tree and returns json representation of self
    // Because this tree will have no references pointing at it afterward (we hope)
    // it'll be queued for destruction
    detach(): any {
        let json = this.getJson();
        this.parent = null;
        return json;
    }

    detachWithoutJson(): void {
        this.parent = null;
    }

    abstract getJson(): any;
    abstract getType(): DataType;
    abstract verifyNodeLinkage(): void;

    getNumber(): number {
        throw new TypeError("node is not of type number");
    }
    
    getString(): string {
        throw new TypeError("node is not of type string");
    }
    
    getBoolean(): boolean {
        throw new TypeError("node is not of type boolean");
    }
    
    getNull(): null {
        throw new TypeError("node is not of type null");
    }
    
    getListReference(): Array<StoreNode> {
        throw new TypeError("node is not of type list");
    }

    index(i: number): StoreNode {
        throw new TypeError("node is not of type list");
    }

    length(): number {
        throw new TypeError("node is not of type list");
    }
    
    getMapReference(): Map<string, StoreNode> {
        throw new TypeError("node is not of type map");
    }

    key(k: string): StoreNode {
        throw new TypeError("node is not of type map");
    }

    keys(): Array<string> {
        throw new TypeError("node is not of type map");
    }

    
    private static fromJsonHelper(data: any, parent: StoreNode): StoreNode {      
        if (data === null || data === undefined) {
            return new NullNode(parent, null);
        }
        
        const variety = typeof data;

        if (variety === "number") {
            return new NumberNode(parent, data as number);
        }
        else if (variety === "string") {
            return new StringNode(parent, data as string);
        }
        else if (variety === "boolean") {
            return new BooleanNode(parent, data as boolean);
        }
        
        if (Array.isArray(data)) {
            let result = new ListNode(parent, []);
            let contents = (data as Array<any>).map((item) => {
                return this.fromJsonHelper(item, result);
            });
            result.list = contents;
            return result;
        }
        
        if (Object.getPrototypeOf(data) === Object.prototype) {
            const contents = new Map<string, StoreNode>();
            const result = new MapNode(parent, contents);
            for (const key in (data as Object)) {
                contents.set(key, this.fromJsonHelper(data[key], result));
            }
            return result;
        }

        throw new TypeError("Tried to construct StoreNode from unsupported JSON types.");
    } 

    static fromJson(data: any, parent: StoreNode = null): StoreNode {
        return this.fromJsonHelper(data, parent);
    }
}

export type Literal = number | string | boolean | null;

export abstract class ValueNode<T extends Literal> extends StoreNode {    
    value: T;

    constructor(parent: StoreNode, value: T) {
        super(parent);
        this.value = value;
    }

    getJson() {
        return this.value;
    }

    verifyNodeLinkage() { }  
}

export class NumberNode extends ValueNode<number> {
    constructor(parent: StoreNode, value: number) {
        super(parent, value);
    }

    getNumber(): number {
        return this.value;
    }

    getType(): DataType {
        return DataType.Number;
    }
}

export class StringNode extends ValueNode<string> {
    constructor(parent: StoreNode, value: string) {
        super(parent, value);
    }

    getString(): string {
        return this.value;
    }

    getType(): DataType {
        return DataType.String;
    }
}

export class BooleanNode extends ValueNode<boolean> {
    constructor(parent: StoreNode, value: boolean) {
        super(parent, value);
    }

    getBoolean(): boolean {
        return this.value;
    }

    getType(): DataType {
        return DataType.Boolean;
    }
}

export class NullNode extends ValueNode<null> {
    constructor(parent: StoreNode, value: null) {
        super(parent, value);
    }

    getNull(): null {
        return this.value;
    }

    getType(): DataType {
        return DataType.Null;
    }
}

export class ListNode extends StoreNode {
    list: Array<StoreNode>;
    
    constructor(parent: StoreNode, list: Array<StoreNode>) {
        super(parent);
        this.list = list;
    }

    getJson() {
        return this.list.map((item) => item.getJson());
    }

    getListReference(): Array<StoreNode> {
        return this.list;
    }

    index(i: number): StoreNode {
        return this.list[i];
    }

    length(): number {
        return this.list.length;
    }

    getType(): DataType {
        return DataType.List;
    }

    verifyNodeLinkage(): void {
        for (const node of this.list) {
            if (node.parent !== this) {
                throw new Error("child of list has incorrect parent reference");
            }
            node.verifyNodeLinkage();
        }
    }  
}

export class MapNode extends StoreNode {
    map: Map<string, StoreNode>;
    
    constructor(parent: StoreNode, map: Map<string, StoreNode>) {
        super(parent);
        this.map = map;
    }
    
    getJson() {
        let result = { };
        for (const [key, value] of this.map) {
            result[key] = value.getJson();
        }
        return result;
    }  

    getMapReference(): Map<string, StoreNode> {
        return this.map;
    }

    key(k: string): StoreNode {
        return this.map.get(k);
    }

    keys(): Array<string> {
        return Array.from(this.map.keys());
    }

    getType(): DataType {
        return DataType.Map;
    }

    verifyNodeLinkage(): void {
        for (const [key, value] of this.map) {
            if (value.parent !== this) {
                throw new Error("child of map has incorrect parent reference");
            }
            value.verifyNodeLinkage();
        }
    }
}

export interface NavigatorConstructor<T> {
    new (store: Store, age: number, path: Array<PathComponent>): T;
}

export class Store {
    root: StoreNode;
    age: number;
    undoStack: Array<Transform>;
    checkpoint: number;

    constructor(jsonContent: any = null) {
        this.root = StoreNode.fromJson(jsonContent);
        this.age = 0;
        this.undoStack = [];
        this.checkpoint = 0;
    }

    wasModified(): void {
        this.age++;
    }

    verifyNodeLinkage(): void {
        if (this.root.parent !== null) {
            throw new Error("root node has parent");
        }
        this.root.verifyNodeLinkage();
    }  

    getNavigator(path: Array<PathComponent> = []): Navigator {
        let result = new Navigator(this, this.age, path);
        return result;
    }

    getSpecialNavigator<T>(klass: NavigatorConstructor<T>, path: Array<PathComponent> = []): T {
        let result = new klass(this, this.age, path);
        return result;
    }

    followPath(p: Path): StoreNode | null {
        let node = this.root;

        for (const component of p) {
            if (typeof component === "string" && node.getType() === DataType.Map) {
                node = node.key(component as string);
                if (node === undefined) {
                    return null;
                }
            }
            else if (typeof component === "number" && node.getType() === DataType.List) {
                const index = component as number;
                if (index < 0 || index >= node.length()) {
                    return null;
                }
                node = node.index(index);
            }
            else {
                return null;
            }
        }
        
        return node;
    }

    undo(times: number = 1) {
        while (this.undoStack.length > 0 && times > 0) {
            const last = this.undoStack.pop();
            last(this);
            times--;
        }
    }

    undoUntilCheckpoint(): void {
        while (this.undoStack.length > this.checkpoint) {
            const last = this.undoStack.pop();
            last(this);
        }
    }

    setCheckpoint(): void {
        this.checkpoint = this.undoStack.length;
    }

    getUndoCount(): number {
        return this.undoStack.length;
    }
}


export class Navigator {
    store: Store;
    age: number;
    node: StoreNode;
    path: Array<PathComponent>;

    constructor(store: Store, age: number, path: Array<PathComponent> = []) {
        this.store = store;
        this.age = age;
        this.node = store.followPath(path);
        this.path = path.slice(0);
    }

    obsolete() {
        return this.age < this.store.age;
    }

    clone() {
        let result = new Navigator(this.store, this.age);
        result.node = this.node;
        result.path = this.path.slice(0);
        return result;
    }

    checkValid(): void {
        if (!this.obsolete()) {
            return;
        }
        
        let pathTarget = this.store.followPath(this.path);
        if (pathTarget === this.node) {
            this.age = this.store.age;
        }
        else {
            throw new Error("Navigator invalid after external modification");
        }
    }  

    getJson(): any { return this.node.getJson(); }
    getType(): DataType { return this.node.getType(); }
    getNumber(): number { return this.node.getNumber(); }
    getString(): string { return this.node.getString(); }
    getBoolean(): boolean { return this.node.getBoolean(); }
    getNull(): null { return this.node.getNull(); }
    getLength(): number { return this.node.length(); }
    getKeys(): Array<string> { return this.node.keys(); }
    getPath(): Array<PathComponent> { return this.path.slice(0); }
    getAge(): number { return this.age; }
    getStore(): Store { return this.store; }
    getUndoCount(): number { return this.store.undoStack.length; }
    
    hasParent(): boolean {
        return this.node.parent !== null;
    }
 
    hasIndex(i: number): boolean {
        return this.node.getType() === DataType.List && i >= 0 && i < this.node.length();
    }  

    hasKey(k: string): boolean {
        return this.node.getType() === DataType.Map && this.node.key(k) !== undefined;
    }

    mapList(fun: (nav: Navigator) => void): Navigator {
        if (!(this.node instanceof ListNode)) {
            throw new Error("mapList expects list node");
        }

        let nav = this.clone().goIndex(0);
        while (nav !== null) {
            fun(nav);
            nav = nav.goNextSibling();
        }

        return this;
    }

    mapKeys(fun: (nav: Navigator) => void): Navigator {
        if (!(this.node instanceof MapNode)) {
            throw new Error("mapKeys expects map node");
        }

        let nav = this.clone();
        for (const k of this.getKeys()) {
            nav.goKey(k);
            fun(nav);
            nav.goParent();
        }

        return this;
    }

    goRoot(): Navigator {
        this.checkValid();
        this.node = this.store.root;
        this.path = [];
        return this;
    }
    
    goParent(): Navigator {
        this.checkValid();
        if (!this.hasParent()) {
            throw new Error("cannot navigate to parent; node has no parent");
        }
        
        this.path.pop();
        this.node = this.node.parent;
        return this;
    }

    goIndex(i: number): Navigator {
        this.checkValid();
        if (!this.hasIndex(i)) {
            throw new Error("cannot navigate to index " + i + "; does not exist");
        }
        
        this.path.push(i);
        this.node = this.node.index(i);
        return this;
    }

    goKey(k: string): Navigator {
        this.checkValid();
        if (!this.hasKey(k)) {
            throw new Error("cannot navigate to key " + k + "; does not exist");
        }
        
        this.path.push(k);
        this.node = this.node.key(k);
        return this;
    }

    goSiblingKey(k: string): Navigator {
        this.checkValid();
        if (this.node.parent === null 
            || this.node.parent.getType() !== DataType.Map
            || this.node.parent.key(k) === undefined)
        {
            throw new Error("cannot navigate to sibling key " + k + "; does not exist");
        }
        
        this.path[this.path.length - 1] = k;
        this.node = this.node.parent.key(k);
        return this;
    }

    // Throws if parent is not a list
    // Doesn't throw if the index is invalid; just returns false
    goSibling(offset: number): Navigator {
        this.checkValid();
        if (!this.hasParent() || this.node.parent.getType() !== DataType.List) {
            throw new Error("cannot navigate to sibling; parent is not list");
        }
        
        let selfIndex = this.path[this.path.length - 1] as number;
        selfIndex += offset;

        if (selfIndex < 0 || selfIndex >= this.node.parent.length()) {
            return null;
        }
        
        this.node = this.node.parent.index(selfIndex);
        this.path[this.path.length - 1] = selfIndex;
        return this;
    }

    goNextSibling(): Navigator {
        return this.goSibling(1);
    }
    
    goPreviousSibling(): Navigator {
        return this.goSibling(-1);
    }

    setCheckpoint(): void {
        this.store.setCheckpoint();
    }

    private _setNumberUntracked(n: number): void {
        if (this.node instanceof NumberNode) {
            const target = this.node as NumberNode;
            target.value = n;
        } else {
            throw new TypeError("_setNumberUntracked: not a number");
        }
    }

    private _setStringUntracked(s: string): void {
        if (this.node instanceof StringNode) {
            const target = this.node as StringNode;
            target.value = s;
        } else {
            throw new TypeError("_setStringUntracked: not a number");
        }
    }

    private _setBooleanUntracked(b: boolean): void {
        if (this.node instanceof BooleanNode) {
            const target = this.node as BooleanNode;
            target.value = b;
        } else {
            throw new TypeError("_setBooleanUntracked: not a number");
        }
    }

    setNumber(n: number): Navigator {
        if (this.node instanceof NumberNode) {
            const target = this.node as NumberNode;

            const undoValue = target.value;
            const undoPath = this.getPath();

            target.value = n;

            this.store.undoStack.push(
                (s) => { s.getNavigator(undoPath)._setNumberUntracked(undoValue); }
            );
        } else {
            throw new TypeError("setNumber: not a number node");
        }

        return this;
    }

    setString(s: string): Navigator {
        if (this.node instanceof StringNode) {
            const target = this.node as StringNode;

            const undoValue = target.value;
            const undoPath = this.getPath();

            target.value = s;

            this.store.undoStack.push(
                (s) => { s.getNavigator(undoPath)._setStringUntracked(undoValue); }
            );
        } else {
            throw new TypeError("setString: not a string node");
        }

        return this;
    }

    setBoolean(b: boolean): Navigator {
        if (this.node instanceof BooleanNode) {
            const target = this.node as BooleanNode;

            const undoValue = target.value;
            const undoPath = this.getPath();

            target.value = b;

            this.store.undoStack.push(
                (s) => { s.getNavigator(undoPath)._setBooleanUntracked(undoValue); }
            );
        } else {
            throw new TypeError("setBoolean: not a boolean node");
        }

        return this;
    }



    private _setIndexUntracked(index: number, json: any): void {
        if (!(this.node instanceof ListNode) || index < 0 || index >= this.node.length()) {
            throw new TypeError("_setIndexUntracked: invalid list node or index");
        }

        (this.node as ListNode).list[index] = StoreNode.fromJson(json, this.node);
    }

    // only for *already existing* indices
    setIndex(index: number, json: any): Navigator {
        if (!(this.node instanceof ListNode)) {
            throw new TypeError("setIndex: not a list node");
        }

        const node = this.node as ListNode;
        if (index < 0 || index >= node.list.length) {
            throw new Error("setIndex: index out of bounds");
        }

        const undoJson = node.list[index].detach();
        const undoPath = this.getPath();

        node.list[index] = StoreNode.fromJson(json, node);
        this.store.undoStack.push(
            (s) => { s.getNavigator(undoPath)._setIndexUntracked(index, undoJson); }
        );
        this.store.wasModified();

        return this;
    }

    private _insert(index: number, json: Array<any>): void {
        if (!(this.node instanceof ListNode) || index < 0 || index > this.node.length()) {
            throw new TypeError("_insert: invalid list node or index");
        }
        
        const node = this.node as ListNode;
        node.list.splice(index, 0, ...json.map((item) =>
            StoreNode.fromJson(item, node)
        ));
        this.store.wasModified();
    }  

    private _remove(from: number, upTo: number): void {
        if (!(this.node instanceof ListNode) || from < 0 || from >= upTo || upTo > this.node.length()) {
            throw new TypeError("_remove: invalid list node or indices");
        }
        
        const node = this.node as ListNode;
        for (let i = from; i < upTo; i++) {
            node.list[i].detachWithoutJson();
        }
        node.list.splice(from, upTo - from);
        this.store.wasModified();
    }

    insert(index: number, json: Array<any>): Navigator {
        this._insert(index, json);

        const undoPath = this.getPath();      
        this.store.undoStack.push((s) => {
            s.getNavigator(undoPath)._remove(index, index + json.length);
        });

        return this;
    }

    remove(from: number, upTo: number): Navigator {
        if (!(this.node instanceof ListNode) || from < 0 || from >= upTo || upTo > this.node.length()) {
            throw new TypeError("_remove: invalid list node or indices");
        }
        
        const node = this.node as ListNode;
        const undoJson = [];
        const undoPath = this.getPath();
        for (let i = from; i < upTo; i++) {
            undoJson.push(node.list[i].detach());
        }

        node.list.splice(from, upTo - from);
              
        this.store.undoStack.push((s) => {
            s.getNavigator(undoPath)._insert(from, undoJson);
        })
        this.store.wasModified();

        return this;
    }

    private _popUntracked(): void {
        if (!(this.node instanceof ListNode)) {
            throw new TypeError("_popUntracked: not a list node");
        }
        
        let node = this.node as ListNode;
        if (node.list.length === 0) {
            throw new Error("_popUntracked: can't pop from empty list");
        }
        
        node.list[node.list.length - 1].detachWithoutJson();
        node.list.pop();
        this.store.wasModified();
    }  

    private _pushUntracked(json: any): void {
        if (!(this.node instanceof ListNode)) {
            throw new TypeError("_pushUntracked: not a list node");
        }
        
        let node = this.node as ListNode;
        node.list.push(StoreNode.fromJson(json, node));
    }  

    push(json: any): Navigator {
        if (!(this.node instanceof ListNode)) {
            throw new TypeError("push: not a list node");
        }
        
        let node = this.node as ListNode;
        const undoPath = this.getPath();

        node.list.push(StoreNode.fromJson(json, node));
        this.store.undoStack.push(
            (s) => { s.getNavigator(undoPath)._popUntracked(); }
        );

        return this;
    } 

    pop(): Navigator {
        if (!(this.node instanceof ListNode)) {
            throw new TypeError("pop: not a list node");
        }
        
        let node = this.node as ListNode;
        if (node.list.length === 0) {
            throw new Error("pop: can't pop from empty list");
        }

        const undoPath = this.getPath();
        const undoJson = node.list[node.list.length - 1].detach();
        node.list.pop();
        this.store.undoStack.push(
            (s) => { s.getNavigator(undoPath)._pushUntracked(undoJson); }
        )
        this.store.wasModified();
        return this;
    } 


    private _clearKeyUntracked(key: string): void {
        if (!(this.node instanceof MapNode) || !(this.node as MapNode).map.has(key)) {
            throw new TypeError("_clearKeyUntracked: not a map node or invalid key");
        }

        (this.node as MapNode).map.get(key).detachWithoutJson();
        (this.node as MapNode).map.delete(key);
        this.store.wasModified();
    }

    private _setKeyUntracked(key: string, valueJson: any): void {
        if (!(this.node instanceof MapNode)) {
            throw new TypeError("_setKeyUntracked: not a map node");
        }

        let previous = (this.node as MapNode).map.get(key);
        if (previous !== undefined) {
            previous.detachWithoutJson();
        }

        (this.node as MapNode).map.set(key, StoreNode.fromJson(valueJson, this.node));
    }

    setKey(key: string, valueJson: any): Navigator {
        if (this.node instanceof MapNode) {
            const node = this.node as MapNode;
            const undoPath = this.getPath();

            // two cases: the key already exists, or it doesn't.
            if (node.map.has(key)) {
                const undoJson = node.map.get(key).detach();
                node.map.set(key, StoreNode.fromJson(valueJson, node));
                this.store.undoStack.push(
                    (s) => { s.getNavigator(undoPath)._setKeyUntracked(key, undoJson); }
                );
            } else {
                node.map.set(key, StoreNode.fromJson(valueJson, node));
                this.store.undoStack.push(
                    (s) => { s.getNavigator(undoPath)._clearKeyUntracked(key); }
                )
            }

            this.store.wasModified();
        } else {
            throw new TypeError("setKey: not a map node");
        }

        return this;
    }
    
    clearKey(key: string): Navigator {
        if (this.node instanceof MapNode) {
            const node = this.node as MapNode;
            const undoPath = this.getPath();

            if (node.map.has(key)) {
                const undoJson = node.map.get(key).detach();
                node.map.delete(key);

                this.store.undoStack.push(
                    (s) => { s.getNavigator(undoPath)._setKeyUntracked(key, undoJson); }
                );
                this.store.wasModified();
            } else {
                throw new TypeError("clearKey: tried to remove a nonexistent key");
            }
        } else {
            throw new TypeError("clearKey: not a map node");
        }

        return this;
    }

}