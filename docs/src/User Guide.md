# Last Stop User Guide

Welcome to the user guide! This guide will show you the ropes - hopefully you won't have to hang yourself with them.



## Concepts

Before you read the rest of this documentation, you should learn the meanings of some common terms you will encounter.

**Project**: The directory on your computer's filesystem containing the files you wish to edit. Commands dealing with files will automatically scope requests to this directory. At most one project is open at a time; when you first open the editor, no project will be open. You can still edit files, but you will not be able to save or load them from the filesystem.

**Window**: A single operating system window. Each window is numbered with an ID displayed in its upper-left corner. IDs are unique and start at `11`. In spoken commands, this ID can be used to refer to the window.

**Speech Console**: A small window where you can direct your dictation software to type. The speech console will be your constant companion as you use Last Stop. By spoken commands, you can control almost everything: files, window contents, plaintext input, code input, the clipboard, and so on.

**Document**: A named buffer of text which can be edited, displayed, and so forth. Documents can be linked to specific files on disk, but it is important to note that they are not the same as files. As you use the editor, the contents of a document will diverge from what is stored on disk. External editors and tools can also modify the on-disk file. It is best to think of a Document as a mutable snapshot of what existed in a file at a given moment in time. Saving or loading the Document brings the editor's buffer and the filesystem into concordance. 

You can also edit a document that has no on-disk representation – it exists only in memory. You may find this useful if you decide to use the editor as a scratchpad for editing content you'd like to insert into a different application.

**Anchor**: A position in a Document. As you edit, Anchors may travel along with the text they are attached to.

**Standard Anchors**: Every document comes with three standard Anchors: the cursor, the mark, and the view. The cursor represents your current position in the file. The mark is usually the same as the cursor, but if you select a range of text, the mark will indicate the other end of the selection. The view points to the upper-left-hand corner of the region you would like to display. 

**Standard Anchor Indices**: If multiple windows are displaying a single document, you may want them to have different cursor, mark, and view positions. (Or you may not!) For that reason, documents can have multiple sets of standard anchors. These are referred to by their *anchor index*. Indices begin at `0` and end at `3`, which means that a maximum of four unique cursor-mark-view anchor sets may exist in a single document.

**Subscription**: Each Window has a Subscription which describes what the Window should display. For example, the subscription `doc@name@0` displays the Document named `name` at standard anchor index `0`. The subscription `project@30` displays information about the active Project starting from line `30`.

**Command**: A word or phrase in your speech input which is recognized by the editor as having a special meaning. For instance, you might say `step` to move the cursor to the next insertion point, or `at least` to enter the operator `>=` in a program.

Commands range in function, consisting of:

- simple substitutions (replacing `one` with `1`)
- complex substitutions (replacing `if` with a three-line structure containing blanks to fill in)
- subs with arguments (replacing `pick 13 hello` with `hl`)
- modifiers affecting identifiers (replacing `great original name` with `ORIGINAL_NAME`)
- navigation commands with arguments (saying `go 141.3` to move the cursor to the third token of the 141st line).

Commands are stored in `commands.json` and can be modified while the program is running. Press `Ctrl-r` in any editor window to reload the command (and context) files and reprocess the speech console.

**Context**: The Context at the cursor affects which commands apply and what they do. Context changes when you move your cursor to a new location. Comments, strings, regular expressions, embedded code, math -- moving the cursor in or out of all of these regions can change the context. 

For example, if you are editing a TypeScript file, the active context might be `typescript`. When you move the cursor into a comment beginning with `//`, the context will change to `line-comment`. In the `typescript` context, the word `if` indicates a complex substitution command, but the same word `if` in the `line-comment` context would simply type `"if"`.

Contexts are stored in `contexts.json` and can be modified while the program is running. Press `Ctrl-r` in any editor window to reload the context file and reprocess the speech console.





## Editing Documents

### Text vs. Source Mode

The speech console has two modes.

In a text file, string, or other context where the capitalization and spacing of your speech should be preserved, the speech console will be in **text mode**. Commands will still be recognized in this mode, but non-command text will be emitted verbatim at the active cursor. For the most part, text mode should feel like you are speaking directly into the file with no assistance.

In a source file or other context where Last Stop should automatically apply capitalization, spacing, and formatting, the speech console will be in **source mode**. In this mode, the full spectrum of commands is available. Words not recognized as commands will be joined together into identifiers (variable names) using spacing and capitalization rules. For instance,

    camel object name call finish

Might become

    objectName();



### Whitespace

Whitespace is processed as meaningful input only when it is:

- *between* two text mode phrases.

It is ignored when it is:

- *between* a text mode phrase and the beginning or end of the speech input;
- *between* two source mode phrases.

For instance, in the below string, only the whitespace marked with `#` is processed:

    "  source text text text source source text  "
     ..      .    #    #    .      .      .    ..

The command `stop` acts in all contexts as a do-nothing placeholder. To explicitly insert whitespace into text mode, say `stop` between the whitespace and the adjacent text phrase. For instance:

    "  source stop  text text  stop  "
     ..      .    ##    #    ##    ..

To insert a space explicitly, use command `blank`, which acts in all contexts as a space bar.

    quotes Hello there! blank step

will process into

    "Hello there! "



### Mouse and Keyboard Events

For technical reasons, *all* inputs -- including mouse and keyboard -- are funneled through the speech console. Non-spoken commands are wrapped in the Unicode delimiters `«` and `»`. For instance,

- typing the word `hello`, then
- clicking the mouse button 0 in window 11 at row 3, column 14

might be displayed as `«\κhello\μ11.3.14.0»`.


### Locations

In speech, any positive number greater than or equal to `11` is potentially a location.

Windows have unique IDs starting from `11`. When a window is closed, it relinquishes its ID and future windows can reuse it. When you want to switch from one window to another, navigate to its ID (`go to 11`). You can also use a window's ID to set its subscription (`show 145 on 11` where `145` refers to a file, `show projects on 11`).

Line numbers usually begin from `30` and are unique across *all* windows. Even if you are in window `11`, referring to a line number in window `13` is unambiguous. This can be used navigate quickly between windows or refer to items in distant windows. For instance, in the command `show 145 on 11`, `145` is a line number reference to a Project view -- it refers to a named file on the file system. This saves you from having to speak complex filenames and their extensions.

Floating-point numbers such as `76.1` refer to an index (`1`) within a line (`76`). The meaning varies from subscription to subscription. For documents, the decimal portion of a location refers to the token index. For example, in the line

    76   if (x < 3) {

the following tokens are addressable:

Token | Text
--- | ---
76.0 | `if`
76.1 | `(`
76.2 | `x`
76.3 | `<`
76.4 | `3`
76.5 | `)`
76.6 | `{`

To refer to a line or line-column position in a document (instead of a window), you must preface the location with the word `line`. After the `line` directive, *all* positive numbers are interpreted as positions, not just ones at or above `11`. For instance, `line 7` unambiguously refers to `line 7` of the active window.

A number which is *only* a decimal (`.7`, `.14`) refers to tokens on the active line in the active window.





## Managing Views and Projects
















---

# Reference




## Subscriptions

Name | Description
--- | ---
`doc@NAME@CURSOR` | Document `NAME` is displayed for editing at standard anchor index `CURSOR`. Values from `0` to `3` are accepted for `CURSOR`.
`project@LINE` | Information about the active project and some global status information. View starts at line index `LINE`.
`documents@LINE` | Information about open documents. View starts at line index `LINE`.




## Contexts

Name | Description
--- | ---
`basic` | A generic programming-ish environment used for testing.
`double_quoted_string` | A string delimited by `"..."`. 




## Commands

### Letters and Numbers

Last Stop supports three phonetic alphabets: one for forced lowercase, one for forced uppercase, and one which uses the active casing.

Character | Active Casing | Lowercase | Uppercase
--- | --- | --- | ---
a | `alpha` | `andrew` | `atlanta`
b | `bravo` | `bradley`| `bangkok`
c | `charlie` | `colby` | `chicago`
d | `delta` | `douglas` | `dallas`
e | `echo` | `edgar` | `egypt`
f | `foxtrot` | `felix` | `france`
g | `golf` | `gregory` | `georgia`
h | `hotel` | `harvey` | `houston`
i | `india` | `isaac` | `iceland`
j | `juliet` | `jackson` | `jakarta`
k | `kilo` | `kirby` | `khartoum`
l | `lima` | `lamarr` | `london`
m | `mike` | `mitchell` | `madrid`
n | `november` | `neville` | `norway`
o | `oscar` | `oliver` | `orlando`
p | `papa` | `preston` | `poland`
q | `quebec` | `quentin` | `qatar`
r | `romeo` | `richard` | `russia`
s | `sierra` | `stacy` | `sydney`
t | `tango` | `tommy` | `tokyo`
u | `uniform` | `ulysses` | `ukraine`
v | `victor` | `virgil` | `vietnam`
w | `whiskey` | `whitney` | `washington`
x | `x-ray` | `xavier` | `xiamen`
y | `yankee` | `young` | `yemen`
z | `zulu` | `zachary` | `zambia`

Replacements for numbers 1 through 10 are also supported. However, because the numbers 2 and 4 are homonyms with function words `to` and `for`, only the exact spelling is converted into numeric form. Dragon supports the spoken syntax `numeral two` and `numeral four` to force these to numeric form.

Number | Command
--- | ---
0 | `zero`
1 | `one`, `won`
2 | `two`
3 | `three`
4 | `four`
5 | `five`
6 | `six`, `sicks`
7 | `seven`
8 | `eight`, `ate`
9 | `nine`, `nein`
10 | `ten`



### Operators and Structures

Not all of these are supported in every context, but when they *are* supported, the spoken forms are as below:

#### Access and Reference

Operator | Spoken Form
--- | ---
`=` | `is`, `are`
`.` | `dot`
`->` | `arrow`, `aero`
`=>` | `maps to`, `becomes`
`...` | `spread`

#### Logical

Operator | Spoken Form
--- | ---
`==` | `equals`, `[is] equal [to]` (outside JS/TS), `loose equals`
`===` | `equals` (in JS/TS)
`<` | `[is] below`, `[is] less than`
`>` | `[is] above`, `[is] greater than`
`<=` | `[is] at most`, `[is] less than or equal to`
`>=` | `[is] at least`, `[is] greater than or equal to`

#### Arithmetic

Operator | Spoken Form
--- | ---
`+[=]` | `plus [equals]`
`-[=]` | `minus [equals]`
`*[=]` | `times [equals]`
`/[=]` | `divide [equals]`, `divided by [equals]`
`%[=]` | `modulo [equals]`, `remainder [equals]`
`**[=]` | `exponent [equals]`
`<<[=]` | `shift left [equals]`
`>>[=]` | `shift right [equals]`
`++` | `increment`
`--` | `decrement`

#### Logical and Bitwise

Operator | Spoken Form
--- | ---
`&&` | `logical and`, `land`
`||` | `logical or`, `lore`
`!` | `logical not`, `not`
`&` | `bitwise and`, `band`
`|` | `bitwise or`, `bore`, `boar`
`~` | `bitwise not`
`^` | `[bitwise] exclusive or`, `[bitwise] xor`
`?:` | `branch`

#### Grouping

Operator | Spoken Form
--- | ---
`()` | `group` (standalone), `of` (attached left), `call` (empty)
`[]` | `list` (standalone), `at` (attached left)
`{}` | `record` (one line), `block` (multiline)
`<>` | `of type`
`""` | `quotes`
`''` | `drops`
``` `` ``` | `backs`

#### Escapes

`\\n` | `settle` (in string context)
`\\t` | `brindle` (in string context)
`\\\\` | `dorsal` (in string context)



### Complex Replacements


### Distant Navigation

The verb `go` is used for all navigation. Although `go` moves the cursor and mark, the view will also follow in such a way to keep as much relevant content centered on screen as possible.  It is often followed by another function word to indicate the kind of navigation, as below:

Command | Meaning
--- | ---
`go [to] W` | Activates window with ID `W`.
`go [to] W line L` | Shorthand for `go to W go to line L`.
`go [to] L` | Places the cursor at the end of `L`.
`go [to] L.T` | Selects all of `L.T`.
`go all [of] L` | Selects all of line `L` including the trailing newline.
`go all [of] L1 to L2` | Selects all of lines `L1` through `L2`, including the trailing newline.
`go before L.T` | Places the cursor immediately before `L.T`.
`go after L.T` | Places the cursor immediately after `L.T`.in
`go from L1[.T] to L2[.T]` &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Selects from the beginning of `L1` or `L1.T` to the end of `L2` or `L2.T`. Does not include trailing newlines of `L2`.

Documents maintain up to 99 **spots** each. A spot can be used as a location by prefacing its spot index with the word `spot`. The syntax `spot N` can be used anywhere `L` or `L.T` can be used. 

If a spot in a different window is needed, the floating-point number `W.N` refers to spot `N` of the document active in window `W`.

Command | Meaning
--- | ---
`go spot N` | Navigate to spot `N`.
`go spot W.N` | Navigate to spot `N` of the document in window `W`.
`go ... spot ...` | All other go commands can be used with spots.
`mark spot N` | The active cursor is now spot N.


### Local Navigation

There are also many *relative* navigation commands that use the context around the cursor to move or change the active selection. Some locations are defined contextually:

Location | Meaning
--- | ---
`left margin` | The leftmost character on the starting line of the selection.
`right margin` | The rightmost character on the starting line of the selection.
`lead` | The leftmost non-white character of the starting line of the selection.
`trail` | The rightmost non-white character of the ending line of the selection.


Other navigation commands suited for code insertion include:

Command | Meaning
--- | ---
`step` | Move ahead 1 insertion point.
`jump` | Move ahead 2 insertion points.
`leap` | Move ahead 3 insertion points.
`ok` | Go to end of line, hit enter.
`finish` | Go to end of line, terminate the statement (`;` or the like), hit enter.
`and then` | Go to end of line, write a comma (`,`), hit enter.



### Whitespace Control

Below, `[lr]` means either `left`, `right`, or nothing; `[ab]` means either `above`, `below`, or nothing.

Command | Meaning
--- | ---
`halo [lr]` &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Expand selection to include adjacent whitespace. Can cross lines.
`sponge [lr]` | Delete whitespace both within and adjacent to the selection. Can cross lines.
`stretch [lr]` | Ensure that there is at least one space between the selection and the adjacent tokens.
`dilate [ab]` | Ensure that there is at least one empty line between the selection and the adjacent lines.
`indent [T]` | Indent the lines containing the selection `T` times. 
`unindent [T]` | Unindent the lines containing the selection `T` times.
`crack` | Hit enter, tab.
`expand` | Hit enter, tab, enter, backspace. Then put cursor in middle.




### Clipboard

Last Stop does not just have a single clipboard - it maintains a clipboard *ring*. The ring has `8` slots numbered `0` through `7`, and loops around once it reaches the end. Because the words "cut", "copy", and "paste" often carry special meaning to dictation software, Last Stop uses alternatives:

Command | Meaning
--- | ---
`yank` | Like "cut". Place the current selection into the next clipboard slot and delete the selection.
`grab` | Like "copy". Place the current selection into the next clipboard slot.
`smear` | Like "paste". Does not change the clipboard ring position.
`shed` | Like "paste". Moves the clipboard ring position left one, to the previous item.

Clipboard commands also work on `go`-locations. A line number reference will implicitly refer to the *entire* line, including the trailing newline.

Command | Meaning
--- | ---
`yank L` | `yank` at location `L`; do not move the cursor.
`grab L` | `grab` location `L`; do not move the cursor.
`smear L` | `smear` at location `L`; do not move the cursor.
`shed L` | `shed` at location `L`; do not move the cursor.




### Subscriptions

The verb `show` is used to change subscriptions, typically in the form `show SUB on W`, where `SUB` is a phrase indicating a subscription and `W` is a window ID.

Command | Meaning
--- | ---
`show projects [on] W` | Project view.
`show documents [on] W` | Documents view.
`show L on W` | If `L` is a line reference to a document in the project view, show that document on window `W`. Open well though there a shit you



### Project








