import { SCENARIO_PRESETS, setExtraScenarioPresets, type ScenarioPreset } from './scenarioPresets'
import { parseScenarioFile, scenarioFileToPreset, type ScenarioFile } from './scenarioFile'

let filePresets: ScenarioPreset[] = []
let fileScenarios: ScenarioFile[] = []

export function listedScenarioPresets(): ScenarioPreset[] {
  const seen = new Set(SCENARIO_PRESETS.map((entry) => entry.id))
  return [...SCENARIO_PRESETS, ...filePresets.filter((entry) => !seen.has(entry.id))]
}

export function listedScenarioFiles(): ScenarioFile[] {
  return [...fileScenarios]
}

export function scenarioCatalogEntry(id: string | undefined): ScenarioPreset | undefined {
  return id ? listedScenarioPresets().find((entry) => entry.id === id) : undefined
}

export function scenarioFileEntry(id: string | undefined): ScenarioFile | undefined {
  return id ? fileScenarios.find((entry) => entry.id === id) : undefined
}

export function registerFileScenarios(files: ScenarioFile[]): void {
  fileScenarios = files
  filePresets = files.map(scenarioFileToPreset)
  setExtraScenarioPresets(filePresets)
}

export function mergeScenarioCatalog(rawFiles: unknown[]): ScenarioFile[] {
  const files: ScenarioFile[] = []
  const seen = new Set<string>()
  for (const raw of rawFiles) {
    const file = parseScenarioFile(raw)
    if (!file || seen.has(file.id)) continue
    seen.add(file.id)
    files.push(file)
  }
  registerFileScenarios(files)
  return files
}

export function scenarioListRows(presets: ScenarioPreset[]): Array<{
  id: string
  name: string
  detail: string
  size: string
}> {
  return presets.map((entry) => ({
    id: entry.id,
    name: entry.name,
    detail: entry.detail,
    size: `${entry.settings.worldSize} × ${entry.settings.worldSize}`,
  }))
}

export async function fetchFileScenarios(): Promise<unknown[]> {
  try {
    const response = await fetch('/api/scenarios', { credentials: 'same-origin' })
    if (!response.ok) return []
    const payload = (await response.json()) as { scenarios?: unknown }
    return Array.isArray(payload.scenarios) ? payload.scenarios : []
  } catch {
    return []
  }
}
