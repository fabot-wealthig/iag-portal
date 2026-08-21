# GOTCHAS

Hard-won traps, **append-only and oldest-first**. Entries are numbered permanently from #1 and are
NEVER renumbered, even if an entry later becomes obsolete — other docs and commit messages cite
these numbers. New entries go at the END of the file with the next number after the current max.

Nothing is deleted here. If an entry stops applying, say so inside the entry; leave the number.

## #1 — PowerShell 5.1 has no `&&`, no `tail`, and `Out-File` writes BOMs

This machine runs Windows PowerShell 5.1, not PowerShell 7. Consequences that bite every session:

- The `&&` and `||` pipeline chain operators do not exist and produce a parser error. Chain with
  `;`, or use `A; if ($?) { B }` when the second command should only run on success.
- There is no `tail` (and no `head`). Use `Get-Content <file> -Tail N` / `-TotalCount N`, or
  `Select-Object -Last N` / `-First N` in a pipeline.
- `Out-File`, `>`, and `Set-Content` write byte-order marks or ANSI-encoded text depending on the
  cmdlet. Files written that way break tools that expect clean UTF-8 — git commit messages in
  particular. Use the editor tools (Write/Edit) for any file content, or `git commit -m` flags.
