
export enum DataType {
    Number,
    String, 
    Boolean,
    Null,
    List,
    Map
}

export abstract class StoreNode {
    parent: StoreNode;
    
    constructor(parent: StoreNode) {
        this.parent = parent;
    }
    
    abstract getJson(): any;
    abstract getType(): DataType;

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

    static fromJson(data: any): StoreNode {
        return this.fromJsonHelper(data, null);
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
}

type PathComponent = string | number;
type Path = Array<PathComponent>;

export class Store {
    root: StoreNode;
    age: number;

    constructor(jsonContent: any = null) {
        this.root = StoreNode.fromJson(jsonContent);
        this.age = 0;
    }

    wasModified(): void {
        this.age++;
    }

    getNavigator(): Navigator {
        let result = new Navigator(this, this.age);
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
}



export class Navigator {
    private store: Store;
    private age: number;
    private node: StoreNode;
    private path: Array<PathComponent>;

    constructor(store: Store, age: number) {
        this.store = store;
        this.age = age;
        this.node = store.root;
        this.path = [];
    }

    obsolete() {
        return this.age < this.store.age;
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
    
    hasParent(): boolean {
        return this.node.parent !== null;
    }
 
    hasIndex(i: number): boolean {
        return this.node.getType() === DataType.List && i >= 0 && i < this.node.length();
    }  

    hasKey(k: string): boolean {
        return this.node.getType() === DataType.Map && this.node.key(k) !== undefined;
    }

    goRoot(): void {
        this.checkValid();
        this.node = this.store.root;
        this.path = [];
    }
    
    goParent(): void {
        this.checkValid();
        if (!this.hasParent()) {
            throw new Error("cannot navigate to parent; node has no parent");
        }
        
        this.path.pop();
        this.node = this.node.parent;
    }

    goIndex(i: number): void {
        this.checkValid();
        if (!this.hasIndex(i)) {
            throw new Error("cannot navigate to index " + i + "; does not exist");
        }
        
        this.path.push(i);
        this.node = this.node.index(i);
    }

    goKey(k: string): void {
        this.checkValid();
        if (!this.hasKey(k)) {
            throw new Error("cannot navigate to key " + k + "; does not exist");
        }
        
        this.path.push(k);
        this.node = this.node.key(k);
    }

    goSiblingKey(k: string): void {
        this.checkValid();
        if (this.node.parent === null 
            || this.node.parent.getType() !== DataType.Map
            || this.node.parent.key(k) === undefined)
        {
            throw new Error("cannot navigate to sibling key " + k + "; does not exist");
        }
        
        this.path[this.path.length - 1] = k;
        this.node = this.node.parent.key(k);
    }

    // Throws if parent is not a list
    // Doesn't throw if the index is invalid; just returns false
    goSibling(offset: number): boolean {
        this.checkValid();
        if (!this.hasParent() || this.node.parent.getType() !== DataType.List) {
            throw new Error("cannot navigate to sibling; parent is not list");
        }
        
        let selfIndex = this.path[this.path.length - 1] as number;
        selfIndex += offset;

        if (selfIndex < 0 || selfIndex >= this.node.parent.length()) {
            return false;
        }
        
        this.node = this.node.parent.index(selfIndex);
        this.path[this.path.length - 1] = selfIndex;
        return true;
    }

    goNextSibling(): boolean {
        return this.goSibling(1);
    }
    
    goPreviousSibling(): boolean {
        return this.goSibling(-1);
    }
}