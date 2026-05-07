---
name: compress
description: >
  Compresses natural language files (markdown, text) into caveman-speak to reduce
  input token usage ~46%. Backs up original before overwriting. Only touches prose —
  code blocks stay exact. Trigger: /caveman:compress <filepath>, or user asks to
  compress a memory/doc file.
---

Compress target file to caveman prose. Backup first. Code blocks exact. Retry up to 2x on error.

## Trigger

`/caveman:compress <filepath>` or user asks to "compress this file", "shrink this doc", "make this memory smaller".

## Allowed file types

`.md`, `.txt`, `.typ`, `.typst`, `.tex`, extensionless files only.

Never touch: `.py`, `.js`, `.ts`, `.json`, `.yaml`, `.yml`, `.env`, `.toml`, `.sh`, or any code file. Never re-compress `.original.md` files.

## Process

1. Read target file
2. Create backup: `<filename>.original.md` (same dir) — skip if already exists
3. Compress prose sections (see rules below)
4. Write compressed content back to original file path
5. Report: original token count, compressed token count, % reduction

## Compression rules

**Remove:** articles (a/an/the), filler (just, really, basically, actually, simply, in order to → to), pleasantries (please, feel free to, don't hesitate), hedging (you might want to, consider, perhaps), "you should" constructions.

**Preserve exactly:** code blocks (``` ... ```), inline code (`...`), URLs, file paths, shell commands, technical terms, proper nouns, dates, version numbers, env vars, error strings.

**Preserve structure:** markdown headings, bullet hierarchies, numbered lists, tables, YAML frontmatter.

**Compress text:** shorter synonyms, sentence fragments OK, merge redundant bullets into one, keep single representative example when multiple exist.

Example:
- Before: "You should always run your tests before pushing your changes to make sure everything is working correctly."
- After: "Run tests before push."

## Validation

After compression:
- All code blocks present and unmodified
- No URLs dropped
- File is valid markdown (headings intact, no broken lists)
- Token count reduced (if not, warn user)

If validation fails: retry compression up to 2 times. If still failing: report error, restore original, do not overwrite.

## Output

```
Compressed <filepath>
Original: ~N tokens → Compressed: ~N tokens (X% reduction)
Backup: <filepath>.original.md
```
