

export type StorePath = Array<number | string>;
export type StoreData = number | string | boolean | null | Array<StoreData> | Map<string, StoreData>;

function clone(data: StoreData): StoreData {
    const type = getType(data);

    switch(type) {
        case DataTypes.Number:
        case DataTypes.String:
        case DataTypes.Boolean:
        case DataTypes.Null:
            return data;

        case DataTypes.Array:
            return (data as Array<StoreData>).map(x => clone(x));

        case DataTypes.Map:
            let result = new Map<string, StoreData>();
            let it = (data as Map<string, StoreData>).entries();
            for (const item of it) {
                result.set(item[0], clone(item[1]));
            }
            return result;
    }
}

enum DataTypes {
    Number,
    String, 
    Boolean,
    Null,
    Array,
    Map
}

export function getType(data: StoreData) {
    if (typeof data === "number") {
        return DataTypes.Number;
    } else if (typeof data === "string") {
        return DataTypes.String;
    } else if (typeof data === "boolean") {
        return DataTypes.Boolean;
    } else if (data === null) {
        return DataTypes.Null;
    } else if (Array.isArray(data)) {
        return DataTypes.Array;
    } else if (Object.getPrototypeOf(data) === Map.prototype) {
        return DataTypes.Map;
    } else {
        throw "unknown data type in store!";
    }
}

export class StoreResult {
    success: boolean;
    deltaIndex: number | null;

    constructor(success: boolean, deltaIndex: number | null) {
        this.success = success;
        this.deltaIndex = deltaIndex;
    }
}

class SetResult {
    constructor(public success: boolean, public replacedExisting: boolean, public oldData: StoreData | undefined) {

    }
}

class ClearResult {
    constructor(public success: boolean, public oldData: StoreData | undefined) {

    }
}

class InsertListResult {
    constructor(public success: boolean, public actualIndex: number) {
        
    }    
}

class RemoveListResult {
    constructor(public success: boolean, public actualStartIndex: number, public oldData: Array<StoreData> | undefined) {
        
    }
}
 

class UntrackedStore {
    root: StoreData;

    constructor(data: StoreData) {
        this.root = data;
    }

    get(path: StorePath): StoreData | undefined {
        return this.navigateTo(path);
    }

    clear(path: StorePath): ClearResult {
        if (path.length === 0) {
            const oldValue = this.root;
            this.root = null;
            return new ClearResult(true, oldValue);
        }

        let here = this.root;

        for (let i = 0; i < path.length; i++) {
            let type = getType(here);
            
            let nextPath = path[i];
            let pathType = getType(nextPath);

            if (pathType === DataTypes.Number) {
                if (type === DataTypes.Array && nextPath >= 0 && nextPath < (here as Array<StoreData>).length) {
                    if (i === path.length - 1) {
                        const arr = here as Array<StoreData>;
                        const idx = nextPath as number;

                        const oldValue = arr[idx];
                        delete arr[idx];
                        return new ClearResult(true, oldValue);
                    } else {
                        here = (here as Array<StoreData>)[nextPath as number];
                    }
                } else {
                    return new ClearResult(false, undefined);
                }
            } else if (pathType === DataTypes.String) {
                if (type == DataTypes.Map && (here as Map<string, StoreData>).has(nextPath as string)) {
                    const map = here as Map<string, StoreData>;
                    const key = nextPath as string;

                    if (i === path.length - 1) {
                        const oldValue = map.get(key);
                        map.delete(key);
                        return new ClearResult(true, oldValue);
                    } else {
                        here = (here as Map<string, StoreData>).get(nextPath as string);
                    }
                } else {
                    return new ClearResult(false, undefined);
                }
            } else {
                throw "unknown data type in path!";
            }
        }
    }

    set(path: StorePath, value: StoreData) {
        if (path.length === 0) {
            const old = this.root;
            this.root = value;
            return new SetResult(true, true, old);
        }

        let here = this.root;

        for (let i = 0; i < path.length; i++) {
            let type = getType(here);
            
            let nextPath = path[i];
            let pathType = getType(nextPath);

            if (pathType === DataTypes.Number) {
                if (type === DataTypes.Array) {
                    const arr = here as Array<StoreData>;
                    const idx = nextPath as number;
                    if (i === path.length - 1) {
                        if (idx < 0) {
                            return new SetResult(false, false, undefined);
                        } else if (idx < arr.length) {
                            const oldValue = arr[idx];
                            arr[idx] = value;
                            return new SetResult(true, true, oldValue);
                        } else {
                            arr[idx] = value;
                            return new SetResult(true, false, undefined);
                        }
                    } else {
                        here = arr[idx];
                    }
                } else { 
                    return new SetResult(false, false, undefined);
                }
            } else if (pathType === DataTypes.String) {
                if (type == DataTypes.Map) {
                    const map = here as Map<string, StoreData>;
                    const key = nextPath as string;

                    if (i === path.length - 1) {
                        if (map.has(key)) {
                            const oldData = map.get(key);
                            map.set(key, value);
                            return new SetResult(true, true, oldData);
                        } else {
                            map.set(key, value);
                            return new SetResult(true, false, undefined);
                        }
                    } else {
                        here = map.get(key);
                    }
                } else {
                    return new SetResult(false, false, undefined);
                }
            } else {
                throw "unknown data type in path!";
            }
        }
    }

    navigateTo(pathToList: StorePath) : StoreData | undefined {
        let here = this.root;

        for (let i = 0; i < pathToList.length; i++) {
            let type = getType(here);
            
            let nextPath = pathToList[i];
            let pathType = getType(nextPath);

            if (pathType === DataTypes.Number) {
                if (type === DataTypes.Array && nextPath >= 0 && nextPath < (here as Array<StoreData>).length) {
                    here = (here as Array<StoreData>)[nextPath as number];
                } else {
                    return undefined;
                }
            } else if (pathType === DataTypes.String) {
                if (type == DataTypes.Map && (here as Map<string, StoreData>).has(nextPath as string)) {
                    here = (here as Map<string, StoreData>).get(nextPath as string);
                } else {
                    return undefined;
                }
            } else {
                throw "unknown data type in path!";
            }
        }

        return here;
    }

    insertList(pathToList: StorePath, index: number, values: Array<StoreData>) {
        const here = this.navigateTo(pathToList);
        if (here === undefined || getType(here) !== DataTypes.Array) 
            return new InsertListResult(false, 0);

        const list = here as Array<StoreData>;
        if (index < 0) index = 0;
        if (index > list.length) index = list.length;
        list.splice(index, 0, ...values);

        return new InsertListResult(true, index);
    }

    // Removes items from indexFrom to one BEFORE indexTo
    removeList(pathToList: StorePath, indexFrom: number, indexTo: number) {
        const here = this.navigateTo(pathToList);
        if (here === undefined || getType(here) !== DataTypes.Array) 
            return new RemoveListResult(false, 0, undefined);
 
        const list = here as Array<StoreData>;
        indexFrom = Math.max(0, Math.min(list.length, indexFrom));
        indexTo = Math.max(0, Math.min(list.length, indexTo));
        if (indexFrom > indexTo) {
            const temp = indexFrom;
            indexFrom = indexTo;
            indexTo = temp;
        }

        const originalData = list.slice(indexFrom, indexTo);
        list.splice(indexFrom, indexTo - indexFrom);

        return new RemoveListResult(true, indexFrom, originalData);
    }

    changeKey(pathToMap: StorePath, fromKey: string, toKey: string) {
        const here = this.navigateTo(pathToMap);
        if (here === undefined || getType(here) !== DataTypes.Map) 
            return false;

        const map = here as Map<string, StoreData>;
        if (!map.has(fromKey) || map.has(toKey)) {
            return false;
        }

        const data = map.get(fromKey);
        map.delete(fromKey);
        map.set(toKey, data);
        return true;
    }
}



type Delta = (store: UntrackedStore) => any;

enum DeltaPairType {
    Checkpoint,
    Set,
    Clear,
    InsertList,
    RemoveList,
    ChangeKey
}

class DeltaPair {
    constructor(public type: DeltaPairType, public forward: Delta, public backward: Delta) {

    }
}



export class Store {
    backing: UntrackedStore;
    undoStack: Array<DeltaPair>;
    redoStack: Array<DeltaPair>;

    constructor() {
        this.backing = new UntrackedStore(null);
        this.undoStack = [];
        this.redoStack = [];
    }

    get(path: StorePath): StoreData | undefined {
        return this.backing.get(path);
    }

    checkpoint(): number {
        this.undoStack.push(new DeltaPair(DeltaPairType.Checkpoint, (store) => true, (store) => true));
        return this.undoStack.length;
    }

    getDeltaIndex() {
        return this.undoStack.length;
    }

    undo() {
        if (this.undoStack.length > 0) {
            const last = this.undoStack.pop();
            this.redoStack.push(last);
            last.backward(this.backing);
            
            return new StoreResult(true, this.undoStack.length);
        }
        else {
            return new StoreResult(false, 0);
        }
    }  
    
    redo() {
        if (this.redoStack.length > 0) {
            const last = this.redoStack.pop();
            this.undoStack.push(last);
            last.forward(this.backing);
            
            return new StoreResult(true, this.undoStack.length);
        }
        else {
            return new StoreResult(false, this.undoStack.length);
        }
    }

    redoAll() {
        while (this.redoStack.length > 0) {
            this.redo();
        }
        return new StoreResult(true, this.undoStack.length);
    }  

    undoUntilIndex(deltaIndex: number) {
        if (deltaIndex < 0) {
            deltaIndex = 0;
        }
        
        while (this.undoStack.length > deltaIndex) {
            this.undo();
        }
        return new StoreResult(true, this.undoStack.length);
    }
    
    undoUntilCheckpoint() {
        while (this.undoStack.length > 0 
            && this.undoStack[this.undoStack.length - 1].type !== DeltaPairType.Checkpoint)
        {
            this.undo();
        }
        return new StoreResult(true, this.undoStack.length);
    }

    clear(path: StorePath): StoreResult {
        const clearResult = this.backing.clear(path);
        if (clearResult.success) {
            this.redoStack = [];
            this.undoStack.push(new DeltaPair(
                DeltaPairType.Clear,
                (store) => store.clear(path),
                (store) => store.set(path, clearResult.oldData)
            ));
            
            return new StoreResult(true, this.undoStack.length);
        } else {
            return new StoreResult(false, this.undoStack.length);
        }
    }

    private setNoClone(path: StorePath, value: StoreData): StoreResult {
        const setResult = this.backing.set(path, value);
        if (setResult.success) {
            this.redoStack = [];
            this.undoStack.push(new DeltaPair(
                DeltaPairType.Set, 
                (store) => store.set(path, value),
                (setResult.replacedExisting ? 
                    (store) => store.set(path, setResult.oldData) :
                    (store) => store.clear(path))
            ));

            return new StoreResult(true, this.undoStack.length);
        } else {
            return new StoreResult(false, this.undoStack.length);
        }
    }

    set(path: StorePath, value: StoreData): StoreResult {
        value = clone(value);
        return this.setNoClone(path, value);
    }

    setNormalized(path: StorePath, value: any): StoreResult {
        const normalized = Store.normalize(value);
        return this.setNoClone(path, normalized);
    }  

    insertList(path: StorePath, index: number, values: Array<StoreData>): StoreResult {
        const clonedValues = values.map((x) => clone(x));
        const insertResult = this.backing.insertList(path, index, clonedValues);

        if (insertResult.success) {
            this.redoStack = [];
            this.undoStack.push(new DeltaPair(
                DeltaPairType.InsertList,
                (store) => store.insertList(path, index, clonedValues),
                (store) => store.removeList(path, insertResult.actualIndex, insertResult.actualIndex + clonedValues.length)
            ));
            
            return new StoreResult(true, this.undoStack.length);
        }
        else {
            return new StoreResult(false, this.undoStack.length);
        }
    }

    removeList(path: StorePath, indexFrom: number, indexTo: number): StoreResult {
        const removeResult = this.backing.removeList(path, indexFrom, indexTo);
        
        if (removeResult.success) {
            this.redoStack = [];
            this.undoStack.push(new DeltaPair(
                DeltaPairType.RemoveList,
                (store) => store.removeList(path, indexFrom, indexTo),
                (store) => store.insertList(path, removeResult.actualStartIndex, removeResult.oldData)
            ));
            
            return new StoreResult(true, this.undoStack.length);
        }
        else {
            return new StoreResult(false, this.undoStack.length);
        }
    }

    changeKey(path: StorePath, keyFrom: string, keyTo: string): StoreResult {
        const changeResult = this.backing.changeKey(path, keyFrom, keyTo);
        
        if (changeResult) {
            this.redoStack = [];
            this.undoStack.push(new DeltaPair(
                DeltaPairType.ChangeKey,
                (store) => store.changeKey(path, keyFrom, keyTo),
                (store) => store.changeKey(path, keyTo, keyFrom)
            ));
            
            return new StoreResult(true, this.undoStack.length);
        }
        else {
            return new StoreResult(false, this.undoStack.length);
        }
    }  

    static normalize(data: any, throwOnInvalid: boolean = false): StoreData {
        if (data === undefined || data === null) {
            return null;
        }

        const typeString = typeof data;
        if (typeString === "boolean" || typeString === "number" || typeString === "string") {
            return data;
        }
        
        if (Array.isArray(data)) {
            return (data as Array<any>).map((x) => Store.normalize(x, throwOnInvalid));
        }
        
        if (Object.getPrototypeOf(data) === Map.prototype) {
            const result = new Map<string, StoreData>();
            let iterator = (data as Map<any, any>).entries();
            for (const item of iterator) {
                result.set(item[0].toString(), Store.normalize(item[1], throwOnInvalid));
            }
            return result;
        }
        
        if (Object.getPrototypeOf(data) === Object.prototype) {
            const result = new Map<string, StoreData>();
            for (const key in (data as Object)) {
                result.set(key, Store.normalize(data[key], throwOnInvalid));
            }
            return result;
        }
        
        return data.toString();
    } 
}