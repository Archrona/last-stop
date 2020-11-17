const fs = require("fs");
const glob = require("glob");
const Handlebars = require("handlebars");

// test = JSON.parse(fs.readFileSync(glob.sync("./../last-stop/contexts/*.json")[0]).toString()).shits;
// console.log(test);

let contextFiles = [];
for (const fn of glob.sync("./../last-stop/contexts/*.json")) {
    contextFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
}
let commandGroupFiles = [];
for (const fn of glob.sync("./../last-stop/commands/*.json")) {
    commandGroupFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
}

class Context {
    constructor(contextFile) {
        this.name = contextFile.name;
        this.extensions = contextFile.extensions;
        this.commands = contextFile.commands;
        this.contextChanges = contextFile.contextChanges;
    }
}

class CommandGroup {
    constructor(commandFile) {
        this.name = commandFile.group;
        this.commands = commandFile.commands;
    }
}

class Command {
    constructor(command) {
        this.spoken = command.spoken;
        this.insert = command.insert;
        this.run = command.run;
        this.arguments = command.arguments;

        console.log(command);
        console.log(this);
    }

    getExplanation() {
        let result = "";
        if (this.insert != undefined) {
            result += "Inserts <pre>" + this.insert + "</pre>";
        }
        if (this.run !== undefined) {
            if (result !== "") {
                result += "\n Executes <pre>" + this.run + "</pre>";
            }
            else {
                result += "\n Executes <pre>" + this.run + "</pre>";
            }
        }
        if (this.arguments !== undefined) {
            result += " with arguments <pre> ";
            for (let i = 0; i < this.arguments.length; i++) {
                result += argument.toString();
                if (i != this.arguments.length - 1) {
                    result += ",";
                }
            }
            result += "</pre>"
        }
        return result;
    }
}

// let contexts = contextFiles.map((contextFile) => new Context(contextFile));

const contextTemplate = Handlebars.compile(
    `
    `
)

const commandTemplate = Handlebars.compile(
    `<tr>
        <td>{{{spoken}}}</td>
        <td>{{{definition}}}</td>
    </tr>`
)

const commandGroupTemplate = Handlebars.compile(
    `<!DOCTYPE html>
    <html>
        <head>
            <title>{{name}}</title>
            <link rel="stylesheet" type="text/css" href="style.css">
        </head>
        <body>
            <div class="container">
                <table>
                    <tr>
                        <td>Spoken</td>
                        <td>Definition</td>
                    </tr>
                    {{#each commands}}
                    {{{this}}}
                    {{/each}}
                </table>
            </div>
        </body>
    </html>`
)

// commandGroup: a CommandGroup
function getCommandGroupHTML(commandGroup) {
    let renderedCommands = [];
    let commands = commandGroup.commands; //.map((command) => new Command(command));

    for (const c of commands) {
        let command = new Command(c);
        let spoken = command.spoken;
        let explanation = command.getExplanation();
        console.log(spoken);
        let renderedCommand = commandTemplate({
            spoken: spoken,
            definition: explanation
        })
        renderedCommands.push(renderedCommand);
    }

    let result = commandGroupTemplate({
        name: commandGroup.name,
        commands: renderedCommands
    });

    return result;
}

let testcg = new CommandGroup(commandGroupFiles[9]);
let testr = getCommandGroupHTML(testcg);
fs.writeFileSync("./bruh.html", testr)

// let shit = Handlebars.compile(
//     `<!DOCTYPE html>
//     <html>
//         <head>
//             <title>{{name}}/title>
//             <link rel="stylesheet" type="text/css" href="style.css">
//         </head>
//         <body>
//             <div class="container">
//                 <tr>
//                     <td>Spoken</td>
//                     <td>Definition</td>
//                 </tr>
//                 {{#each commands}}
//                 {{this}}
//                 {{/each}}
//             </div>
//         </body>
//     </html>`
// )
// let name = "cum"
// let d = Handlebars.compile(
//     `{{slur}}
//     `
// );
// let a = d({slur: "nig"});
// let b = d({slur: "ger"});
// let c = d({slur: "fag"});
// let commands = [a, b, c]
// let rendered = shit(
//     {
//         name: name, 
//         commands: commands
//     }
// )
// fs.writeFileSync("./bruh.html", rendered)