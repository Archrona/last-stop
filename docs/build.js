
var hljs = require('highlight.js');
var glob = require('glob');
var fs = require('fs');
var path = require('path');

const Handlebars = require("handlebars");

const template = Handlebars.compile(
`<!DOCTYPE html>
<html>
    <head>
        <title>{{title}}</title>
        <link rel="stylesheet" type="text/css" href="style.css">
    </head>
    <body>
        <div class="container">
            {{{body}}}  
        </div>
    </body>
</html>`
);

// full options list (defaults)
var md = require('markdown-it')({
  html:         true,        // Enable HTML tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />).
                              // This is only for full CommonMark compatibility.
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  langPrefix:   'language-',  // CSS language prefix for fenced blocks. Can be
                              // useful for external highlighters.
  linkify:      true,        // Autoconvert URL-like text to links
 
  // Enable some language-neutral replacement + quotes beautification
  typographer:  true,
 
  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
  quotes: '“”‘’',
 
  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externally.
  // If result starts with <pre... internal wrapper is skipped.
  highlight: function (str, lang) {
    if (!lang) lang = "ts";
    if (hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value;
      } catch (__) {}
    }
 
    return ''; // use external default escaping
  }
});

let files = glob.sync("src/*.md");

console.log("Building " + files.length + " markdown files...");

for (let f of files) {
    let data = fs.readFileSync(f).toString("UTF-8");
    let rendered = template({
        title: "last-stop: " + path.basename(f, ".md"),
        body: md.render(data)
    });
    let outName = "build/" + path.basename(f, ".md") + ".html";
    fs.writeFileSync(outName, rendered);
}

console.log("Copying .css files...");

for (let f of glob.sync("src/*.css")) {
    let outName = "build/" + path.basename(f);
    fs.copyFileSync(f, outName);
}

console.log("Done!");