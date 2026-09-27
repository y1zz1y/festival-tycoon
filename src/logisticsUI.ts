import { WAY_TYPES } from './game/wayTypes'
import type { WayType } from './game/wayTypes'
import { groundRectangle } from './game/ground'
import type { GameState, GameSnapshot } from './game/GameState'
import type { WorldView } from './view/WorldView'
import { GROUND_COVERS, GROUND_WORK, groundInfo, roadGroundLimit, prepareGroundArea } from './game/ground'
import type { GroundWork } from './game/ground'
import { SUPPLIES } from './game/festivalManagement'
import type { FestivalAction } from './game/festivalManagement'
import { createAreaDesignationHandler } from './ui/areaDesignation'
import { COMMAND_QUEUED } from './game/sentinels'
import { formatMoney, formatNumber, joinParts, localize, plural, t, tc } from './i18n'
import './logistics.css'

type WayInfo = (typeof WAY_TYPES)[WayType]
const idleHint = () => t('Oben ein Werkzeug wählen und auf dem Gelände ein Rechteck aufziehen.')
const perTile = (cost: number) => t`${formatMoney(cost)}/Feld`
const wayLabel = (way: WayInfo) => joinParts(localize(way.name), perTile(way.cost))
const tileCount = (count: number) => plural(count, t`${count} Feld`, t`${count} Felder`)
/** A stall's stock in the inspect card: `Essen 12 · Getränke 30`. */
const stockLine = (stock: Partial<Record<string, number>>) =>
  joinParts(...Object.entries(stock).map(([kind, amount]) => `${localize(SUPPLIES[kind as keyof typeof SUPPLIES].name)} ${formatNumber(Math.floor(amount ?? 0))}`))

export function mountLogisticsUI(getGame: () => GameState, view: WorldView, toast: (text: string, error?: boolean) => void) {
  let footType: WayType = 'footDirt', roadType: WayType = 'roadDirt'
  let editorRoad = false
  let groundOpen = false, overlayOn = false, mode = 'none'

  // The ground works stand in the Gelände tab of the build menu, not behind a button
  // of their own: opening the tab is what puts the site into planning.
  const groundPanel = document.createElement('section'); groundPanel.className = 'terrain-planner'
  groundPanel.setAttribute('aria-label', t('Gelände planen'))
  groundPanel.innerHTML = `<p class="terrain-planner-intro">${t('Solange dieser Reiter offen ist, sind die Besucher ausgeblendet und ihr bereitet den Untergrund vor. Die Untergrundfarben (Rasen, Sand, Stein, Acker, Schnee, Felsen, braune Erde, Salzpfanne, Asphalt) stehen in der Palette darüber; Entwässern, Verdichten, Schotter und Pflaster bleiben hier.')}</p>
    <nav class="supply-tools"><button data-tool="inspect" aria-pressed="false">${t('Feld prüfen')}</button>${Object.entries(GROUND_WORK).map(([key, work]) => `<button data-tool="${key}">${joinParts(localize(work.name), formatMoney(work.cost))}</button>`).join('')}</nav>
    <p data-hint aria-live="polite">${idleHint()}</p><div data-cell class="supply-card">${t('Boden erkennen: Furchen = Acker · rötliche Flecken = Lehm · Körnung = Kies · Grasbüschel = Wiese · Rippeln = Sand · Fugen = Pflaster.')}<br>${t('Verdichteter Boden ist geglättet. Türkise Markierung: entwässert. Über ein Feld fahren für Tragfähigkeit und Ausbau.')}</div>`
  const groundSlot = document.querySelector<HTMLElement>('#terrain-planner-slot')!
  groundSlot.append(groundPanel)

  const qG = <T extends Element = HTMLElement>(selector: string) => groundPanel.querySelector<T>(selector)!
  const execute = (action: FestivalAction) => { const result = getGame().manageFestival(action); if (result.message !== COMMAND_QUEUED) toast(result.message, !result.ok); return result }
  /** The active tool's name for the hint: the chosen surface, or the ground work's button. */
  const toolLabel = () => {
    if (mode === 'path') return localize(WAY_TYPES[footType].name)
    if (mode === 'road') return localize(WAY_TYPES[roadType].name)
    return groundPanel.querySelector(`[data-tool="${mode}"]`)?.textContent ?? ''
  }
  const choose = (next: string) => {
    mode = next
    view.setGroundAreaTool(next === 'path' || next === 'road' ? createAreaDesignationHandler({
      preview: ({ from, to }) => {
        const kind = next === 'path' ? footType : roadType
        const count = groundRectangle(getGame().snapshot, from, to).length
        qG('[data-hint]').textContent = joinParts(tileCount(count), t`bis zu ${formatMoney(count * WAY_TYPES[kind].cost)} zzgl. Rodung. Loslassen zum Bauen / Ersetzen.`)
        document.querySelectorAll('[data-way-estimate]').forEach(el => el.textContent = qG('[data-hint]').textContent)
      },
      execute: ({ from, to }) => {
        execute({ type: 'wayArea', from, to, kind: next === 'path' ? footType : roadType })
        document.querySelectorAll('[data-way-estimate]').forEach(el => el.textContent = qG('[data-hint]').textContent)
      },
    }) : groundOpen && next in GROUND_WORK ? createAreaDesignationHandler({
      preview: ({ from, to }) => {
        const estimate = prepareGroundArea(getGame().snapshot as GameSnapshot, from, to, next as GroundWork, true)
        qG('[data-hint]').textContent = t`Loslassen zum Anwenden: ${localize(estimate.message)}`
      },
      execute: ({ from, to }) => {
        const result = execute({ type: 'groundArea', from, to, kind: next as GroundWork })
        qG('[data-hint]').textContent = localize(result.message)
      },
    }) : null)
    getGame().setTool(next === 'path' ? 'path' : next === 'road' ? 'road' : next === 'wasteDump' ? 'wasteDump' : 'inspect')
    groundPanel.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.tool === mode)))
    qG('[data-hint]').textContent = mode === 'inspect' ? t('Feld anklicken: Tragfähigkeit, Nässe und Bestand.') : t`${toolLabel()}: Feld anklicken oder mit gedrückter linker Maustaste eine Fläche ziehen.`
  }
  const releaseTool = () => {
    view.setGroundAreaTool(null); mode = 'none'
    groundPanel.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', 'false'))
    qG('[data-hint]').textContent = idleHint()
  }
  document.querySelector('.build-menu')!.addEventListener('click', event => {
    if ((event.target as Element).closest('[data-tool]')) releaseTool()
  }, true)
  const syncPlanningMode = () => {
    document.body.classList.toggle('logistics-planning', groundOpen)
    view.setLogisticsMode(overlayOn || groundOpen)
  }
  const toggleGround = (enabled: boolean) => {
    if (groundOpen === enabled) return
    groundOpen = enabled
    if (!enabled) releaseTool()
    syncPlanningMode()
  }
  // Planning follows the tab: the build menu shows and hides the tab's pane, and the
  // ground works are live exactly while it is on screen.
  const groundPane = groundSlot.closest<HTMLElement>('.build-extra') ?? groundSlot
  const followPane = () => toggleGround(!groundPane.hidden && !groundPane.closest<HTMLElement>('.build-menu')?.hidden)
  new MutationObserver(followPane).observe(groundPane, { attributes: true, attributeFilter: ['hidden'] })
  const buildMenu = groundPane.closest<HTMLElement>('.build-menu')
  if (buildMenu) new MutationObserver(followPane).observe(buildMenu, { attributes: true, attributeFilter: ['hidden'] })
  const setOverlay = (enabled: boolean) => {
    overlayOn = enabled
    syncPlanningMode()
  }
  const makePicker = (kind: 'foot' | 'road', compact = false) => {
    const root = document.createElement('section'); root.className = `way-picker integrated-way-picker${compact ? ' compact' : ''}`
    root.innerHTML = `<div class="way-icon-palette" role="group" aria-label="${kind === 'foot' ? t('Wegbelag wählen') : t('Straßenbelag wählen')}">${Object.entries(WAY_TYPES).filter(([, way]) => way.mode === kind).map(([id, way]) => `<button type="button" class="way-icon" data-way-icon="${id}" data-way-kind="${kind}" aria-label="${localize(way.name)}" aria-pressed="false" title="${wayLabel(way)}. ${localize(way.detail)}"><span class="way-swatch" data-surface="${id}" aria-hidden="true"></span></button>`).join('')}</div><p data-way-detail="${kind}" class="way-selection-label"></p><p data-way-estimate aria-live="polite"></p>`
    return root
  }
  const editorPicker = makePicker('foot', true), roadPicker = makePicker('road')
  document.querySelector('#path-surface-picker')!.append(editorPicker)
  document.querySelector('#path-surface-picker')!.append(roadPicker)
  roadPicker.hidden = true
  const pickers = [editorPicker, roadPicker]
  const surfacePreview = document.querySelector<HTMLButtonElement>('#path-surface-preview')
  const surfacePopup = document.querySelector<HTMLElement>('#path-surface-popup')
  const SURFACE_HOLD_MS = 280
  const refreshTypes = () => {
    for (const [tool, id] of [['path', footType], ['road', roadType]] as const) {
      const label = document.querySelector(`.build-menu [data-tool="${tool}"] em`)
      if (label) label.innerHTML = `${localize(WAY_TYPES[id].name)}<small>${perTile(WAY_TYPES[id].cost)}</small>`
    }
    const selectedType = editorRoad ? roadType : footType
    const foot = WAY_TYPES[selectedType]
    const previewSwatch = document.querySelector('#path-surface-preview .way-swatch')
    const previewName = document.querySelector('[data-path-surface-name]')
    const previewCost = document.querySelector('#path-art-cost')
    if (previewSwatch) previewSwatch.setAttribute('data-surface', selectedType)
    if (previewName) previewName.textContent = localize(foot.name)
    if (previewCost) previewCost.textContent = t`Kosten: ${formatMoney(foot.cost)}`
    if (surfacePreview) {
      surfacePreview.title = `${joinParts(localize(foot.name), t('Gedrückt halten für Wegarten.'))} ${localize(foot.detail)}`
    }
    for (const root of pickers) for (const kind of ['foot', 'road'] as const) {
      const id = kind === 'foot' ? footType : roadType, way = WAY_TYPES[id]
      const icons = root.querySelectorAll<HTMLButtonElement>(`[data-way-kind="${kind}"]`)
      if (!icons.length) continue
      icons.forEach(icon => icon.setAttribute('aria-pressed', String(icon.dataset.wayIcon === id)))
      const detail = root.querySelector<HTMLElement>(`[data-way-detail="${kind}"]`)!
      detail.textContent = wayLabel(way)
      detail.title = `${localize(way.detail)} ${kind === 'foot' ? t`Tempo ${Math.round(way.speed * 100)} %, Kapazität ${way.capacity} Personen/Feld.` : t`Höchstens Tempo ${way.limit}.`} ${t`Bei voller Nässe ${Math.round(way.rain * 100)} % langsamer.`}`
    }
  }
  const setSurfacePopup = (open: boolean) => {
    if (!surfacePopup || !surfacePreview) return
    surfacePopup.hidden = !open
    surfacePreview.setAttribute('aria-expanded', String(open))
  }
  if (surfacePreview && surfacePopup) {
    let holdTimer = 0
    let openedByHold = false
    const clearHold = () => {
      if (!holdTimer) return
      window.clearTimeout(holdTimer)
      holdTimer = 0
    }
    surfacePreview.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      surfacePreview.setPointerCapture(event.pointerId)
      openedByHold = false
      clearHold()
      holdTimer = window.setTimeout(() => {
        holdTimer = 0
        openedByHold = true
        setSurfacePopup(true)
      }, SURFACE_HOLD_MS)
    })
    surfacePreview.addEventListener('pointerup', (event) => {
      clearHold()
      if (!openedByHold) return
      const under = document.elementFromPoint(event.clientX, event.clientY)
      const icon = under?.closest<HTMLButtonElement>('[data-way-icon]')
      if (icon) icon.click()
      else if (!surfacePopup.contains(under) && !surfacePreview.contains(under)) setSurfacePopup(false)
    })
    surfacePreview.addEventListener('pointercancel', () => {
      clearHold()
      openedByHold = false
    })
    surfacePreview.addEventListener('click', (event) => {
      if (openedByHold) {
        event.preventDefault()
        openedByHold = false
        return
      }
      setSurfacePopup(surfacePopup.hasAttribute('hidden'))
    })
    surfacePreview.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        setSurfacePopup(true)
      }
      if (event.key === 'Escape') setSurfacePopup(false)
    })
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node
      if (surfacePopup.hidden || surfacePopup.contains(target) || surfacePreview.contains(target)) return
      setSurfacePopup(false)
    })
  }
  const applyFootType = () => {
    refreshTypes()
    releaseTool()
    getGame().setTool('path')
  }
  for (const root of pickers) {
    root.addEventListener('click', e => {
      const icon = (e.target as Element).closest<HTMLButtonElement>('[data-way-icon]'); if (!icon) return
      if (icon.dataset.wayKind === 'foot') {
        footType = icon.dataset.wayIcon as WayType
        setSurfacePopup(false)
        applyFootType()
        return
      }
      roadType = icon.dataset.wayIcon as WayType
      refreshTypes()
      setSurfacePopup(false)
      releaseTool()
      getGame().setTool('road')
    })
  }
  refreshTypes()
  groundPanel.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLElement>('button'); if (!b) return
    if (b.dataset.tool) choose(b.dataset.tool)
  })
  function update(s: Readonly<GameSnapshot>) {
    if (mode !== 'none' && ((mode === 'path' || mode === 'road') ? s.selectedTool !== mode : s.selectedTool !== 'inspect')) releaseTool()
  }
  function handleCell(cell: { x: number; z: number }): boolean {
    if (!groundOpen || mode === 'none' || ['path', 'road', 'wasteDump'].includes(mode)) return false
    const s = getGame().snapshot
    if (mode in GROUND_WORK) execute({ type: 'ground', ...cell, kind: mode as GroundWork })
    const ground = groundInfo(s, cell.x, cell.z), b = s.buildings.find(b => b.x === cell.x && b.z === cell.z && b.kind !== 'path')
    const look = ground.cover
      ? localize(GROUND_COVERS[ground.cover].name)
      : { clay: tc('soil', 'Lehm'), field: t('Ackerboden'), gravel: t('Kiesboden'), sand: t('Sandboden'), grass: t('Wiesenboden'), urban: t('Befestigter Stadtboden') }[ground.type]
    const stock = b && s.festival.infrastructure.shops[b.id]
    qG('[data-cell]').innerHTML = `<b>${t`Feld ${String(cell.x)}, ${String(cell.z)}`}</b> · ${look}<br>${joinParts(t`Tragfähigkeit ${ground.bearing}/3`, t`Tempo ${Math.round(ground.speed * 100)} %`)}<br>${t`Fahrbahn geeignet bis Tempo ${roadGroundLimit(s, cell.x, cell.z)}`}<br>${ground.drained ? t('Entwässert') : t('Ohne Entwässerung')} · ${ground.surface === 'paved' ? t('Gepflastert') : ground.surface === 'gravel' ? t('Geschottert') : ground.compacted ? t('Verdichtet') : t('Unbefestigt')}${b ? `<br>${t`Gebäudeeffizienz ${Math.round((ground.bearing === 3 ? 1.25 : Math.max(.4, ground.speed)) * 100)} %`}${stock ? `<br>${t`Standbestand: ${stockLine(stock)}`}` : ''}` : ''}`
    return true
  }
  return { update, handleCell, releaseTool, activateWay: (kind: 'path' | 'road') => choose(kind), getFootType: () => footType, getRoadType: () => roadType,
    setEditorRoad: (enabled: boolean) => { editorRoad = enabled; editorPicker.hidden = enabled; roadPicker.hidden = !enabled; setSurfacePopup(false); refreshTypes() },
    isActive: () => groundOpen, isOverlay: () => overlayOn, setOverlay, close: () => { toggleGround(false); setOverlay(false) } }
}
