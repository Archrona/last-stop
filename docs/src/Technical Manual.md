# Technical Manual

## Command Parsing

Command special parses:

Parse | Meaning
--- | ---
`$position` | A position somewhere in the editor.
`$identifier` | The name of a thing.

Insert escapes:

Escape | Meaning
--- | ---
`$n` | Hit enter and match indentation.
`$u` | Hit enter, indent up 1.
`$d` | Hit enter, indent down 1.
`$g` | Glue to neighbor (no space).
`$t` | Hit tab.
`$$` | Type `$`.
`$_` | Insertion point.
`$1` | Substitute first match from command.
`$2` | Substitute second match from command.





  
