
# Version 0.3.0
## 6/27/2020

- work out proper grammar for locations, implement
- implement line N
- implement go invalid line doesn't dump bullshit, just silently fails

- ensure that including a command multiple times OVERRIDES, not makes a second copy
- contextChanges "token" key uses regexp rather than raw string

- generalized config overrides by file, project, language
- override: default casing by file, project (and spoken commands)
- override: tab/space (and spoken commands)
- pick N word does the first N letters if N is in the range 1-9
- make sure grab all doesnt grab the squares for insertion points

- AND ALL THE PROJECT STUFF

- (??) implement clipboard internal (ring)
- (??) successive raw keyboard commands collapse without prime
- (??) contextual capitalization on forms like "new", "extends", "class"
- (??) implement regular expression spoken forms
- (??) make regexp literals into a real context, deal with multiline, etc. fuck me
- (??) implement markdown inside doc comments, lol god hates you
- (??) focusing one window focuses all windows
- (??) large-scale undo (by big blocks) - kb shortcut?
- (??) implement go L through L without "from"
- (??) implement $identifier
- (??) implement context override signals
- (??) get a better token index display than the stupid dots
- (??) ctrl-z from raw


# Version 0.2.1
## 6/15/2020

- html/css support
- COMMENTS/DOCS
- Bugfixes



# Version 0.2.0
## 6/8/2020

- (DONE)  keyboard/mouse commands and <<>> collapsing in speech console
- (DONE)  implement paste
- (DONE)  reload all json files at runtime with ctrl-0
- (DONE)  implement and document remaining external clipboard commands
- (DONE)  implement bkspc, del, arrows, enter
- (DONE)  closing speech console commits changes (or restores original text?)
- (DONE)  operators parse/space as whole tokens rather than individual characters
- (DONE)  T<> needs glued spacing inside
- (DONE)  HELLO WORLD fixed
- (DONE)  indent correctly on enter / paste / drop
- (DONE)  on drop don't carry the whitespace AFTER the original cursor
- (DONE)  Bug:  Spitz go 32 go all 32 Yank go after 33 (last line) okay
- (DONE)  add whitespace control commands
- (DONE)  end, home

- clipboard $location commands
- transitives (move, copy X to Y / above Y / below Y)

- drag command selects region
- drag continuous update

- no respond on unfocused click, just focus
- display line numbers in display on RHS
- wordwrap rather than cut off long lines

- shift-cursor
- right click xfer to speech
- disable ctrl-shift-c
- process ctrl-s from raw input
- process ctrl-0 from raw input





# Version 0.1.0
## 6/1/2020

- (DONE)  step correctly removes empty lines
- (DONE)  okay, and then remove insertion points
- (DONE)  fix literally
- (DONE)  don't syntax highlight identifiers like ifWhile as keywords
- (DONE)  add keywords to syntax highlighting for ts
- (DONE)  deal with spacing at quotes transition correctly (don't space)
- (DONE)  fix spacing of - when used as a unary op
- (DONE)  phonetic alphabet support in custom json file
- (DONE)  configurable spoken forms for hardcoded names in speech parser (identifiers)
- (DONE)  allow finish and other EOL commands from within strings
- (DONE)  implement other string contexts '' ``
- (DONE)  implement regexp literals // (how to deal with slash having context?)
- (DONE)  implement single line comments
- (DONE)  implement multi line comments
- (DONE)  implement doc comments
- (DONE)  think of better name for "quotes" – Dragon sometimes parses it
- (DONE)  fix broken pick commands
- (DONE)  fix literally inside raw context: should still work
- (DONE)  can remap literally
- (DONE)  implement the actual "pick" command
- (DONE)  enable commit changes (ctrl-S)
- (DONE)  allow copy to clipboard and clear (ctrl-enter)
- (DONE)  go command, position parsing
- (DONE)  match!== null
- (DONE)  ! numeric.hasToken()
- (DONE)  length -1
- (DONE)  return[] -> return []
- (DONE)  "else" and block openers parse with accent
- (DONE)  indicate EOF
- (DONE)  get a bit more whitespace on display between left margin and code
- (DONE)  go 30 ok puts NL on 32
- (DONE)  make token for standalone _ in ident, add to alphabet?
- (DONE)  make others list for characters
- (DONE)  Capitalization.First does not cap if only chars are "_" 


