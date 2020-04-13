// commands.ts
//   Processes speech to modify state.

import * as fs from "fs";
import { Main } from "./main";
import { Position } from "./shared";
import { Token } from "./language";
 
const COMMANDS_FILENAME = "commands.json";

type Terminal = (app: Main, arg: Array<string>) => void;

interface CommandType {
    spoken: Array<string>,
    special?: string,
    insert?: string,
    identifierCommand?: string
}
 
interface CommandGroupType {
    group: string,
    commands: Array<CommandType>
}

type CommandsFileType = Array<CommandGroupType>;


class TokenIterator {
    backing: Array<Token>;
    index: number;
    lowercase: boolean;

    constructor(backing: Array<Token>, startingIndex: number, lowercase: boolean = false) {
        this.backing = backing;
        
        this.index = startingIndex;
        this.bump();

        this.lowercase = lowercase;
    }
    
    hasNext() {
        return this.index < this.backing.length;
    }
    
    getNext() {
        if (this.index >= this.backing.length) {
            throw "token iterator tried to step past end (getNext:1)";
        }
        
        let item = this.backing[this.index].text;
        const type = this.backing[this.index].type;
        
        this.index++;
        this.bump();

        if (this.lowercase) {
            item = item.toLowerCase();
        }

        return [item, type];
    }

    bump() {
        // no-op
    }
}
 
 
class TreeNode {
    commandReached: null | Terminal;
    children: Map<string, TreeNode>;
    
    constructor() {
        this.commandReached = null;
        this.children = new Map();
    }
    
    setCommand(command: Terminal) {
        this.commandReached = command;
        return this;
    }
    
    private addChild(word: string) {
        const node = new TreeNode();
        this.children.set(word, node);
        return node; 
    }
    
    addTerminalAtPath(words: Array<string>, command: Terminal) {
        if (words.length === 0) {
            this.setCommand(command);
            return true;
        }
        else {
            const word = words[0];
            const rest = words.slice(1);
            if (!this.children.has(word)) {
                this.addChild(word);
            }

            return this.children.get(word).addTerminalAtPath(rest, command);
        }
    }

    find(words: Array<string>, startingIndex: number = 0): null | Terminal {
        if (startingIndex >= words.length) {
            return this.commandReached;
        }
        else if (false) {
            // TODO: handle specials like $POSITION
            
        }
        else {
            const child = this.children.get(words[startingIndex]);
            if (child !== undefined) {
                return child.find(words, startingIndex + 1);
            }
        }
        
        return null;
    }  
}


export class Commands {
    specialCommands: Map<string, Terminal>;
    contextTrees: Map<string, TreeNode>;
    app: Main;

    constructor(app: Main) {
        this.app = app;

        const commands = JSON.parse(fs.readFileSync(COMMANDS_FILENAME).toString()) as CommandsFileType;
        const contexts = app.languages.contexts;
        this.contextTrees = new Map();

        for (const [contextName, info] of contexts) {
            const root = this.buildCommandTree(commands, info.commands);
            this.contextTrees.set(contextName, root);
        }
    }
    
    makeTerminal(command: CommandType) {
        if (command.special !== undefined) {
            return (app: Main, arg: Array<string>) => {
                console.log("special " + command.special);
            }
        }
        else if (command.insert !== undefined) {
            return (app: Main, arg: Array<string>) => {
                console.log("insert " + command.insert);
            }
        }
        else if (command.identifierCommand !== undefined) {
            return (app: Main, arg: Array<string>) => {
                console.log("identifierCommand " + command.identifierCommand);
            }
        }
        else {
            throw "invalid command " + command.spoken.toString() + " (makeTerminal: 1)" 
        }        
    }

    // TODO create hash table for unnecessary linear search through groups
    buildCommandTree(commands: CommandsFileType, groups: Array<string>) {
        const root = new TreeNode();

        for (const groupName of groups) {
            for (const commandGroup of commands) {
                if (commandGroup.group === groupName) {
                    for (const command of commandGroup.commands) {
                        const terminal = this.makeTerminal(command);
                        for (const spoken of command.spoken) {
                            const words = spoken.trim().split(/\s+/);
                            if (words.length >= 1) {
                                root.addTerminalAtPath(words, terminal);
                            }
                        }
                    }
                }
            }
        }

        return root;
    }

    onSpokenText(input: string) {
        console.log("TEXT: \"" + input + "\"");

        const tokenizeResult =  this.app.languages.tokenize(
            input, ["spoken_text"], new Position(0, 0), true
        );

        
    } 
}
