const fs = require("fs");
const glob = require("glob");
const Handlebars = require("handlebars");
const path = require("path");

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
    }

    getExplanation() {
        let result = "";
        if (this.insert != undefined) {
            let insert = cuteFormat(this.insert.toString());
            result += `Inserts ${inlineCodeTemplate({ code: insert })}`;
        }
        if (this.run !== undefined) {
            if (result !== "") {
                result += `\n Executes ${inlineCodeTemplate({ code: cuteFormat(this.run) })}`;
            }
            else {
                result += `Executes ${inlineCodeTemplate({ code: cuteFormat(this.run) })}`;
            }
        }
        if (this.arguments !== undefined) {
            result += " with arguments <code>[";
            for (let i = 0; i < this.arguments.length; i++) {
                result += cuteFormat(this.arguments[i].toString());
                if (i != this.arguments.length - 1) {
                    result += ", ";
                }
            }
            result += "]</code>";
        }
        return result;
    }
}

let contextFiles = [];
for (const fn of glob.sync("./../last-stop/contexts/*.json")) {
    contextFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
}
let commandGroupFiles = [];
for (const fn of glob.sync("./../last-stop/commands/*.json")) {
    commandGroupFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
}

const contextTemplate = Handlebars.compile(
    String(fs.readFileSync("templates/contextTemplate.html"))
);

const contextChangeTemplate = Handlebars.compile(
    `<tr>
        <td>{{{token}}}</td>
        <td>{{{action}}}</td>
        <td>{{{target}}}</td>
        <td>{{{style}}}</td>
    </tr>`
);

const commandTemplate = Handlebars.compile(
    `<tr>
        <td>{{{spoken}}}</td>
        <td>{{{definition}}}</td>
    </tr>`
);

const commandGroupTemplate = Handlebars.compile(
    String(fs.readFileSync("templates/commandGroupTemplate.html"))
);

const mergedCommandsTemplate = Handlebars.compile(
    String(fs.readFileSync("templates/mergedCommandsTemplate.html"))
);

const inlineCodeTemplate = Handlebars.compile(
    `<code>{{code}}</code>`
);

// helper
// commandGroup: a CommandGroup
function getCommandGroupHtml(commandGroup, merged) {
    let renderedCommands = [];
    let commands = commandGroup.commands;

    for (const c of commands) {
        let command = new Command(c);
        let spoken = command.spoken.join(", ");
        let explanation = command.getExplanation();
        let renderedCommand = commandTemplate({
            spoken: spoken,
            definition: explanation
        });
        renderedCommands.push(renderedCommand);
    }
    let result;
    if (merged) {
        result = mergedCommandsTemplate({
            name: commandGroup.name,
            commands: renderedCommands
        });
    }
    else {
        result = commandGroupTemplate({
            name: commandGroup.name,
            commands: renderedCommands
        });
    }

    return result;
}

function cuteFormat(code) {
    let s = JSON.stringify(code);
    s = s.substring(1, s.length - 1);
    s = s.replace(/\\"/, "\"");
    return s;
}

// list of CommandGroup objects
let commandGroups = commandGroupFiles.map((commandGroup) => new CommandGroup(commandGroup));

// rendering and HTML output of CommandGroups
for (const cg of commandGroups) {
    let renderedcg = getCommandGroupHtml(cg, false);
    fs.writeFileSync("./build/commands/" + cg.name + ".html", renderedcg);
}

// list of Context objects
let contexts = contextFiles.map((contextFile) => new Context(contextFile));
// helper
function getCommandsFromNames(names) {
    let cgMatches = commandGroups.filter((cg) => names.includes(cg.name));
    return cgMatches;
}

// rendering and HTML output of contexts
for (const c of contexts) {
    let commandGroupNames = c.commands;
    let name = c.name;
    
    let extensions = (c.extensions === undefined || c.extensions.length === 0) ? "None" : c.extensions;
    let commandLink = (c.commands === undefined || c.commands.length === 0) ? "None" : 
        // commandGroupNames.map((cg) => "<a href=\"../commands/" + cg + ".html\">" + cg + "</a> <br>");
        commandGroupNames.map((cg) => "<a href=#" + cg + ">" + cg + "</a> <br>");
    let cgMatches = getCommandsFromNames(commandGroupNames);

    let contextChange = [];
    for (const cc of c.contextChanges) {
        let token = (cc.token === undefined || cc.token .length === 0) ? "None" : 
            inlineCodeTemplate({code: cuteFormat(cc.token)});
        let action = (cc.action === undefined || cc.action.length === 0) ? "None" : cc.action;
        let target = (cc.target === undefined || cc.target.length === 0) ? "None" : 
            inlineCodeTemplate({code: cuteFormat(cc.target)});
        let style = (cc.style === undefined || cc.style.length === 0) ? "None" : 
            inlineCodeTemplate({code: cuteFormat(cc.style)});
        contextChange.push(contextChangeTemplate({
            token: token,
            action: action,
            target: target,
            style: style
        }));
    }

    let mergedCommands = []
    for (const cg of cgMatches) {
        mergedCommands.push(getCommandGroupHtml(cg, true));
    }

    let renderedContext = contextTemplate({
        name: name,
        extensions: extensions,
        contextChange: contextChange,
        commandLink: commandLink,
        mergedCommands: mergedCommands
    });
    fs.writeFileSync("./build/contexts/" + name + ".html", renderedContext);
}

let allLinksTemplate = Handlebars.compile(
    `<!DOCTYPE html>
    <html>
        <head>
            <title>{{name}}</title>
            <link rel="stylesheet" type="text/css" href="cube.css">
        </head>
        <body>
            <div class="container">
                <h1>{{name}}</h1>
                <div class="linkContainer">
                    {{#each links}}
                    {{{this}}}
                    {{/each}}
                </div>
            </div>
        </body>
    </html>`
);

// creates two HTML files containing all of contexts and commands jsons
function generateAllHtmlWithType(type) {
    let files = [];
    for (const fn of glob.sync("./../last-stop/" + type + "/*.json")) {
        files.push(JSON.parse(fs.readFileSync(fn).toString()));
    }
    // console.log(files)
    let fileObjs = [];
    if (type === "contexts") {
        fileObjs = files.map((f) => new Context(f));
    } else {
        fileObjs = files.map((f) => new CommandGroup(f));
    }
    let name = type;
    let links = [];
    for (const f of fileObjs) { // assuming f has a name attribute. If not, Too Bad!
        links.push("<a href=\"" + type + "/" + f.name + ".html\">" + f.name + "</a> <br>");
    }
    return allLinksTemplate({
        name: name, 
        links: links
    });
}

fs.writeFileSync("./build/" + "all_contexts" + ".html", generateAllHtmlWithType("contexts"));
fs.writeFileSync("./build/" + "all_commands" + ".html", generateAllHtmlWithType("commands"));