// Text-layer checker (docs/i18n.md). Syntax-only TypeScript AST pass over src/ and server/.
//
//   node scripts/check-i18n.mjs                    full check (npm run test:i18n)
//   node scripts/check-i18n.mjs --missing <path>…  paste-ready catalog stubs for keys no area has
//   node scripts/check-i18n.mjs --update-baseline  rewrites scripts/i18n-baseline.json (never raises a count)
//   node scripts/check-i18n.mjs --stats            counts per rule and per file
//   node scripts/check-i18n.mjs --self-test        key-identity fixtures and one bad example per error code
//
// Error codes (I18N-A1 …) are listed in docs/i18n.md. There is no allowlist file: the
// exemptions are keep(), a `// i18n-ignore` comment and the `// i18n: client-text` pragma.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { bucketOf, buildPatternIndex, compilePattern, hasPlaceholder, isTypedKey, largestBucket, letterCount, parseKey } from '../src/i18n/pattern.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = 'scripts/i18n-baseline.json'
const CATALOG_DIR = 'src/i18n/en'
const BUCKET_LIMIT = 40

const MARKERS = new Set(['t', 'de', 'tc', 'dc', 'plural', 'keep', 'num', 'eur', 'hhmm', 'verbatim', 'named', 'listOf', 'nested'])
const WRAPPER_TYPES = { num: 'n', eur: 'm', hhmm: 'time', verbatim: 'raw', named: 'name', listOf: 'list', nested: 't' }
const TRANSLATING = new Set(['t', 'tc', 'localize', 'localizeName', 'localizeHit'])
const FREE_TYPES = new Set(['raw', 'name', 'list', 't'])
const MARKER_MODULES = new Set(['src/i18n/index.ts', 'src/i18n/marker.ts', 'server/i18nMarker.ts'])
const AUTHORITATIVE_I18N = new Set(['src/i18n/marker.ts', 'server/i18nMarker.ts'])
const SINK_PROPS = new Set(['textContent', 'innerText', 'title', 'placeholder', 'label', 'innerHTML', 'ariaLabel', 'ariaDescription', 'ariaPlaceholder', 'ariaValueText'])
const SINK_CALLS = new Set(['showToast', 'toast', 'confirm', 'alert', 'confirmAction', 'fillText'])
const SINK_ATTRS = new Set(['title', 'aria-label', 'aria-description', 'aria-placeholder', 'aria-valuetext', 'placeholder', 'alt'])
const TEXT_PROPS = new Set(['name', 'label', 'detail', 'message', 'thought', 'title', 'hint', 'description', 'status', 'text', 'summary', 'reason', 'headline', 'caption', 'group'])
const SELECTOR_CALLS = new Set(['querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches', 'getItem', 'setItem', 'removeItem'])
/** Calls whose first argument a text is compared with (E4); `has` covers Sets of texts. */
const COMPARE_CALLS = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'has', 'match', 'search'])
/** Methods that ask a literal list whether it holds a text: `['…'].includes(m)`. */
const LIST_QUERIES = new Set(['includes', 'indexOf', 'lastIndexOf'])
const INDEX_HTML_NEEDLES = ['festival-player-settings', 'Wird geladen …', 'Loading …', '/src/boot.ts']
/** Markup attributes that carry text for people (§5.2 rule 1); `value` only when it looks like prose. */
const MARKUP_TEXT_ATTRS = /\b(title|aria-label|aria-description|aria-placeholder|aria-valuetext|placeholder|alt|label|value|data-(?:tip|tooltip|title|label|hint|help))="([^"]*)"/g
/**
 * KeyboardEvent.key names and similar platform words: German hint texts mention them
 * ("Mit Enter bestätigen"), yet as literals they are key codes, not text.
 */
const PLATFORM_WORDS = new Set(['Enter', 'Escape', 'Esc', 'Shift', 'Control', 'Ctrl', 'Alt', 'Meta', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'Space', 'Pause', 'Unidentified', 'Dead'])

const GERMAN_CHARS = /[äöüÄÖÜß„“]/
const STOP_WORDS = /(^|[^\p{L}])(der|die|das|den|dem|des|und|oder|nicht|ist|sind|ein|eine|einen|einem|kein|keine|mit|für|auf|zu|zum|zur|im|ins|bei|vom|von|ich|du|wir|sie|es|noch|schon|hier|wird|werden|wurde|kann|muss|nur|auch|alle|jetzt|bitte|mehr|neu|neue|neuen)(?=$|[^\p{L}])/iu
const MOJIBAKE = [/\p{L}\?\p{Ll}/u, /Ã[\x80-\xBF]/, /\uFFFD/]
const LEADING_ICON = /^(?:\p{Extended_Pictographic}|[\u2190-\u21ff\u2300-\u23ff\u2b00-\u2bff\u27f0-\u27ff])/u
const EDGE_PUNCTUATION = new Set(['·', ':', '–', ',', ';'])
const TOKEN_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const WORDISH = /^\p{L}[\p{L}'’-]*$/u
const NUMERIC = /^[+\-−]?\d[\d.,:]*[%€]?$/u
/** A capitalised word on its own: `Parkplatz`, `Festival-Shuttle`; not `LKW`, not `backgroundColor`. */
const CAPITALIZED_WORD = /(?<![\p{L}\p{N}_$])\p{Lu}\p{Ll}+(?:-\p{Lu}?\p{Ll}+)*(?![\p{L}\p{N}_$])/gu

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/')
const hasMojibake = (text) => MOJIBAKE.some((pattern) => pattern.test(text))
const isCapitalized = (word) => /^\p{Lu}\p{Ll}/u.test(word)

/**
 * The words of a text, or null when it holds something that is not prose: an identifier,
 * a path, a unit (`12px`), a colour, camelCase. Placeholders (`{}` between template
 * chunks), numbers, clocks, money and separators are skipped.
 */
function wordsOf(text) {
  const words = []
  for (const raw of text.replace(/\{\}/g, ' ').split(/\s+/)) {
    const token = raw.replace(TOKEN_EDGE, '')
    if (!token || NUMERIC.test(token)) continue
    if (!WORDISH.test(token) || /\p{Ll}\p{Lu}/u.test(token)) return null
    words.push(token)
  }
  return words
}

/**
 * Prose shape: two or more words that start with a capital (`Unwetter: Auftritte
 * unterbrochen`, `Wilde Maus (Stahl)`, `{0} Personen brauchen Hilfe.`), or a capitalised
 * noun after the first word, as German writes nouns mid-sentence (` in {0} Ausgaben
 * hintereinander`).
 */
function proseShape(text) {
  const words = wordsOf(text)
  if (!words || words.filter((word) => letterCount(word) >= 2).length < 2) return false
  return /^\p{Lu}/u.test(words[0]) || words.slice(1).some(isCapitalized)
}

const looksGerman = (text) => {
  const trimmed = text.trim()
  if (!/\p{L}/u.test(trimmed)) return null
  if (GERMAN_CHARS.test(trimmed)) return 'umlaut'
  if (/\s/.test(trimmed) && STOP_WORDS.test(trimmed)) return 'stop word'
  if (proseShape(trimmed)) return 'prose'
  return null
}

/** Capitalised words of known German text; they make a lone `'Parkplatz'` count as German too. */
function vocabularyWords(text) {
  return (text.replace(/\{\d*(?::[a-z]+)?\}/g, ' ').match(CAPITALIZED_WORD) ?? []).filter((word) => letterCount(word) >= 3 && !PLATFORM_WORDS.has(word))
}

/** The first capitalised word of a prose-like literal that the German vocabulary knows. */
function vocabularyHit(text, vocabulary) {
  const words = wordsOf(text)
  return words?.find((word) => isCapitalized(word) && vocabulary.has(word)) ?? null
}

/** The words a regex literal looks for, with its syntax blanked out. */
function regexText(literal) {
  const body = literal.slice(1, literal.lastIndexOf('/'))
  return body.replace(/\\[a-zA-Z]/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[\\^$.|?*+()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()
}
const quoteKey = (key) => {
  const escaped = key.replace(/\\/g, '\\\\')
  return escaped.includes("'") ? `"${escaped.replace(/"/g, '\\"')}"` : `'${escaped}'`
}

// ---------------------------------------------------------------------------------------------
// Files

function walk(dir, out = []) {
  const full = path.join(ROOT, dir)
  if (!existsSync(full)) return out
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(child, out)
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(child)
  }
  return out
}

function loadProject() {
  const sources = new Map()
  const catalogs = new Map()
  for (const file of [...walk('src'), ...walk('server')]) {
    const text = readFileSync(path.join(ROOT, file), 'utf8')
    if (file.startsWith(`${CATALOG_DIR}/`)) catalogs.set(file, readFileSync(path.join(ROOT, file)))
    else sources.set(file, text)
  }
  const indexHtml = existsSync(path.join(ROOT, 'index.html')) ? readFileSync(path.join(ROOT, 'index.html'), 'utf8') : ''
  const baseline = existsSync(path.join(ROOT, BASELINE_FILE)) ? JSON.parse(readFileSync(path.join(ROOT, BASELINE_FILE), 'utf8')) : null
  return { sources, catalogs, indexHtml, baseline }
}

function resolveImport(fromFile, specifier, known) {
  if (!specifier.startsWith('.')) return null
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) if (known.has(candidate)) return candidate
  return base.endsWith('.ts') ? base : `${base}.ts`
}

const zoneOf = (file) => {
  if (file.startsWith(`${CATALOG_DIR}/`)) return 'catalog'
  if (file.startsWith('src/i18n/') || file === 'server/i18nMarker.ts') return 'i18n'
  if (file.startsWith('src/game/')) return 'game'
  if (file.startsWith('src/net/')) return 'net'
  if (file.startsWith('server/')) return 'server'
  return 'ui'
}
const isClientText = (text) => /^\s*\/\/\s*i18n:\s*client-text\b/m.test(text.split(/\r?\n/).slice(0, 20).join('\n'))

// ---------------------------------------------------------------------------------------------
// Per-file analysis

function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

function templateChunks(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) return [node.text]
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)]
}

function isStringish(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)
}

/**
 * Text nodes and text attributes of markup in a template or string (§5.2 rule 1). Each
 * hit carries its offset in the joined text so the report can name the right line.
 */
function markupHits(chunks) {
  // Comments are blanked, not removed, so offsets and line counts stay put.
  const whole = chunks.join('\u0000').replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
  if (!/<[a-zA-Z][\w-]*[\s>/]/.test(whole)) return null
  const hits = []
  const addSegments = (value, start, label, keep) => {
    let offset = start
    for (const segment of value.split('\u0000')) {
      const text = segment.replace(/&[#\w]+;/g, ' ').trim()
      if (letterCount(text) >= 2 && keep(text)) hits.push({ offset: offset + segment.search(/\S|$/), text: label(text), raw: text })
      offset += segment.length + 1
    }
  }
  for (const match of `>${whole}<`.matchAll(/>([^<>]*)</g)) {
    addSegments(match[1], match.index, (text) => `text node ${JSON.stringify(text.slice(0, 60))}`, () => true)
  }
  for (const match of whole.matchAll(MARKUP_TEXT_ATTRS)) {
    const prose = (text) => match[1] !== 'value' || /\s/.test(text) || /^\p{Lu}/u.test(text)
    addSegments(match[2], match.index + match[1].length + 2, (text) => `${match[1]}=${JSON.stringify(text.slice(0, 60))}`, prose)
  }
  return { whole, hits: hits.sort((a, b) => a.offset - b.offset) }
}

/** Line of an offset in the joined chunks, counted from the node of the chunk it falls in. */
function chunkLine(chunkNodes, chunks, offset, lineOfNode) {
  let start = 0
  for (let index = 0; index < chunks.length; index++) {
    const end = start + chunks[index].length
    if (offset <= end || index === chunks.length - 1) {
      const inside = chunks[index].slice(0, Math.max(0, offset - start))
      return lineOfNode(chunkNodes[index]) + (inside.match(/\n/g)?.length ?? 0)
    }
    start = end + 1
  }
  return lineOfNode(chunkNodes[0])
}

function analyzeFile(file, text, context) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const zone = zoneOf(file)
  const clientText = isClientText(text)
  const authoritative = (zone === 'game' && !clientText) || zone === 'net' || zone === 'server'
  const runtime = zone === 'i18n'
  // bare: counted E1–E3 hits; candidates/comparisons: literals judged later against the
  // German vocabulary of the whole project (checkProject).
  const result = { file, zone, clientText, imports: [], keys: [], errors: [], bare: [], candidates: [], comparisons: [] }
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const error = (code, node, message) => result.errors.push({ code, file, line: node ? lineOf(node) : 0, message })
  const ignoredLines = new Set()
  text.split(/\r?\n/).forEach((line, index) => { if (/\/\/\s*i18n-ignore\b/.test(line)) ignoredLines.add(index + 1) })
  const ignored = (node) => { const line = lineOf(node); return ignoredLines.has(line) || ignoredLines.has(line - 1) }

  // Imports: which local names are i18n markers here.
  const markers = new Map() // local -> imported
  // A2 also covers the indirect way in: UI modules re-export the locale-aware formatters
  // (src/ui/format.ts) and may call t(), so authoritative code imports none of them.
  const checkUiImport = (resolved, node, typeOnly) => {
    if (authoritative && !typeOnly && resolved?.startsWith('src/') && zoneOf(resolved) === 'ui') {
      error('I18N-A2', node, `authoritative code imports the UI module ${resolved}; its helpers may depend on the viewer's language`)
    }
  }
  const recordImport = (specifier, node, typeOnly, names, namespace) => {
    const resolved = resolveImport(file, specifier, context.known)
    result.imports.push({ specifier, resolved, typeOnly })
    checkUiImport(resolved, node, typeOnly)
    if (!resolved || !resolved.startsWith('src/i18n/') && resolved !== 'server/i18nMarker.ts') return
    if (authoritative && !typeOnly && !AUTHORITATIVE_I18N.has(resolved)) {
      error('I18N-A2', node, `authoritative code imports ${resolved}; it may only use the marker (src/i18n/marker or server/i18nMarker)`)
    }
    if (runtime || !MARKER_MODULES.has(resolved)) return
    if (namespace) error('I18N-A1', node, `namespace import of ${specifier}; import the markers by name`)
    for (const { imported, local, elementTypeOnly } of names) {
      if (elementTypeOnly) continue
      if ((MARKERS.has(imported) || TRANSLATING.has(imported)) && imported !== local) {
        error('I18N-A1', node, `marker ${imported} imported as ${local}; use the exact name`)
      }
      if (MARKERS.has(imported) || TRANSLATING.has(imported)) markers.set(local, imported)
      if (authoritative && TRANSLATING.has(imported)) error('I18N-A2', node, `${imported} is imported in authoritative code (${zone})`)
    }
  }
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      const names = []
      let namespace = false
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          names.push({ imported: (element.propertyName ?? element.name).text, local: element.name.text, elementTypeOnly: element.isTypeOnly })
        }
      } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) namespace = true
      const typeOnly = Boolean(clause?.isTypeOnly) || (names.length > 0 && names.every((name) => name.elementTypeOnly) && !clause?.name)
      recordImport(statement.moduleSpecifier.text, statement, typeOnly, names, namespace)
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const resolved = resolveImport(file, statement.moduleSpecifier.text, context.known)
      result.imports.push({ specifier: statement.moduleSpecifier.text, resolved, typeOnly: statement.isTypeOnly })
      checkUiImport(resolved, statement, statement.isTypeOnly)
    }
  }
  const isMarker = (node, ...names) => ts.isIdentifier(node) && markers.has(node.text) && names.includes(markers.get(node.text))
  const markerName = (node) => (ts.isIdentifier(node) ? markers.get(node.text) : undefined)

  const addKey = (node, key, marker, parsed) => {
    result.keys.push({ key, marker, file, line: lineOf(node) })
    for (const problem of keyProblems(key, marker, parsed)) error(problem.code, node, problem.message)
  }

  // Key extraction, A1/A4/A5/A6, D1/D2.
  const checkDePlaceholder = (span) => {
    const expression = span.expression
    const wrapper = ts.isCallExpression(expression) ? markerName(expression.expression) : undefined
    if (!wrapper || !(wrapper in WRAPPER_TYPES)) {
      error('I18N-D1', expression, `placeholder in de\`…\` is not exactly one wrapper call (num, eur, hhmm, verbatim, named, listOf, nested)`)
      return null
    }
    for (const argument of expression.arguments) checkForbidden(argument, wrapper)
    return WRAPPER_TYPES[wrapper]
  }
  const isDeValue = (node) => {
    const inner = ts.isParenthesizedExpression(node) ? node.expression : node
    if (ts.isCallExpression(inner)) return ['de', 'dc', 'plural'].includes(markerName(inner.expression))
    if (ts.isTaggedTemplateExpression(inner)) return markerName(inner.tag) === 'de'
    if (ts.isConditionalExpression(inner)) return isDeValue(inner.whenTrue) && isDeValue(inner.whenFalse)
    return false
  }
  /** A bare literal with letters, or an untagged template: text that bypasses `de`. */
  const isBareText = (node) => {
    const inner = ts.isParenthesizedExpression(node) ? node.expression : node
    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return letterCount(inner.text) > 0
    return ts.isTemplateExpression(inner)
  }
  const checkForbidden = (node, wrapper) => {
    const visit = (child) => {
      if (ts.isCallExpression(child) && ['de', 'dc', 'plural', 't', 'tc'].includes(markerName(child.expression))) return
      if (ts.isTaggedTemplateExpression(child) && ['de', 't'].includes(markerName(child.tag))) return
      const forbid = (what) => error('I18N-D2', child, `${what} inside a de placeholder (${wrapper}); build a complete variant instead`)
      if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) return forbid('string literal')
      if (ts.isTemplateExpression(child)) return forbid('untagged template')
      if (ts.isConditionalExpression(child)) {
        if (wrapper === 'nested' && isDeValue(child)) return
        return forbid('conditional')
      }
      if (ts.isBinaryExpression(child)) {
        const operator = child.operatorToken.kind
        if ([ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(operator)) return forbid('`??`, `||` or `&&`')
        if (operator === ts.SyntaxKind.PlusToken && [child.left, child.right].some((side) => isStringish(side))) return forbid('text concatenation')
      }
      if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)) {
        const method = child.expression.name.text
        if (['join', 'toLocaleString', 'toFixed'].includes(method)) return forbid(`.${method}()`)
        if (['padStart', 'slice'].includes(method) && ['num', 'eur', 'hhmm'].includes(wrapper)) return forbid(`.${method}() on a number`)
      }
      ts.forEachChild(child, visit)
    }
    visit(node)
  }
  const bindingNames = (name, out = []) => {
    if (ts.isIdentifier(name)) out.push(name)
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindingNames(element.name, out)
    }
    return out
  }

  const visit = (node) => {
    if (!runtime) {
      // A1: local bindings that shadow an imported marker.
      let declared = []
      if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
        if (!ts.isBindingElement(node)) declared = bindingNames(node.name)
      } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionExpression(node)) && node.name) declared = [node.name]
      for (const identifier of declared) {
        if (markers.has(identifier.text)) error('I18N-A1', identifier, `local binding "${identifier.text}" shadows the imported marker; rename it`)
      }
      // A1: a marker used as a value.
      if (ts.isIdentifier(node) && markers.has(node.text) && isValueUse(node)) {
        const parent = node.parent
        const called = (ts.isCallExpression(parent) && parent.expression === node) || (ts.isTaggedTemplateExpression(parent) && parent.tag === node)
        if (!called) error('I18N-A1', node, `marker ${node.text} passed as a value; call it with a literal instead`)
      }
    }
    if (ts.isCallExpression(node)) {
      const name = markerName(node.expression)
      if (!runtime && (name === 't' || name === 'de')) {
        const [argument] = node.arguments
        if (!argument || !(ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) || node.arguments.length !== 1) {
          error('I18N-A4', node, `${name}() takes exactly one string literal; use the tagged form for values`)
        } else addKey(node, argument.text, name, { literals: [argument.text], slots: [] })
      } else if (!runtime && (name === 'tc' || name === 'dc')) {
        const [contextArg, textArg] = node.arguments
        const literal = (argument) => argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        if (!literal(contextArg) || !literal(textArg) || node.arguments.length !== 2) {
          error('I18N-A4', node, `${name}() takes a literal context and a literal text`)
        } else {
          if (!/^[a-z][a-z-]*$/.test(contextArg.text)) error('I18N-B10', contextArg, `context "${contextArg.text}" must match ^[a-z][a-z-]*$`)
          addKey(node, `${textArg.text}|${contextArg.text}`, name, { literals: [textArg.text], slots: [] })
        }
      }
      const plain = calleeName(node.expression)
      if (!runtime && ['localize', 'localizeName'].includes(markerName(node.expression))) {
        const [argument] = node.arguments
        if (argument && isStringish(argument)) error('I18N-A5', argument, `${plain}() receives a literal; use t() for the UI's own text`)
      }
    }
    // A6: any mention of setLocale — a call, an aliased import, `state.setLocale(…)` through
    // a namespace, a re-export — outside the boot entry and the runtime itself.
    if (ts.isIdentifier(node) && node.text === 'setLocale' && file !== 'src/boot.ts' && !runtime) {
      error('I18N-A6', node, 'setLocale is used only in src/boot.ts and in tests (the locale is fixed per page load)')
    }
    if (ts.isTaggedTemplateExpression(node) && !runtime) {
      const tag = markerName(node.tag)
      if (tag === 't' || tag === 'de') {
        const template = node.template
        if (ts.isNoSubstitutionTemplateLiteral(template)) addKey(node, template.text, tag, { literals: [template.text], slots: [] })
        else {
          const literals = [template.head.text]
          const slots = []
          template.templateSpans.forEach((span, index) => {
            const type = tag === 'de' ? checkDePlaceholder(span) : null
            slots.push({ index, type })
            literals.push(span.literal.text)
          })
          const key = literals.map((literal, index) => (index ? `{${index - 1}${slots[index - 1].type ? `:${slots[index - 1].type}` : ''}}` : '') + literal).join('')
          addKey(node, key, tag, { literals, slots })
        }
      }
    }
    // D2: text built around de values.
    if (!runtime && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && [node.left, node.right].some(isDeValue)) {
      error('I18N-D2', node, 'concatenation around a de value; write one complete de template')
    }
    if (!runtime && ts.isTemplateExpression(node) && !(ts.isTaggedTemplateExpression(node.parent)) && node.templateSpans.some((span) => isDeValue(span.expression))) {
      error('I18N-D2', node, 'untagged template around a de value; write one complete de template')
    }
    if (!runtime && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join'
      && ts.isArrayLiteralExpression(node.expression.expression) && node.expression.expression.elements.some(isDeValue)) {
      error('I18N-D2', node, '.join() around de values; use listOf() inside one de template')
    }
    // D2: a de value with a bare literal as the other branch (`ok ? de('A') : 'B'`, `de('A') || 'B'`).
    if (!runtime && ts.isConditionalExpression(node) && [node.whenTrue, node.whenFalse].some(isDeValue) && [node.whenTrue, node.whenFalse].some(isBareText)) {
      error('I18N-D2', node, 'a de value and a bare literal as the two branches; make every branch a de value')
    }
    if (!runtime && ts.isBinaryExpression(node)
      && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)
      && [node.left, node.right].some(isDeValue) && [node.left, node.right].some(isBareText)) {
      error('I18N-D2', node, '`??`, `||` or `&&` between a de value and a bare literal; make both sides de values')
    }
    // E4: a regex literal that looks for German text is text used as logic.
    if (ts.isRegularExpressionLiteral(node) && !runtime && !exempt(node)) {
      const words = regexText(node.text)
      if (looksGerman(words) || context.catalogKeys.has(words)) {
        error('I18N-E4', node, `regex ${node.text.slice(0, 50)} matches German text; compare canonical constants (src/game/sentinels.ts)`)
      } else if (letterCount(words) >= 3) result.comparisons.push({ line: lineOf(node), text: words, kind: 'regex' })
    }
    // F2 and E rules on literals.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const chunks = templateChunks(node)
      for (const chunk of chunks) if (hasMojibake(chunk)) error('I18N-F2', node, `mojibake in ${JSON.stringify(chunk.slice(0, 50))}`)
      if (zone !== 'catalog' && !(ts.isTaggedTemplateExpression(node.parent) && node.parent.template === node)) classifyLiteral(node, chunks)
    }
    ts.forEachChild(node, visit)
  }

  const isValueUse = (node) => {
    const parent = node.parent
    if (!parent) return false
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent) || ts.isGetAccessor(parent) || ts.isSetAccessor(parent) || ts.isEnumMember(parent)) && parent.name === node) return false
    if (ts.isBindingElement(parent) && parent.propertyName === node) return false
    if (ts.isQualifiedName(parent) || ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent)) return false
    if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent) || ts.isBindingElement(parent)) && parent.name === node) return false
    if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false
    return true
  }

  // E1–E4 for one literal node.
  const exempt = (node) => {
    if (ignored(node)) return true
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current) || ts.isExternalModuleReference(current)) return true
      if (ts.isLiteralTypeNode(current) || ts.isTypeNode(current) && !ts.isExpressionWithTypeArguments(current)) return true
      if (ts.isCallExpression(current)) {
        if (current.expression.kind === ts.SyntaxKind.ImportKeyword) return true
        const callee = calleeName(current.expression)
        if (ts.isPropertyAccessExpression(current.expression) && ts.isIdentifier(current.expression.expression) && current.expression.expression.text === 'console') return true
        if (markerName(current.expression) === 'keep') return true
        if (['t', 'de', 'tc', 'dc'].includes(markerName(current.expression))) return true
        if (SELECTOR_CALLS.has(callee) && current.arguments.some((argument) => argument === node || argument.pos <= node.pos && node.end <= argument.end)) return true
      }
      if (ts.isTaggedTemplateExpression(current) && markerName(current.tag) === 'de') return true
    }
    const parent = node.parent
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return true
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true
    if (ts.isComputedPropertyName(parent)) return true
    return false
  }

  /** Climbs over `( … )`, `as T`, `!` and `satisfies T`, which do not change what a value is. */
  const unwrapUp = (node) => {
    let current = node
    while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent) || ts.isNonNullExpression(current.parent) || ts.isSatisfiesExpression(current.parent) || ts.isTypeAssertionExpression(current.parent))) current = current.parent
    return current
  }
  /** The method called on `node` (`node.name(…)`), if any. */
  const calledMethod = (node) => {
    const parent = node.parent
    return parent && ts.isPropertyAccessExpression(parent) && parent.expression === node && ts.isCallExpression(parent.parent) && parent.parent.expression === parent ? parent.name.text : null
  }
  /** E4 forms: `===`, `case`, `m.includes('…')`, `['…'].includes(m)`, `new Set(['…']).has(m)`. */
  const comparisonKind = (node) => {
    const target = unwrapUp(node)
    const parent = target.parent
    if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(parent.operatorToken.kind)) return 'comparison'
    if (ts.isCaseClause(parent) && parent.expression === target) return 'case'
    if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && COMPARE_CALLS.has(parent.expression.name.text) && parent.arguments[0] === target) return parent.expression.name.text
    if (ts.isArrayLiteralExpression(parent)) {
      const list = unwrapUp(parent)
      const method = calledMethod(list)
      if (method && LIST_QUERIES.has(method)) return `[…].${method}`
      const holder = list.parent
      if (holder && ts.isNewExpression(holder) && calleeName(holder.expression) === 'Set' && holder.arguments?.[0] === list && calledMethod(unwrapUp(holder)) === 'has') return 'new Set([…]).has'
    }
    return null
  }

  const flowTarget = (node) => {
    let current = node
    for (;;) {
      const parent = current.parent
      if (!parent) return current
      if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent)) { current = parent; continue }
      if (ts.isConditionalExpression(parent) && parent.condition !== current) { current = parent; continue }
      if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(parent.operatorToken.kind)) { current = parent; continue }
      if (ts.isTemplateSpan(parent) && ts.isTemplateExpression(parent.parent) && !ts.isTaggedTemplateExpression(parent.parent.parent)) { current = parent.parent; continue }
      return current
    }
  }

  const sinkOf = (node) => {
    const target = flowTarget(node)
    const parent = target.parent
    if (!parent) return null
    if (ts.isBinaryExpression(parent) && parent.right === target && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(parent.operatorToken.kind) && ts.isPropertyAccessExpression(parent.left)) {
      const property = parent.left.name.text
      if (SINK_PROPS.has(property)) return 'sink'
      if (TEXT_PROPS.has(property)) return 'prop'
      // `el.dataset.tip = '…'`: data attributes carry ids as often as text, so prose only.
      const owner = parent.left.expression
      if (ts.isPropertyAccessExpression(owner) && owner.name.text === 'dataset') return 'prop'
    }
    if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.arguments?.includes(target)) {
      const callee = calleeName(parent.expression)
      if (ts.isNewExpression(parent) && callee === 'Option') return 'sink'
      if (ts.isCallExpression(parent) && SINK_CALLS.has(callee)) return 'sink'
      if (callee === 'setAttribute' && parent.arguments[1] === target && ts.isStringLiteral(parent.arguments[0]) && SINK_ATTRS.has(parent.arguments[0].text)) return 'sink'
    }
    if (ts.isPropertyAssignment(parent) && parent.initializer === target) {
      const property = ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name) ? parent.name.text : ''
      if (TEXT_PROPS.has(property)) return 'prop'
    }
    return null
  }

  const inTranslatedSpan = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isTemplateSpan(current) && ts.isTemplateExpression(current.parent) && ts.isTaggedTemplateExpression(current.parent.parent)) {
        if (markerName(current.parent.parent.tag) === 't') return true
      }
      if (ts.isBlock(current) || ts.isSourceFile(current)) return false
    }
    return false
  }

  const classifyLiteral = (node, chunks) => {
    if (exempt(node)) return
    const joined = chunks.join('{}')
    const line = lineOf(node)
    const comparison = comparisonKind(node)
    if (comparison) {
      if (looksGerman(joined) || context.catalogKeys.has(joined)) error('I18N-E4', node, `German literal ${JSON.stringify(joined.slice(0, 50))} used in ${comparison}; compare canonical constants (src/game/sentinels.ts)`)
      // A lone capitalised word (`m === 'Geschlossen'`, `case 'Pause':`) is judged against
      // the project's German vocabulary once every file is read.
      else if (letterCount(joined) >= 2) result.comparisons.push({ line, text: joined, kind: comparison })
      return
    }
    const markup = markupHits(chunks)
    if (markup) {
      const chunkNodes = ts.isTemplateExpression(node) ? [node.head, ...node.templateSpans.map((span) => span.literal)] : [node]
      for (const hit of markup.hits) result.bare.push({ rule: 'E1', line: chunkLine(chunkNodes, chunks, hit.offset, lineOf), text: hit.text, raw: hit.raw })
      return
    }
    const letters = letterCount(joined)
    if (letters >= 2 && inTranslatedSpan(node)) {
      result.bare.push({ rule: 'E1', line, text: `literal inside t\`…\` ${JSON.stringify(joined.slice(0, 60))}`, raw: joined })
      return
    }
    const sink = letters >= 2 ? sinkOf(node) : null
    if (sink === 'sink' || (sink === 'prop' && (/\s/.test(joined.trim()) || /^\p{Lu}/u.test(joined) || /\P{ASCII}/u.test(joined.replace(/[^\p{L}]/gu, ''))))) {
      result.bare.push({ rule: 'E1', line, text: `${sink === 'sink' ? 'sink' : 'text property'} ${JSON.stringify(joined.slice(0, 60))}`, raw: joined })
      return
    }
    const german = looksGerman(joined)
    if (german) {
      result.bare.push({ rule: 'E2', line, text: `${german} ${JSON.stringify(joined.slice(0, 60))}`, raw: joined })
      return
    }
    if (context.catalogKeys.has(joined)) result.bare.push({ rule: 'E3', line, text: `catalog key ${JSON.stringify(joined.slice(0, 60))}`, raw: joined })
    else if (letters >= 2) result.candidates.push({ line, text: joined })
  }

  visit(sf)
  return result
}

/** B1–B9 for one extracted key (§3.2). */
function keyProblems(key, marker, parsedHint) {
  const problems = []
  const add = (code, message) => problems.push({ code, message: `${message}: ${JSON.stringify(key)}` })
  const isContext = marker === 'tc' || marker === 'dc'
  const text = isContext ? key.slice(0, key.lastIndexOf('|')) : key
  const parsed = marker === 'de' || marker === 't' ? parsedHint : { literals: [text], slots: [] }
  const literalText = parsed.literals.join('')
  if (text !== text.trim() || /[\u0000-\u001f\u007f]/.test(text) || /[\u00a0\u200b\u00ad\ufeff]/.test(text) || /  /.test(text)) add('I18N-B1', 'whitespace, control character or invisible space in key')
  if (LEADING_ICON.test(text) || EDGE_PUNCTUATION.has(text[0]) || EDGE_PUNCTUATION.has(text[text.length - 1])) add('I18N-B2', 'icon or separator at the edge of the key; keep it outside t()/de()')
  if (/[{}]/.test(literalText) || /[<>]/.test(text) || /&[#\w]+;/.test(text) || text.includes('|')) add('I18N-B3', 'brace, markup, entity or | in key')
  if (letterCount(literalText) === 0) add('I18N-B4', 'no letter outside placeholders')
  const middle = parsed.literals.slice(1, -1)
  const glued = parsed.slots.some((_, index) => /\p{L}$/u.test(parsed.literals[index]) || /^\p{L}/u.test(parsed.literals[index + 1]))
  if (middle.some((literal) => literal === '') || glued) add('I18N-B5', 'adjacent placeholders or placeholder glued to a letter')
  if (hasMojibake(text)) add('I18N-B6', 'mojibake in key')
  if (marker === 'de' || marker === 'dc') {
    if (parsed.slots.some((slot) => !slot.type) || letterCount(literalText) < 3) add('I18N-B7', 'de key needs typed placeholders and at least 3 literal letters')
    const free = parsed.slots.filter((slot) => FREE_TYPES.has(slot.type))
    if (free.length >= 2) {
      const adjacentFree = parsed.slots.some((slot, index) => index > 0 && FREE_TYPES.has(slot.type) && FREE_TYPES.has(parsed.slots[index - 1].type) && /^[\s\p{P}\p{S}]*$/u.test(parsed.literals[index]))
      if (letterCount(literalText) < 4 || adjacentFree) add('I18N-B8', 'two free placeholders need 4 literal letters and real words between them; join with joinParts/formatRange in UI code')
    }
    if (parsed.slots.length > 0 && !bucketOf(parsed)) add('I18N-B9', 'de key needs a literal prefix or suffix of at least 3 characters')
  }
  return problems
}

// ---------------------------------------------------------------------------------------------
// Catalog

function parseCatalogFile(file, bytes) {
  const errors = []
  const entries = []
  const error = (line, message) => errors.push({ code: 'I18N-C1', file, line, message })
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) error(1, 'catalog file has a BOM; save UTF-8 without BOM')
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  for (const statement of sf.statements) {
    const declaration = ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1 ? statement.declarationList.declarations[0] : null
    const exported = declaration && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    const constant = declaration && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
    const name = declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : null
    if (!exported || !constant || !(name === 'text' || name === 'names') || declaration.type?.getText(sf) !== 'Record<string, string>' || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
      error(lineOf(statement), 'only `export const text|names: Record<string, string> = { … }` is allowed')
      continue
    }
    const seen = new Set()
    for (const property of declaration.initializer.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name) || !ts.isStringLiteral(property.initializer)) {
        error(lineOf(property), 'entries are string-literal keys with string-literal values (no computed keys, spreads or templates)')
        continue
      }
      const key = property.name.text
      const value = property.initializer.text
      if (value === '') error(lineOf(property), `empty translation for ${JSON.stringify(key)}`)
      if (seen.has(key)) error(lineOf(property), `duplicate key ${JSON.stringify(key)}`)
      seen.add(key)
      entries.push({ file, exportName: name, key, value, line: lineOf(property) })
    }
  }
  return { errors, entries }
}

function placeholderIndexes(text, typed) {
  const found = [...text.matchAll(typed ? /\{(\d+)(?::[a-z]+)?\}/g : /\{(\d+)\}/g)].map((match) => Number(match[1]))
  return [...new Set(found)].sort((a, b) => a - b).join(',')
}
const countChars = (text, character) => text.split(character).length - 1

function checkCatalog(catalogFiles, extractedKeys, indexSource) {
  const errors = []
  const entries = []
  for (const [file, bytes] of catalogFiles) {
    if (file === `${CATALOG_DIR}/index.ts`) continue
    const parsed = parseCatalogFile(file, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8'))
    errors.push(...parsed.errors)
    entries.push(...parsed.entries)
    const area = path.posix.basename(file, '.ts')
    if (indexSource !== null && !new RegExp(`from '\\./${area}'`).test(indexSource)) {
      errors.push({ code: 'I18N-C1', file, line: 1, message: `area ${area} is not merged by ${CATALOG_DIR}/index.ts` })
    }
  }
  const byKey = new Map()
  for (const entry of entries) {
    const list = byKey.get(entry.key) ?? []
    list.push(entry)
    byKey.set(entry.key, list)
  }
  const extracted = new Set(extractedKeys.map((key) => key.key))
  const err = (code, entry, message) => errors.push({ code, file: entry.file, line: entry.line, message })
  for (const [key, list] of byKey) {
    const values = new Set(list.map((entry) => entry.value))
    if (values.size > 1) err('I18N-C4', list[1], `key ${JSON.stringify(key)} has different values across areas (${list.map((entry) => path.posix.basename(entry.file)).join(', ')}); use tc/dc or reword`)
    const legacy = list.every((entry) => entry.file.endsWith('/legacy.ts'))
    if (!extracted.has(key) && !legacy) {
      const persisted = list.some((entry) => entry.exportName === 'names')
      err('I18N-C2', list[0], `unused catalog entry ${JSON.stringify(key)}${persisted ? ' (looks persisted: move it to legacy.ts)' : ''}`)
    }
    for (const entry of list) {
      const { value } = entry
      if (/\{\d+:[a-z]+\}/.test(value)) err('I18N-C3', entry, `value has a typed placeholder: ${JSON.stringify(value)}`)
      else if (placeholderIndexes(key, true) !== placeholderIndexes(value, false) || /\{(?!\d+\})/.test(value.replace(/\{\d+\}/g, ''))) {
        err('I18N-C3', entry, `placeholders of ${JSON.stringify(value)} differ from key ${JSON.stringify(key)}`)
      }
      const text = key.includes('|') ? key.slice(0, key.lastIndexOf('|')) : key
      if (value === text && (GERMAN_CHARS.test(text) || STOP_WORDS.test(text))) err('I18N-C5', entry, `untranslated value for ${JSON.stringify(key)}`)
      if (value.includes('„') || /\d,\d{1,2}\b/.test(value) || hasMojibake(value)) err('I18N-C5', entry, `German quote, decimal comma or mojibake in value ${JSON.stringify(value)}`)
      for (const character of ['<', '>', '&', '"']) {
        if (countChars(text, character) !== countChars(value, character)) err('I18N-C7', entry, `${character} count differs between key and value ${JSON.stringify(value)}`)
      }
      const other = byKey.get(value)
      if (value !== key && other && other.some((candidate) => candidate.value !== value)) {
        err('I18N-C6', entry, `English value ${JSON.stringify(value)} is itself a German key with another translation; sinks would translate it twice`)
      }
      for (const problem of keyProblems(key, isTypedKey(key) ? 'de' : key.includes('|') ? 'tc' : 't', parseKey(key.includes('|') ? key.slice(0, key.lastIndexOf('|')) : key))) {
        if (['I18N-B1', 'I18N-B3', 'I18N-B6', 'I18N-B9'].includes(problem.code)) err(problem.code, entry, problem.message)
      }
    }
  }
  const seenMissing = new Set()
  for (const key of extractedKeys) {
    if (byKey.has(key.key) || seenMissing.has(key.key)) continue
    seenMissing.add(key.key)
    errors.push({ code: 'I18N-C2', file: key.file, line: key.line, message: `missing translation for ${JSON.stringify(key.key)} (run --missing ${key.file})` })
  }
  const patterns = [...byKey].filter(([key]) => isTypedKey(key)).map(([key, list]) => compilePattern(key, list[0].value)).filter(Boolean)
  const largest = largestBucket(buildPatternIndex(patterns))
  if (largest && largest.size > BUCKET_LIMIT) {
    errors.push({ code: 'I18N-C8', file: CATALOG_DIR, line: 0, message: `pattern bucket ${largest.kind}:${JSON.stringify(largest.text)} holds ${largest.size} keys (limit ${BUCKET_LIMIT}); reword keys to spread them` })
  }
  return { errors, entries, keys: new Set(byKey.keys()), typedCount: patterns.length, largest }
}

// ---------------------------------------------------------------------------------------------
// Project

function checkProject({ sources, catalogs, indexHtml, baseline }) {
  const known = new Set([...sources.keys(), ...catalogs.keys()])
  const catalogKeys = new Set()
  for (const [file, bytes] of catalogs) {
    if (file.endsWith('/index.ts')) continue
    for (const entry of parseCatalogFile(file, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')).entries) {
      if (!hasPlaceholder(entry.key)) catalogKeys.add(entry.key.includes('|') ? entry.key.slice(0, entry.key.lastIndexOf('|')) : entry.key)
    }
  }
  const context = { known, catalogKeys }
  const results = [...sources].map(([file, text]) => analyzeFile(file, text, context))
  const errors = results.flatMap((result) => result.errors)
  // F2 over catalog files too.
  for (const [file, bytes] of catalogs) {
    const text = (Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')).toString('utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (node) => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && hasMojibake(node.text)) {
        errors.push({ code: 'I18N-F2', file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, message: `mojibake in ${JSON.stringify(node.text.slice(0, 50))}` })
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  // A3: client-text modules are imported only by UI code, tests or other client-text modules.
  const byFile = new Map(results.map((result) => [result.file, result]))
  for (const result of results) {
    for (const { resolved, typeOnly } of result.imports) {
      const target = resolved && byFile.get(resolved)
      if (!target?.clientText || typeOnly) continue
      if (['game', 'net', 'server'].includes(result.zone) && !result.clientText) {
        errors.push({ code: 'I18N-A3', file: result.file, line: 0, message: `authoritative code imports the client-text module ${resolved}` })
      }
    }
  }
  const keys = results.flatMap((result) => result.keys)
  const catalog = checkCatalog(catalogs, keys, catalogs.has(`${CATALOG_DIR}/index.ts`) ? Buffer.from(catalogs.get(`${CATALOG_DIR}/index.ts`)).toString('utf8') : null)
  errors.push(...catalog.errors)
  if (indexHtml !== null) {
    for (const needle of INDEX_HTML_NEEDLES) {
      if (!indexHtml.includes(needle)) errors.push({ code: 'I18N-F1', file: 'index.html', line: 0, message: `index.html lacks ${JSON.stringify(needle)} (inline boot resolver, captions, boot entry)` })
    }
  }
  // Second pass: a literal built from words the project already writes in German texts
  // (`'Parkplatz'`, `return 'Geschlossen'`, `m === 'Geschlossen'`) is German too.
  const vocabulary = new Set()
  const learn = (text) => { for (const word of vocabularyWords(text.includes('|') ? text.slice(0, text.lastIndexOf('|')) : text)) vocabulary.add(word) }
  for (const result of results) for (const hit of result.bare) if (hit.raw) learn(hit.raw)
  for (const key of keys) learn(key.key)
  for (const key of catalog.keys) learn(key)
  for (const result of results) {
    for (const candidate of result.candidates) {
      const word = vocabularyHit(candidate.text, vocabulary)
      if (word) result.bare.push({ rule: 'E2', line: candidate.line, text: `German word ${JSON.stringify(word)} in ${JSON.stringify(candidate.text.slice(0, 60))}` })
    }
    // Only counted, not an E4 error: until the proper-noun tables are wrapped in keep(),
    // genres and band names sit in the vocabulary too (`genre === 'Electro'`).
    for (const comparison of result.comparisons) {
      const word = vocabularyHit(comparison.text, vocabulary)
      if (word) result.bare.push({ rule: 'E2', line: comparison.line, text: `German word ${JSON.stringify(word)} used in ${comparison.kind} ${JSON.stringify(comparison.text.slice(0, 50))}` })
    }
    result.bare.sort((a, b) => a.line - b.line)
  }
  const counts = {}
  for (const result of results) if (result.bare.length) counts[result.file] = result.bare.length
  // A null baseline skips the ratchet (--missing, --update-baseline). A missing baseline
  // file is not null: main() passes an empty one, so E is a plain error then.
  if (baseline) {
    for (const result of results) {
      const allowed = baseline.files?.[result.file] ?? 0
      if (result.bare.length > allowed) {
        const sample = result.bare.slice(0, 12).map((hit) => `    ${hit.rule} :${hit.line} ${hit.text}`).join('\n')
        errors.push({ code: 'I18N-E', file: result.file, line: 0, message: `${result.bare.length} bare texts, baseline allows ${allowed}; translate them (t/de/keep or // i18n-ignore)\n${sample}` })
      }
    }
  }
  return { results, errors, keys, catalog, counts }
}

// ---------------------------------------------------------------------------------------------
// Self-test

function selfTest() {
  const failures = []
  const expect = (condition, message) => { if (!condition) failures.push(message) }
  const header = "import { t, tc, de, dc, num, eur, hhmm, verbatim, named, listOf, nested, plural, keep, localize } from '../i18n'\n"
  const run = (source, { file = 'src/ui/fixture.ts', catalog = '', html = INDEX_HTML_NEEDLES.join(' '), extra = {}, baseline = { files: {} } } = {}) => {
    const sources = new Map([[file, source], ['src/i18n/index.ts', ''], ...Object.entries(extra)])
    const catalogs = new Map([[`${CATALOG_DIR}/core.ts`, Buffer.from(`export const text: Record<string, string> = {\n${catalog}}\n`)], [`${CATALOG_DIR}/index.ts`, Buffer.from("import * as core from './core'\n")]])
    return checkProject({ sources, catalogs, indexHtml: html, baseline })
  }
  const codes = (outcome) => new Set(outcome.errors.map((error) => error.code))

  // Key identity: extraction must equal the TemplateStringsArray V8 hands to the tag.
  const identity = [
    'a\\tb${x}c', 'ü${x}ö', 'es \\`geht\\` ${x}', 'Familie 👨‍👩‍👧 ${x}', 'erste\\\r\nzweite ${x}', 'Zeile\r\nzwei ${x}', '\\u00fcber ${x} \\${y}', 'ohne Wert',
  ]
  for (const body of identity) {
    const source = `${header}export const value = t\`${body}\`\n`
    const extracted = run(source).keys.find((key) => key.marker === 't')?.key
    const runtime = new Function('t', 'x', `return t\`${body}\``)((strings) => strings.map((part, index) => (index ? `{${index - 1}}` : '') + part).join(''), 1)
    expect(extracted === runtime, `key identity for ${JSON.stringify(body)}: ${JSON.stringify(extracted)} !== ${JSON.stringify(runtime)}`)
  }
  const typed = run(`${header}export const v = (n: number, s: string) => de\`Ich warte bei \${named(s)} (\${num(n)} Minuten, \${eur(n)}).\`\n`, { file: 'src/game/fixture.ts' })
  expect(typed.keys[0]?.key === 'Ich warte bei {0:name} ({1:n} Minuten, {2:m}).', `typed key: ${typed.keys[0]?.key}`)
  expect(run(`${header}export const v = tc('quality', 'Hoch')\n`).keys[0]?.key === 'Hoch|quality', 'context key')

  // One bad example per error code.
  const bad = {
    'I18N-A1': `${header}export const v = ['x'].map((t) => t)\n`,
    'I18N-A2': "import { t } from '../i18n'\nexport const v = t('Hallo Welt')\n",
    'I18N-A3': "import { x } from './clientThing'\nexport const v = x\n",
    'I18N-A4': `${header}const key = 'x'\nexport const v = t(key)\n`,
    'I18N-A5': `${header}export const v = localize('Hallo')\n`,
    'I18N-A6': "import { setLocale } from '../i18n'\nsetLocale('en')\n",
    'I18N-B1': `${header}export const v = t('Zwei  Leerzeichen')\n`,
    'I18N-B2': `${header}export const v = t('Kosten:')\n`,
    'I18N-B3': `${header}export const v = t('<b>fett</b>')\n`,
    'I18N-B4': `${header}export const v = (a: string, b: string) => t\`\${a} · \${b}\`\n`,
    'I18N-B5': `${header}export const v = (a: string) => t\`Feld\${a}\`\n`,
    'I18N-B6': `${header}export const v = t('Ben?tigt')\n`,
    'I18N-B7': `${header}export const v = (n: number) => de\`\${num(n)} ab\`\n`,
    'I18N-B8': `${header}export const v = (a: string, b: string) => de\`Von \${verbatim(a)}, \${verbatim(b)} weg\`\n`,
    'I18N-B9': `${header}export const v = (n: number, m: number) => de\`A \${num(n)} Kisten \${num(m)} b\`\n`,
    'I18N-B10': `${header}export const v = tc('Quality', 'Hoch')\n`,
    'I18N-C1': null,
    'I18N-C2': `${header}export const v = t('Nicht übersetzt')\n`,
    'I18N-C3': null,
    'I18N-C4': null,
    'I18N-C5': null,
    'I18N-C6': null,
    'I18N-C7': null,
    'I18N-C8': null,
    'I18N-D1': `${header}export const v = (n: number) => de\`Kosten von \${String(n)} Euro\`\n`,
    'I18N-D2': `${header}export const v = (n: number) => de\`Kosten von \${num(n > 1 ? n : 0)} Euro\`\n`,
    'I18N-E4': "export const v = (m: string) => m === 'Befehl eingeplant'\n",
    'I18N-F1': null,
    'I18N-F2': "export const v = 'Ben?tigtes Element'\n",
  }
  const zoneFor = { 'I18N-A2': 'src/game/fixture.ts', 'I18N-A3': 'src/game/fixture.ts', 'I18N-B7': 'src/game/fixture.ts', 'I18N-B8': 'src/game/fixture.ts', 'I18N-B9': 'src/game/fixture.ts', 'I18N-D1': 'src/game/fixture.ts', 'I18N-D2': 'src/game/fixture.ts' }
  const catalogCases = {
    'I18N-C1': "  'Hallo': ``,\n",
    'I18N-C3': "  'Tag {0}': 'Day {1}',\n",
    'I18N-C5': "  'Übersicht': 'Übersicht',\n",
    'I18N-C6': "  'Speichern': 'Laden',\n  'Laden': 'Load',\n",
    'I18N-C7': "  'Kosten': 'Costs & fees',\n",
  }
  for (const [code, source] of Object.entries(bad)) {
    let outcome
    if (code === 'I18N-A3') {
      outcome = run(source, { file: zoneFor[code], extra: { 'src/game/clientThing.ts': '// i18n: client-text\nexport const x = 1\n' } })
    } else if (code === 'I18N-C4') {
      const sources = new Map([['src/ui/fixture.ts', `${header}export const v = t('Hoch')\n`], ['src/i18n/index.ts', '']])
      const catalogs = new Map([
        [`${CATALOG_DIR}/a.ts`, Buffer.from("export const text: Record<string, string> = {\n  'Hoch': 'High',\n}\n")],
        [`${CATALOG_DIR}/b.ts`, Buffer.from("export const text: Record<string, string> = {\n  'Hoch': 'Up',\n}\n")],
        [`${CATALOG_DIR}/index.ts`, Buffer.from("import * as a from './a'\nimport * as b from './b'\n")],
      ])
      outcome = checkProject({ sources, catalogs, indexHtml: INDEX_HTML_NEEDLES.join(' '), baseline: null })
    } else if (code === 'I18N-C8') {
      const lines = Array.from({ length: BUCKET_LIMIT + 1 }, (_, index) => `  'Lieferung ${String.fromCharCode(97 + (index % 26))}${index} {0:n}': 'Delivery {0}',\n`).join('')
      outcome = run(`${header}export const v = 1\n`, { catalog: lines })
    } else if (code === 'I18N-F1') {
      outcome = run(`${header}export const v = 1\n`, { html: '<html></html>' })
    } else if (catalogCases[code]) {
      const used = [...catalogCases[code].matchAll(/^ {2}'([^']+)'/gm)].map((match) => match[1])
      outcome = run(`${header}${used.map((key, index) => `export const v${index} = ${key.includes('{0}') ? `(a: string) => t\`${key.replace('{0}', '${a}')}\`` : `t('${key}')`}\n`).join('')}`, { catalog: catalogCases[code] })
    } else {
      outcome = run(source, { file: zoneFor[code] ?? 'src/ui/fixture.ts' })
    }
    expect(codes(outcome).has(code), `${code}: expected the bad example to be reported (got ${[...codes(outcome)].join(', ') || 'nothing'})`)
  }
  // E1–E3 detection and the ratchet.
  const bare = run(`${header}declare const el: HTMLElement\nel.textContent = 'Fertig'\nexport const html = \`<button title="Schließen">Neu laden</button>\`\nexport const x = { label: 'Aus' }\nexport const y = 'Nicht mehr da'\nexport const z = 'Kosten'\n`, { catalog: "  'Kosten': 'Costs',\n" })
  const rules = bare.results.find((result) => result.file === 'src/ui/fixture.ts').bare.map((hit) => hit.rule)
  expect(rules.filter((rule) => rule === 'E1').length === 4, `E1 hits: ${rules.join(',')}`)
  expect(rules.includes('E2') && rules.includes('E3'), `E2/E3 hits: ${rules.join(',')}`)
  expect(codes(bare).has('I18N-E'), 'ratchet: a file above its baseline fails')
  const exempt = run(`${header}export const a = keep('Rock am Ring')\nconsole.log('Nicht gefunden')\n// i18n-ignore\nexport const b = 'Nicht übersetzt'\nexport const c = document.querySelector('.Nicht mehr')\n`)
  expect(exempt.results.find((result) => result.file === 'src/ui/fixture.ts').bare.length === 0, 'keep, console, i18n-ignore and selectors are exempt')

  // Prose with punctuation, placeholders or a lowercase start; single words the project
  // already writes in German texts; comparisons against such words (counted, not E4).
  const bareOf = (outcome, file = 'src/ui/fixture.ts') => outcome.results.find((result) => result.file === file).bare
  const prose = run(`${header}export const a = 'Unwetter: Auftritte unterbrochen'\nexport const b = 'Wilde Maus (Stahl)'\nexport const c = 'Bau & Anschaffung'\nexport const d = (n: number) => \`\${n} Personen brauchen Hilfe.\`\nexport const e = (n: number) => \` in \${n} Ausgaben hintereinander\`\n`)
  expect(bareOf(prose).filter((hit) => hit.rule === 'E2').length === 5, `prose shapes: ${bareOf(prose).map((hit) => hit.text).join(' | ')}`)
  const vocabulary = run(`${header}export const a = { label: 'Geschlossen' }\nexport const hint = 'Mit Enter bestätigen'\nexport function b() { return 'Geschlossen' }\nexport const c = (m: string) => m === 'Geschlossen'\nexport const d = (key: string) => key === 'Enter' || ['Enter', 'Escape'].includes(key)\n`)
  const vocabularyTexts = bareOf(vocabulary).map((hit) => hit.text)
  expect(vocabularyTexts.some((text) => text.startsWith('German word "Geschlossen" in')), `a lone vocabulary word counts: ${vocabularyTexts.join(' | ')}`)
  expect(vocabularyTexts.some((text) => text.startsWith('German word "Geschlossen" used in comparison')), `a comparison with a vocabulary word counts: ${vocabularyTexts.join(' | ')}`)
  expect(!vocabularyTexts.some((text) => /German word "(Enter|Escape)"/.test(text)) && !codes(vocabulary).has('I18N-E4'),`key names are not German text: ${vocabularyTexts.join(' | ')}`)
  const technical = run(`${header}export const a = 'translate(-50%, -50%)'\nexport const b = 'bold 12px Tahoma'\nexport const c = 'courseStart'\nexport const d = 'Content-Type'\nexport const e = 'M 0 0 L 10 10'\n`)
  expect(bareOf(technical).length === 0, `identifiers, CSS and paths are not prose: ${bareOf(technical).map((hit) => hit.text).join(' | ')}`)
  // Every E4 form: parentheses, literal lists and Sets, indexOf, regex literals.
  const forms = [
    "(m: string) => m === ('Befehl eingeplant')",
    "(m: string) => ['Befehl eingeplant'].includes(m)",
    "(m: string) => new Set(['Befehl eingeplant', 'Nicht erlaubt']).has(m)",
    "(m: string) => m.indexOf('nicht erlaubt') >= 0",
    '(m: string) => /nicht erlaubt/.test(m)',
    "(m: string) => (m as string) !== 'Befehl eingeplant'",
  ]
  for (const form of forms) expect(codes(run(`export const v = ${form}\n`, { file: 'src/game/fixture.ts' })).has('I18N-E4'), `E4 for ${form}`)
  // A2 through UI modules, A6 through aliases and namespaces, D2 with ternaries and ||.
  expect(codes(run("import { formatMoney } from '../ui/format'\nexport const v = formatMoney(1)\n", { file: 'src/game/fixture.ts', extra: { 'src/ui/format.ts': '' } })).has('I18N-A2'), 'A2: authoritative code imports a UI module')
  expect(codes(run("export { formatMoney } from '../ui/format'\n", { file: 'src/net/fixture.ts', extra: { 'src/ui/format.ts': '' } })).has('I18N-A2'), 'A2: authoritative code re-exports a UI module')
  expect(codes(run("import { setLocale as choose } from '../i18n'\nchoose('en')\n")).has('I18N-A6'), 'A6: aliased setLocale')
  expect(codes(run("import * as state from '../i18n/state'\nstate.setLocale('en')\n", { extra: { 'src/i18n/state.ts': '' } })).has('I18N-A6'), 'A6: setLocale through a namespace')
  expect(codes(run(`${header}export const v = (ok: boolean) => ok ? de('Alles gut') : 'Nicht gut'\n`, { file: 'src/game/fixture.ts' })).has('I18N-D2'), 'D2: ternary with a bare branch')
  expect(codes(run(`${header}export const v = de('Alles gut') || 'Fallback'\n`, { file: 'src/game/fixture.ts' })).has('I18N-D2'), 'D2: || with a bare literal')
  expect(!codes(run(`${header}export const v = (ok: boolean) => ok ? de('Alles gut') : ''\n`, { file: 'src/game/fixture.ts' })).has('I18N-D2'), 'D2: an empty alternative is not text')
  // Without a baseline file every file is held to 0 (deleting it ends the migration).
  const strict = run(`${header}export const v = 'Nicht mehr da'\n`, { baseline: effectiveBaseline(null) })
  expect(codes(strict).has('I18N-E'), 'no baseline file: bare text is an error')

  if (failures.length) {
    console.error(`i18n self-test failed (${failures.length}):`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
  } else console.log(`PASS i18n self-test (${identity.length} identity fixtures, ${Object.keys(bad).length} error codes)`)
}

// ---------------------------------------------------------------------------------------------
// CLI

function printErrors(errors) {
  const sorted = [...errors].sort((a, b) => a.code.localeCompare(b.code) || a.file.localeCompare(b.file) || a.line - b.line)
  for (const error of sorted) console.error(`${error.code} ${error.file}${error.line ? `:${error.line}` : ''}: ${error.message}`)
}

/** The ratchet the full check applies: a missing baseline file holds every file to 0. */
function effectiveBaseline(loaded) {
  return loaded ?? { files: {} }
}

function sumCounts(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return selfTest()
  const project = loadProject()
  if (args.includes('--missing')) {
    const paths = args.slice(args.indexOf('--missing') + 1).filter((arg) => !arg.startsWith('--')).map((arg) => rel(path.resolve(process.cwd(), arg)))
    const inScope = (file) => paths.some((target) => file === target || file.startsWith(`${target.replace(/\/$/, '')}/`))
    const outcome = checkProject({ ...project, baseline: null })
    const seen = new Set()
    for (const key of outcome.keys) {
      if (!inScope(key.file) || outcome.catalog.keys.has(key.key) || seen.has(key.key)) continue
      seen.add(key.key)
      console.log(`  ${quoteKey(key.key)}: '',`)
    }
    if (!seen.size) console.error('No missing keys in those paths.')
    return
  }
  if (args.includes('--update-baseline')) {
    // Deleting the baseline ends the migration: E1–E3 are plain errors from then on, and
    // there is nothing left to regenerate.
    const previous = project.baseline?.files
    if (!previous) {
      console.error(`No ${BASELINE_FILE}: bare text (I18N-E1–E3) is a plain error now, so there is no baseline to update.`)
      process.exitCode = 1
      return
    }
    const outcome = checkProject({ ...project, baseline: null })
    const raised = Object.entries(outcome.counts).filter(([file, count]) => count > (previous[file] ?? 0))
    if (raised.length) {
      console.error('Refusing to raise the baseline:')
      raised.forEach(([file, count]) => console.error(`- ${file}: ${previous[file] ?? 0} → ${count}`))
      process.exitCode = 1
      return
    }
    const files = Object.fromEntries(Object.entries(outcome.counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(path.join(ROOT, BASELINE_FILE), `${JSON.stringify({ note: 'Bare-text ratchet (I18N-E1–E3) per file; may only go down. Regenerate with node scripts/check-i18n.mjs --update-baseline.', total: sumCounts(files), files }, null, 2)}\n`)
    console.log(`Baseline written: ${Object.keys(files).length} files, ${sumCounts(files)} bare texts`)
    return
  }
  // Without a baseline file every file is held to 0 bare texts (the end state of C10).
  const outcome = checkProject({ ...project, baseline: effectiveBaseline(project.baseline) })
  if (args.includes('--stats')) {
    const perRule = {}
    for (const error of outcome.errors) perRule[error.code] = (perRule[error.code] ?? 0) + 1
    for (const result of outcome.results) for (const hit of result.bare) perRule[hit.rule] = (perRule[hit.rule] ?? 0) + 1
    console.log('Per rule:')
    for (const [code, count] of Object.entries(perRule).sort()) console.log(`  ${code.padEnd(10)} ${count}`)
    console.log('Bare texts per file:')
    for (const [file, count] of Object.entries(outcome.counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(5)}  ${file}`)
    // `--stats <path>…` also lists every bare text of those files.
    const paths = args.filter((arg) => !arg.startsWith('--')).map((arg) => rel(path.resolve(process.cwd(), arg)))
    for (const result of outcome.results) {
      if (!paths.some((target) => result.file === target || result.file.startsWith(`${target.replace(/\/$/, '')}/`))) continue
      for (const hit of result.bare) console.log(`${hit.rule} ${result.file}:${hit.line} ${hit.text}`)
    }
    console.log(`Keys: ${new Set(outcome.keys.map((key) => key.key)).size} extracted, ${outcome.catalog.keys.size} in the catalog, ${outcome.catalog.typedCount} patterns, largest bucket ${outcome.catalog.largest?.size ?? 0}`)
  }
  if (outcome.errors.length) {
    printErrors(outcome.errors)
    console.error(`i18n check failed: ${outcome.errors.length} problem(s)`)
    process.exitCode = 1
    return
  }
  const current = sumCounts(outcome.counts)
  let ratchet = 'no baseline: bare text is an error'
  if (project.baseline) {
    const baselineTotal = sumCounts(project.baseline.files ?? {})
    ratchet = `baseline ${baselineTotal}${current < baselineTotal ? ' — lower it with --update-baseline' : ''}`
  }
  console.log(`PASS i18n: ${new Set(outcome.keys.map((key) => key.key)).size} keys, ${outcome.catalog.keys.size} catalog entries, ${current} bare texts (${ratchet})`)
}

main()
