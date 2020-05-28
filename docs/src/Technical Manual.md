# Technical Manual

## Command Parsing

### 

Expressions

  - Number
  - Text
  - White

Values

  - Number(n)
  - Text(text, leftJoin, rightJoin, casing)
    - joins are DONTCARE, GLUE, UNDERSCORE, HYPHEN, WHITE
    - casings are LOW, FIRST, HIGH
  - Special(name, ...)


Parse

    flat pick 134 hello tower flabby kitten

with rules

    flat Text/V             -> special("flat", V)
    tower Text/V            -> special("tower", V)
    pick Number/N Text/V    -> special("pick", N, V)
    Number/N                -> special("to_text", N)
    White/W                 -> special("white", W)

Expression

    flat/T _/W tower/

Spoken word is applied to the state `S` as follows:

- Acquire a new spoken word string `SW`.
- Apply the lexing function `L(SW) = TS` to generate token stream `TS`.
  - Tokens consist of a `tag` and a `text`.
  - Tags are initially set by the lexer to `white`, `identifier`, `number`, `punctuation`.
- Let `I = 0`.
- While `I < TS.length`:
  - Let `CTX` equal the current context in state `S`.
  - Let `CMDS` equal the list of active commands of `CTX`.
  - For each command `C` of `CMDS`:
    - Attempt to match `C` with tokens starting at `TS[I]`
    - Keep track of longest match found
  - If no matches found:
    - Process the current token as an identifier.



  
