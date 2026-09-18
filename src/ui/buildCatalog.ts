import {
  BUILDINGS,
  type BuildingKind,
} from '../game/catalog'
import {
  buildingMenuItem,
  buildCategoryById,
  isCatalogBuildCategory,
  type BuildCategoryId,
  type BuildMenuItem,
} from '../game/buildMenu'
import {
  DECORATION_CATEGORY_IDS,
  DECORATION_CATEGORY_LABELS,
  DECORATION_THEMES,
  filterDecorationKinds,
  type DecorationThemeId,
} from '../game/decoration'
import type { CoasterTypeId } from '../game/coasters'
import type { GameSnapshot } from '../game/types/snapshot'
import { stageStats } from '../game/stageDesign'

export interface BuildCatalogThumbnails {
  buildingThumbnail(kind: BuildingKind): string
  supplyThumbnail(kind: 'delivery' | 'supply'): string
  coasterTrainThumbnail(typeId: CoasterTypeId): string
}

export type BuildCatalogElements = {
  panel: HTMLElement
  title: HTMLElement
  grid: HTMLElement
  subtabs: HTMLElement
  status: HTMLElement
  statusName: HTMLElement
  statusDetail: HTMLElement
  statusCost: HTMLElement
  decorationThemes: HTMLElement | null
}

export type BuildCatalog = {
  render(categoryId: BuildCategoryId, groupId?: string): string
  renderDecoration(theme: DecorationThemeId): void
  showSelectedStatus(): void
  syncSelection(): void
  bindStatusEvents(): void
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)

export function catalogTileHtml(
  item: BuildMenuItem,
  catalog: boolean,
  snapshot: Pick<GameSnapshot, 'festival'>,
  formatMoney: (value: number) => string,
): string {
  const stageTemplate =
    item.tool === 'stage'
      ? snapshot.festival.stageTemplates?.find(
          (template) => template.name === snapshot.festival.selectedStageTemplate,
        )
      : undefined
  const name = escapeHtml(stageTemplate ? stageTemplate.name : item.name)
  const buildingCost =
    item.tool === 'stage'
      ? formatMoney(BUILDINGS.stage.cost + (stageTemplate ? stageStats(stageTemplate).cost : 0))
      : item.previewKind && !item.bungee
        ? formatMoney(BUILDINGS[item.previewKind].cost)
        : ''
  const cost = buildingCost || (/€/.test(item.detail) ? item.detail : '')
  const extraDetail = item.detail !== cost && item.detail !== buildingCost ? item.detail : ''
  const preview = item.previewKind
    ? `<span class="building-preview" data-preview-kind="${item.previewKind}">${item.icon}</span>`
    : item.previewSupply
      ? `<span class="building-preview" data-preview-supply="${item.previewSupply}">${item.icon}</span>`
      : item.coasterTypeId
        ? `<span class="building-preview" data-preview-coaster="${item.coasterTypeId}">${item.icon}</span>`
        : `<span>${item.icon}</span>`
  const speedClass =
    item.tool === 'roadSpeed10'
      ? ' speed-10'
      : item.tool === 'roadSpeed30'
        ? ' speed-30'
        : item.tool === 'roadSpeed50'
          ? ' speed-50'
          : ''
  const label = [name, extraDetail, cost].filter(Boolean).join(', ')
  const catalogAttrs = catalog
    ? ` data-catalog-name="${name}" data-catalog-detail="${escapeHtml(extraDetail)}" data-catalog-cost="${escapeHtml(cost)}" aria-label="${escapeHtml(label)}"`
    : ''
  const caption = catalog ? '' : `<em>${name}<small>${item.tool === 'stage' ? cost : item.detail}</small></em>`
  return `<button class="tool${speedClass}" data-tool="${item.tool}"${item.bungee ? ' data-bungee="true"' : ''}${item.coasterTypeId ? ` data-coaster-type="${item.coasterTypeId}"` : ''}${catalogAttrs} type="button">${preview}${caption}</button>`
}

export function createBuildCatalog(
  elements: BuildCatalogElements,
  getSnapshot: () => GameSnapshot,
  thumbnails: BuildCatalogThumbnails,
  formatMoney: (value: number) => string,
): BuildCatalog {
  let hoverActive = false

  const fillThumbnails = (): void => {
    elements.grid.querySelectorAll<HTMLElement>('[data-preview-kind]').forEach((element) => {
      const image = document.createElement('img')
      image.src = thumbnails.buildingThumbnail(element.dataset.previewKind as BuildingKind)
      image.alt = ''
      image.setAttribute('aria-hidden', 'true')
      element.replaceChildren(image)
      delete element.dataset.previewKind
    })
    elements.grid.querySelectorAll<HTMLElement>('[data-preview-supply]').forEach((element) => {
      const image = document.createElement('img')
      image.src = thumbnails.supplyThumbnail(element.dataset.previewSupply as 'delivery' | 'supply')
      image.alt = ''
      image.setAttribute('aria-hidden', 'true')
      element.replaceChildren(image)
      delete element.dataset.previewSupply
    })
    elements.grid.querySelectorAll<HTMLElement>('[data-preview-coaster]').forEach((element) => {
      const image = document.createElement('img')
      image.src = thumbnails.coasterTrainThumbnail(element.dataset.previewCoaster as CoasterTypeId)
      image.alt = ''
      image.setAttribute('aria-hidden', 'true')
      element.replaceChildren(image)
      delete element.dataset.previewCoaster
    })
  }

  const showStatus = (button: HTMLButtonElement | null): void => {
    if (elements.status.hidden) return
    elements.statusName.textContent = button?.dataset.catalogName ?? 'Objekt wählen'
    const detail = button?.dataset.catalogDetail ?? ''
    elements.statusDetail.textContent = detail
    elements.statusDetail.hidden = detail.length === 0
    const cost = button?.dataset.catalogCost ?? ''
    elements.statusCost.textContent = cost ? `Kosten: ${cost}` : ''
  }

  const showSelectedStatus = (): void => {
    showStatus(
      elements.grid.querySelector<HTMLButtonElement>('.tool.active') ??
      elements.grid.querySelector<HTMLButtonElement>('.tool'),
    )
  }

  const renderDecoration = (theme: DecorationThemeId): void => {
    if (elements.decorationThemes) {
      elements.decorationThemes.innerHTML = DECORATION_THEMES.map(
        (entry) =>
          `<button type="button" data-decoration-theme="${entry.id}" aria-pressed="${entry.id === theme}" title="${escapeHtml(entry.rationale)}">${entry.icon}<small>${escapeHtml(entry.label)}</small></button>`,
      ).join('')
    }
    elements.subtabs.hidden = true
    elements.subtabs.replaceChildren()
    const sections = DECORATION_CATEGORY_IDS.flatMap((category) => {
      const kinds = filterDecorationKinds(theme, category)
      if (kinds.length === 0) return []
      const tiles = kinds
        .map((kind) => catalogTileHtml(buildingMenuItem(kind), true, getSnapshot(), formatMoney))
        .join('')
      return [
        `<section class="decoration-category" data-decoration-category="${category}"><h3>${DECORATION_CATEGORY_LABELS[category]}</h3><div class="decoration-category-grid">${tiles}</div></section>`,
      ]
    })
    elements.grid.innerHTML = sections.length
      ? sections.join('')
      : '<p class="decoration-empty">Keine Deko in diesem Thema.</p>'
    fillThumbnails()
    showSelectedStatus()
  }

  return {
    render(categoryId, groupId) {
      const category = buildCategoryById(categoryId)
      const group = category.groups.find((entry) => entry.id === groupId) ?? category.groups[0]!
      const catalog = isCatalogBuildCategory(categoryId)
      hoverActive = false
      elements.title.textContent = category.label
      elements.panel.classList.toggle('build-menu-catalog', catalog)
      elements.panel.classList.toggle('build-menu-decoration', categoryId === 'decoration')
      elements.status.hidden = !catalog
      document.querySelectorAll<HTMLElement>('.build-extra').forEach((extra) => {
        extra.hidden = extra.id !== `build-extra-${category.extra ?? ''}`
      })
      if (categoryId === 'decoration') return group.id
      if (category.groups.length > 1) {
        elements.subtabs.hidden = false
        elements.subtabs.innerHTML = category.groups.map(
          (entry) =>
            `<button type="button" data-build-group="${entry.id}" aria-pressed="${entry.id === group.id}">${entry.label}</button>`,
        ).join('')
      } else {
        elements.subtabs.hidden = true
        elements.subtabs.replaceChildren()
      }
      const attractionsExtra = document.querySelector<HTMLElement>('#build-extra-attractions')
      if (attractionsExtra && categoryId === 'attractions') attractionsExtra.hidden = group.id !== 'rides'
      elements.grid.innerHTML = group.items
        .map((item) => catalogTileHtml(item, catalog, getSnapshot(), formatMoney))
        .join('')
      fillThumbnails()
      if (catalog) showSelectedStatus()
      return group.id
    },
    renderDecoration,
    showSelectedStatus,
    syncSelection() {
      if (!hoverActive) showSelectedStatus()
    },
    bindStatusEvents() {
      elements.grid.addEventListener('pointerover', (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
        if (!button || !elements.grid.contains(button) || elements.status.hidden) return
        hoverActive = true
        showStatus(button)
      })
      elements.grid.addEventListener('pointerleave', () => {
        hoverActive = false
        showSelectedStatus()
      })
      elements.grid.addEventListener('focusin', (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
        if (button && !elements.status.hidden) showStatus(button)
      })
      elements.grid.addEventListener('focusout', (event) => {
        if (elements.status.hidden || elements.grid.contains(event.relatedTarget as Node | null)) return
        if (!hoverActive) showSelectedStatus()
      })
    },
  }
}
