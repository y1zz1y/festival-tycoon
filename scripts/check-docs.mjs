import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const docNames = (await readdir(docsDir)).filter(name => name.endsWith('.md')).sort()
const docs = new Map(await Promise.all(docNames.map(async name => [
  name,
  await readFile(path.join(docsDir, name), 'utf8'),
])))
const allDocs = [...docs.values()].join('\n')
const failures = []

async function exists(repoPath) {
  try {
    await access(path.join(root, ...repoPath.split('/')))
    return true
  } catch {
    return false
  }
}

// Only validate rooted, literal repository paths. Globs, URL fragments, generated
// files and bare filenames are intentionally outside this check.
const rootedPath = /^(?:AGENTS\.md|README\.md|package(?:-lock)?\.json|(?:docs|scripts|server|src|tests)\/[A-Za-z0-9_./-]+)$/
for (const [docName, text] of docs) {
  for (const match of text.matchAll(/`([^`\r\n]+)`/g)) {
    const repoPath = match[1].replace(/[.,;:]$/, '')
    if (!rootedPath.test(repoPath) || /[*?[\]{}]/.test(repoPath)) continue
    if (!await exists(repoPath)) failures.push(`${docName}: missing backtick path ${repoPath}`)
  }
}

const regression = await readFile(path.join(root, 'tests', 'regression.ts'), 'utf8')
const importedTestModules = new Set()
for (const match of regression.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) {
  const moduleName = match[1]
  if (await exists(`tests/${moduleName}.ts`)) importedTestModules.add(moduleName)
}
const testingDoc = docs.get('testing.md')
assert.ok(testingDoc)
for (const moduleName of [...importedTestModules].sort()) {
  if (!testingDoc.includes(`\`tests/${moduleName}.ts\``)) {
    failures.push(`testing.md: tests/${moduleName}.ts is imported by tests/regression.ts but not documented`)
  }
}

const versionSources = [
  ['types/snapshot.ts', /version:\s*(\d+)/],
  ['snapshotBootstrap.ts', /version:\s*(\d+)/],
  ['snapshotMigration.ts', /version:\s*(\d+)/],
]
const snapshotVersions = []
for (const [file, pattern] of versionSources) {
  const source = await readFile(path.join(root, 'src', 'game', file), 'utf8')
  const value = source.match(pattern)?.[1]
  if (!value) failures.push(`src/game/${file}: snapshot version not found`)
  else snapshotVersions.push([file, Number(value)])
}
const canonicalVersion = snapshotVersions[0]?.[1]
for (const [file, version] of snapshotVersions) {
  if (version !== canonicalVersion) failures.push(`src/game/${file}: snapshot version ${version} != ${canonicalVersion}`)
}
const documentedVersion = docs.get('saves.md')?.match(/Aktuelle Snapshot-Version:\s*\*\*(\d+)\*\*/)?.[1]
if (!documentedVersion) failures.push('saves.md: missing "Aktuelle Snapshot-Version: **N**"')
else if (Number(documentedVersion) !== canonicalVersion) {
  failures.push(`saves.md: snapshot version ${documentedVersion} != ${canonicalVersion}`)
}

const primaryTopicByModule = {
  'src/game/browserPersistence.ts': 'saves.md',
  'src/game/logisticsSimulation.ts': 'logistics.md',
  'src/game/pedestrianNavigation.ts': 'pathfinding.md',
  'src/game/snapshotBootstrap.ts': 'architecture.md',
  'src/game/snapshotMigration.ts': 'architecture.md',
  'src/game/snapshotRepair.ts': 'architecture.md',
  'src/game/coasterSimulation.ts': 'coaster.md',
  'src/game/placementService.ts': 'buildings.md',
  'src/game/visitorCrowdingSimulation.ts': 'visitors.md',
  'src/game/visitorSpawning.ts': 'visitors.md',
  'src/game/visitorSimulation.ts': 'visitors.md',
}
for (const [modulePath, topic] of Object.entries(primaryTopicByModule)) {
  if (!await exists(modulePath)) failures.push(`critical module missing: ${modulePath}`)
  else if (!docs.get(topic)?.includes(`\`${modulePath}\``)) {
    failures.push(`${topic}: missing primary mapping for ${modulePath}`)
  }
}

if (failures.length) {
  console.error(`Documentation consistency failed (${failures.length}):`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`PASS documentation consistency (${docNames.length} docs, ${importedTestModules.size} regression modules)`)
}
