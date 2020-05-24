# Last Stop User Guide

Welcome to the user guide! This guide will show you the ropes - hopefully you won't have to hang yourself with them.


## Commands

Last Stop's command language allows the user to control the editor through speech alone. Commands range in function, consisting of:

- simple substitutions (replacing `one` with `1`)
- complex substitutions (replacing `if` with a three-line structure containing blanks to fill in)
- subs with arguments (replacing `pick 13 hello` with `hl`)
- modifiers affecting identifiers (replacing `great original name` with `ORIGINAL_NAME`)
- navigation commands with arguments (saying `go 141.3` to move the cursor to the third token of the 141st line).



## Contexts

The **context** at the cursor affects which commands apply and what they do.

Context changes when you move your cursor to a new location. Comments, strings, regular expressions, embedded code, math -- moving the cursor in or out of all of these regions can change the context.

For example, languages containing a lambda operation will respond to `lambda`, each in a language-specific fashion. Others will treat `lambda` like a variable name or plain word.




## Speech

The speech console will be your constant companion as you use Last Stop. By speaking, you can control almost everything: files, window contents, plaintext input, code input, the clipboard, and so on.

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



### Mouse and Keyboard Events

For technical reasons, *all* inputs -- including mouse and keyboard -- are funneled through the speech console. Non-spoken commands are wrapped in the Unicode delimiters `«` and `»`. For instance,

- typing the word `hello`, then
- clicking the mouse button 0 in window 11 at row 3, column 14

might be displayed as `«\κhello\μ11.3.14.0»`.
