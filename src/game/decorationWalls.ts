/** Shared catalog/model dimensions. Heights match the construction grid. */
export const WALL_STYLES = {
  adobe: { theme: 'wueste', label: 'Lehm', color: 0xc69362, trim: 0x815439 },
  woodland: { theme: 'wald', label: 'Waldholz', color: 0x61523c, trim: 0x426044 },
  neon: { theme: 'neon', label: 'Neon', color: 0x283343, trim: 0x37dbdf },
  industrial: { theme: 'industrie', label: 'Wellblech', color: 0x788489, trim: 0xc49b43 },
  bamboo: { theme: 'tropen', label: 'Bambus', color: 0xbfa064, trim: 0x655437 },
  arcane: { theme: 'mystik', label: 'Runenstein', color: 0x71677b, trim: 0xb997dc },
  circus: { theme: 'zirkus', label: 'Zirkus', color: 0xc65652, trim: 0xf4dda5 },
  chalet: { theme: 'alpin', label: 'Fachwerk', color: 0xe3d5b3, trim: 0x6e4835 },
  ice: { theme: 'arktis', label: 'Eis', color: 0xb2d6e3, trim: 0xe7f5fa },
  brass: { theme: 'steampunk', label: 'Kupfer', color: 0x956347, trim: 0xd3b56f },
} as const
export type WallStyle = keyof typeof WALL_STYLES
export const WALL_SHAPES = ['Full', 'Half', 'Window', 'Door', 'SlopeLeft', 'SlopeRight', 'RoofEnd'] as const
export type WallKind = `wall${Capitalize<WallStyle>}${typeof WALL_SHAPES[number]}`
export const WALL_KINDS = Object.keys(WALL_STYLES).flatMap(style => WALL_SHAPES.map(shape =>
  `wall${style[0]!.toUpperCase()}${style.slice(1)}${shape}` as WallKind))
type WallSpec = (typeof WALL_STYLES)[WallStyle] & { style: WallStyle; shape: typeof WALL_SHAPES[number]; height: number }
const WALL_SPECS = new Map<string, WallSpec>(WALL_KINDS.map(kind => {
  const style = Object.keys(WALL_STYLES).find(s => kind.startsWith(`wall${s[0]!.toUpperCase()}${s.slice(1)}`))! as WallStyle
  const shape = WALL_SHAPES.find(s => kind.endsWith(s))!
  return [kind, { ...WALL_STYLES[style], style, shape, height: shape === 'Half' || shape === 'SlopeLeft' || shape === 'SlopeRight' || shape === 'RoofEnd' ? .5 : 1 }]
}))
export function wallSpec(kind: string): WallSpec | undefined { return WALL_SPECS.get(kind) }

export type RoofKind = `roof${Capitalize<WallStyle>}${'Flat' | 'Slope'}`
export const ROOF_KINDS = Object.keys(WALL_STYLES).flatMap(style => ['Flat', 'Slope'].map(shape =>
  `roof${style[0]!.toUpperCase()}${style.slice(1)}${shape}` as RoofKind))
const ROOF_SPECS = new Map(ROOF_KINDS.map(kind => {
  const style = Object.keys(WALL_STYLES).find(s => kind.startsWith(`roof${s[0]!.toUpperCase()}${s.slice(1)}`))! as WallStyle
  return [kind as string, { ...WALL_STYLES[style], style, slope: kind.endsWith('Slope'), height: kind.endsWith('Slope') ? .5 : .1 }]
}))
export function roofSpec(kind: string) { return ROOF_SPECS.get(kind) }
export function isFacade(kind: string): boolean { return Boolean(wallSpec(kind) || roofSpec(kind)) }
export function isWallDoor(kind: string): boolean { return wallSpec(kind)?.shape === 'Door' }
export type ThemedBinKind = `bin${Capitalize<WallStyle>}`
export const THEMED_BIN_KINDS = Object.keys(WALL_STYLES).map(style => `bin${style[0]!.toUpperCase()}${style.slice(1)}` as ThemedBinKind)
const BIN_SPECS = new Map(THEMED_BIN_KINDS.map((kind, index) => [kind as string, Object.values(WALL_STYLES)[index]!]))
export function binSpec(kind: string) { return BIN_SPECS.get(kind) }
export function isWasteBin(kind: string | undefined): boolean { return kind === 'wasteBin' || BIN_SPECS.has(kind ?? '') }

/** Slope infill meets the underside of the existing half-level pitched roof. */
export function roofWallTop(shape: string, x: number): number | undefined {
  if (shape === 'SlopeLeft') return .44 * (.5 - x)
  if (shape === 'SlopeRight') return .44 * (.5 + x)
  if (shape === 'RoofEnd') return .44
  return undefined
}
