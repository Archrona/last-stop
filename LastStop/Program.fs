(* Note: You may introduce new code anywhere in this file. *) 

type object_phrase = string list

type command = 
  | Go of object_phrase
  | Quit
  | Score
  | Take of object_phrase
  | Drop of object_phrase
  | Inventory

exception Empty

exception Malformed

(** [words' str i ls acc] is the tail-recursive helper function used by
    [words] to split [str] into a list of non-whitespace words.
    [i] indicates the index of the character which we are examining on this
    step. [ls] and [acc] are the current state of the parser; in particular, 
    [ls] is the list of words, in reverse order, which have already been
    parsed, and [acc] is a string which accumulates non-white characters.

    The efficiency characteristics of this function are superior to using
    stock library functions because it avoids needless object creation.
    
    Requires: On first call, [i] = 0, [ls] = [], and [acc] = "". *)
let rec words' str i ls acc = 
  if i > String.length str - 1 then 
    if String.length acc > 0 then acc :: ls |> List.rev
    else List.rev ls
  else 
    let ch = str.[i] in
    if ch = ' ' then 
      if String.length acc > 0 then words' str (i + 1) (acc :: ls) ""
      else words' str (i + 1) ls ""
    else
      acc + (new System.String(ch, 1)) |> words' str (i + 1) ls 
      
(** [words str] spits [str] into a list of non-whitespace words. *)
let words str = words' str 0 [] ""

(** [parse str] makes use of private function [words] above to do the
    heavy lifting. This function just reads the word list and returns
    a [command] if appropriate. Add additional commands to the end of
    the match expression. *)
let parse str = 
  let w = words str in
  match w with
    | [] -> raise Empty
    | ["quit"] -> Quit
    | ["score"] -> Score
    | ["inventory"] -> Inventory
    | "go" :: [] -> raise Malformed
    | "go" :: res -> Go res
    | "take" :: [] -> raise Malformed
    | "take" :: res -> Take res
    | "drop" :: [] -> raise Malformed
    | "drop" :: res -> Drop res
    | _ -> raise Malformed

[<EntryPoint>]
let main argv =
    let items = parse "go fat fuck"
    printfn "%A" items
    printfn "%A" (3 % 4)
    0
