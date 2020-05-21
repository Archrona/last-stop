

export abstract class StoreNode {
    age: number;
    parent: StoreNode;
    
    constructor(parent: StoreNode) {
        this.age = 0;
        this.parent = parent;
    }
    
    modified(): void {
        this.age += 1;

        if (this.parent !== null) {
            this.parent.modified();
        }        
    }

    abstract getJson(): any;

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
}

export class StringNode extends ValueNode<string> {
    constructor(parent: StoreNode, value: string) {
        super(parent, value);
    }

    getString(): string {
        return this.value;
    }
}

export class BooleanNode extends ValueNode<boolean> {
    constructor(parent: StoreNode, value: boolean) {
        super(parent, value);
    }

    getBoolean(): boolean {
        return this.value;
    }
}

export class NullNode extends ValueNode<null> {
    constructor(parent: StoreNode, value: null) {
        super(parent, value);
    }

    getNull(): null {
        return this.value;
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
}

export class Store {
    root: StoreNode;

    constructor() {
        this.root = new NullNode(null, null);
    }
}

