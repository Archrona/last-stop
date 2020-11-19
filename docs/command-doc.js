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
            result += `Inserts ${TEMPLATES.inlineCodeTemplate({ code: insert })}`;
        }
        if (this.run !== undefined) {
            if (result !== "") {
                result += `\n Executes ${TEMPLATES.inlineCodeTemplate({ code: cuteFormat(this.run) })}`;
            }
            else {
                result += `Executes ${TEMPLATES.inlineCodeTemplate({ code: cuteFormat(this.run) })}`;
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

const TEMPLATES = {
    contextTemplate: Handlebars.compile(
        String(fs.readFileSync("templates/contextTemplate.html"))
    ),

    contextChangeTemplate: Handlebars.compile(
        `<tr>
            <td>{{{token}}}</td>
            <td>{{{action}}}</td>
            <td>{{{target}}}</td>
            <td>{{{style}}}</td>
        </tr>`
    ),
    commandTemplate: Handlebars.compile(
        `<tr>
            <td>{{{spoken}}}</td>
            <td>{{{definition}}}</td>
        </tr>`
    ),
    commandGroupTemplate: Handlebars.compile(
        String(fs.readFileSync("templates/commandGroupTemplate.html"))
    ),
    mergedCommandsTemplate: Handlebars.compile(
        String(fs.readFileSync("templates/mergedCommandsTemplate.html"))
    ),
    inlineCodeTemplate: Handlebars.compile(
        `<code>{{code}}</code>`
    ),
    allLinksTemplate: Handlebars.compile(
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
    ),
    sidebarTemplate: Handlebars.compile(
        `<div class="sidenav" id="mySidebar">
            <div class="inside">
                <h2>All Contexts</h2>
                {{#each links}}
                {{{this}}}
                {{/each}}
            </div>
        </div>`
    ), 
    linkTemplate: Handlebars.compile(
        `<a href={{linkAddress}}>{{linkName}}</a>`
    )
};

// helper lmao
function cuteFormat(code) {
    let s = JSON.stringify(code);
    s = s.substring(1, s.length - 1);
    s = s.replace(/\\"/, "\""); // replaces \ with \\
    return s;
}

class App {
    constructor() {
        this.contextFiles = [];
        for (const fn of glob.sync("./../last-stop/contexts/*.json")) {
            this.contextFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
        }

        this.commandGroupFiles = [];
        for (const fn of glob.sync("./../last-stop/commands/*.json")) {
            this.commandGroupFiles.push(JSON.parse(fs.readFileSync(fn).toString()));
        }

        this.contexts = this.contextFiles.map((contextFile) => new Context(contextFile));
        this.commandGroups = this.commandGroupFiles.map((commandGroup) => new CommandGroup(commandGroup));

        // rendering and HTML output of CommandGroups only
        for (const cg of this.commandGroups) {
            let renderedcg = this.getCommandGroupHtml(cg, false);
            fs.writeFileSync("./build/commands/" + cg.name + ".html", renderedcg);
        }

        // rendering and HTML output of contexts
        this.renderContexts()
    }

    renderContexts() {
        for (const c of this.contexts) {
            let commandGroupNames = c.commands;
            let name = c.name;

            // file extensions
            let extensions = (c.extensions === undefined || c.extensions.length === 0) ? "None" : c.extensions;
            
            // links to all commands used by context
            let commandLink = (c.commands === undefined || c.commands.length === 0) ? "None" :
                commandGroupNames.map((cg) => "<a href=#" + cg + ">" + cg + "</a> <br>");
            
            // CommandGroup objects from their names
            let cgMatches = this.getCommandsFromNames(commandGroupNames);

            // populates list of html of context changes
            let contextChange = [];
            for (const cc of c.contextChanges) {
                let token = (cc.token === undefined || cc.token.length === 0) ? "None" :
                    TEMPLATES.inlineCodeTemplate({ code: cuteFormat(cc.token) });
                let action = (cc.action === undefined || cc.action.length === 0) ? "None" : cc.action;
                let target = (cc.target === undefined || cc.target.length === 0) ? "None" :
                    TEMPLATES.inlineCodeTemplate({ code: cuteFormat(cc.target) });
                let style = (cc.style === undefined || cc.style.length === 0) ? "None" :
                    TEMPLATES.inlineCodeTemplate({ code: cuteFormat(cc.style) });
                contextChange.push(TEMPLATES.contextChangeTemplate({
                    token: token,
                    action: action,
                    target: target,
                    style: style
                }));
            }

            // populates a list of html of tables of all command groups used
            let mergedCommands = []
            for (const cg of cgMatches) {
                mergedCommands.push(this.getCommandGroupHtml(cg, true));
            }

            // final render
            let renderedContext = TEMPLATES.contextTemplate({
                name: name,
                sidebar: this.generateListLinksWithType("contexts"),
                extensions: extensions,
                contextChange: contextChange,
                commandLink: commandLink,
                mergedCommands: mergedCommands
            });
            fs.writeFileSync("./build/contexts/" + name + ".html", renderedContext);
        }
    }
    // helper
    // commandGroup: a CommandGroup
    getCommandGroupHtml(commandGroup, merged) {
        let renderedCommands = [];
        let commands = commandGroup.commands;

        for (const c of commands) {
            let command = new Command(c);
            let spoken = command.spoken.join(", ");
            let explanation = command.getExplanation();
            let renderedCommand = TEMPLATES.commandTemplate({
                spoken: spoken,
                definition: explanation
            });
            renderedCommands.push(renderedCommand);
        }
        let result;
        if (merged) {
            result = TEMPLATES.mergedCommandsTemplate({
                name: commandGroup.name,
                commands: renderedCommands
            });
        }
        else {
            result = TEMPLATES.commandGroupTemplate({
                name: commandGroup.name,
                commands: renderedCommands
            });
        }
        return result;
    }

    // helper
    getCommandsFromNames(names) {
        let cgMatches = this.commandGroups.filter((cg) => names.includes(cg.name));
        return cgMatches.reverse(); // for some reason they show up backwards so here's a "fix"
    }

    // generates a shitty page containing links to all htmls of a certain type of json
    // currently "contexts" or "commands" only get fucked
    generateListLinksWithType(type) {
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
        let links = [];
        for (const f of fileObjs) { // assuming f has a name attribute. If not, Too Bad!
            // links would be fucked if in future new folders. too bad!
            links.push("<a href=\"" + f.name + ".html\">" + f.name + "</a>"); 
        }
        return TEMPLATES.sidebarTemplate({
            links: links
        });
    }
}

// Runs program
const app = new App();
