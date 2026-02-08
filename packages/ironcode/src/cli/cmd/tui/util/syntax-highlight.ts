import { RGBA } from "@opentui/core"

export interface Token {
  text: string
  color?: RGBA
}

export interface Theme {
  keyword: RGBA
  string: RGBA
  comment: RGBA
  number: RGBA
  function: RGBA
  type: RGBA
  variable: RGBA
  operator: RGBA
  punctuation: RGBA
  heading: RGBA
  link: RGBA
  bold: RGBA
  italic: RGBA
}

const languagePatterns: Record<string, Array<{ regex: RegExp; type: keyof Theme }>> = {
  typescript: [
    { regex: /\/\/.*$/gm, type: "comment" },
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    {
      regex:
        /\b(const|let|var|function|class|interface|type|enum|import|export|from|as|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|this|super|extends|implements|async|await|static|private|public|protected|readonly|abstract|namespace)\b/g,
      type: "keyword",
    },
    { regex: /\b(string|number|boolean|any|void|never|unknown|object|Array|Promise|Map|Set)\b/g, type: "type" },
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /\b[A-Z][a-zA-Z0-9]*\b/g, type: "type" },
    { regex: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/g, type: "function" },
    { regex: /[+\-*/%=<>!&|^~?:]/g, type: "operator" },
    { regex: /[{}[\]();,\.]/g, type: "punctuation" },
  ],
  javascript: [
    { regex: /\/\/.*$/gm, type: "comment" },
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    {
      regex:
        /\b(const|let|var|function|class|import|export|from|as|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|this|super|extends|async|await|static)\b/g,
      type: "keyword",
    },
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/g, type: "function" },
    { regex: /[+\-*/%=<>!&|^~?:]/g, type: "operator" },
    { regex: /[{}[\]();,\.]/g, type: "punctuation" },
  ],
  python: [
    { regex: /#.*$/gm, type: "comment" },
    { regex: /"""[\s\S]*?"""|'''[\s\S]*?'''/gm, type: "comment" },
    {
      regex:
        /\b(def|class|import|from|as|return|if|elif|else|for|while|break|continue|try|except|finally|raise|with|async|await|yield|lambda|pass|in|is|not|and|or|None|True|False)\b/g,
      type: "keyword",
    },
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|"""[\s\S]*?"""|'''[\s\S]*?'''/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/g, type: "function" },
    { regex: /[+\-*/%=<>!&|^~]/g, type: "operator" },
    { regex: /[{}[\]();:,\.]/g, type: "punctuation" },
  ],
  go: [
    { regex: /\/\/.*$/gm, type: "comment" },
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    {
      regex:
        /\b(package|import|func|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|break|continue|fallthrough|goto)\b/g,
      type: "keyword",
    },
    {
      regex:
        /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error)\b/g,
      type: "type",
    },
    { regex: /"(?:[^"\\]|\\.)*"|`[^`]*`/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /\b[A-Z][a-zA-Z0-9]*\b/g, type: "type" },
    { regex: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/g, type: "function" },
    { regex: /[+\-*/%=<>!&|^:]/g, type: "operator" },
    { regex: /[{}[\]();,\.]/g, type: "punctuation" },
  ],
  rust: [
    { regex: /\/\/.*$/gm, type: "comment" },
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    {
      regex:
        /\b(fn|let|mut|const|struct|enum|impl|trait|type|use|pub|mod|crate|super|self|return|if|else|match|loop|while|for|in|break|continue|async|await|move|static|extern|unsafe)\b/g,
      type: "keyword",
    },
    {
      regex: /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result)\b/g,
      type: "type",
    },
    { regex: /"(?:[^"\\]|\\.)*"|r#"[^"]*"#/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /\b[A-Z][a-zA-Z0-9]*\b/g, type: "type" },
    { regex: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\(|!)/g, type: "function" },
    { regex: /[+\-*/%=<>!&|^]/g, type: "operator" },
    { regex: /[{}[\]();:,\.]/g, type: "punctuation" },
  ],
  markdown: [
    // Headers (must come before bold/italic)
    { regex: /^#{1,6}\s+.+$/gm, type: "heading" },
    // Code blocks (```...```)
    { regex: /```[\s\S]*?```/gm, type: "comment" },
    // Inline code (`...`)
    { regex: /`[^`]+`/g, type: "comment" },
    // Links [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: "link" },
    // Images ![alt](url)
    { regex: /!\[([^\]]*)\]\(([^)]+)\)/g, type: "link" },
    // Bold **text** or __text__
    { regex: /\*\*[^*]+\*\*|__[^_]+__/g, type: "bold" },
    // Italic *text* or _text_
    { regex: /\*[^*]+\*|_[^_]+_/g, type: "italic" },
    // Lists
    { regex: /^[\s]*[-*+]\s+/gm, type: "keyword" },
    { regex: /^[\s]*\d+\.\s+/gm, type: "keyword" },
    // Blockquotes
    { regex: /^>\s+.+$/gm, type: "comment" },
    // Horizontal rules
    { regex: /^[\s]*[-*_]{3,}[\s]*$/gm, type: "punctuation" },
  ],
  json: [
    { regex: /"(?:[^"\\]|\\.)*"\s*:/g, type: "function" }, // Keys
    { regex: /"(?:[^"\\]|\\.)*"/g, type: "string" }, // String values
    { regex: /\b(true|false|null)\b/g, type: "keyword" },
    { regex: /\b-?\d+\.?\d*([eE][+-]?\d+)?\b/g, type: "number" },
    { regex: /[{}[\]:,]/g, type: "punctuation" },
  ],
  yaml: [
    { regex: /#.*$/gm, type: "comment" },
    { regex: /^[\s]*[a-zA-Z_][\w]*:/gm, type: "function" }, // Keys
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, type: "string" },
    { regex: /\b(true|false|null|yes|no|on|off)\b/gi, type: "keyword" },
    { regex: /\b-?\d+\.?\d*\b/g, type: "number" },
    { regex: /^[\s]*-\s+/gm, type: "punctuation" },
  ],
  html: [
    { regex: /<!--[\s\S]*?-->/gm, type: "comment" },
    { regex: /<\/?[a-zA-Z][\w-]*(?:\s|>)/g, type: "keyword" }, // Tags
    { regex: /\b[a-zA-Z-]+(?==)/g, type: "function" }, // Attributes
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, type: "string" },
    { regex: /[<>\/=]/g, type: "operator" },
  ],
  css: [
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    { regex: /[.#]?[a-zA-Z][\w-]*(?=\s*\{)/g, type: "type" }, // Selectors
    { regex: /[a-zA-Z-]+(?=\s*:)/g, type: "function" }, // Properties
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, type: "string" },
    { regex: /\b\d+\.?\d*(px|em|rem|%|vh|vw|pt|cm|mm|in|deg|rad|s|ms)?\b/g, type: "number" },
    { regex: /[{}:;,()]/g, type: "punctuation" },
  ],
  sql: [
    { regex: /--.*$/gm, type: "comment" },
    { regex: /\/\*[\s\S]*?\*\//gm, type: "comment" },
    {
      regex:
        /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN)\b/gi,
      type: "keyword",
    },
    { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, type: "string" },
    { regex: /\b\d+\.?\d*\b/g, type: "number" },
    { regex: /[=<>!]+/g, type: "operator" },
    { regex: /[(),.;]/g, type: "punctuation" },
  ],
}

// Map file extensions to language patterns
const extensionToLanguage: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".md": "markdown",
  ".markdown": "markdown",
  ".json": "json",
  ".jsonc": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".html": "html",
  ".htm": "html",
  ".xml": "html",
  ".svg": "html",
  ".css": "css",
  ".scss": "css",
  ".sass": "css",
  ".less": "css",
  ".sql": "sql",
}

export function getLanguageFromExtension(filePath: string): string | undefined {
  const ext = filePath.substring(filePath.lastIndexOf("."))
  return extensionToLanguage[ext]
}

export function highlightLine(line: string, language: string, theme: Theme): Token[] {
  const patterns = languagePatterns[language]
  if (!patterns) {
    return [{ text: line }]
  }

  const tokens: Token[] = []
  let remaining = line
  let position = 0

  // Create an array of all matches with their positions
  interface Match {
    start: number
    end: number
    type: keyof Theme
    text: string
  }

  const allMatches: Match[] = []

  for (const { regex, type } of patterns) {
    const r = new RegExp(regex.source, regex.flags)
    let match: RegExpExecArray | null

    while ((match = r.exec(line)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type,
        text: match[0],
      })
    }
  }

  // Sort matches by start position
  allMatches.sort((a, b) => a.start - b.start)

  // Remove overlapping matches (keep first occurrence)
  const nonOverlapping: Match[] = []
  let lastEnd = 0

  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match)
      lastEnd = match.end
    }
  }

  // Build tokens from non-overlapping matches
  position = 0
  for (const match of nonOverlapping) {
    // Add text before this match
    if (match.start > position) {
      tokens.push({ text: line.substring(position, match.start) })
    }

    // Add the highlighted match
    tokens.push({
      text: match.text,
      color: theme[match.type],
    })

    position = match.end
  }

  // Add remaining text
  if (position < line.length) {
    tokens.push({ text: line.substring(position) })
  }

  return tokens.length > 0 ? tokens : [{ text: line }]
}
