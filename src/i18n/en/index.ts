/**
 * The English catalog: every area file merged. Only src/boot.ts (as a separate chunk,
 * for English players) and tests import it. One area per conversion group, so groups
 * never edit a shared catalog file; see docs/i18n.md for the format and the checker.
 */
import type { EnglishCatalog } from '../state'
import * as attractions from './attractions'
import * as build from './build'
import * as clientText from './clientText'
import * as core from './core'
import * as festival from './festival'
import * as legacy from './legacy'
import * as main from './main'
import * as net from './net'
import * as operations from './operations'
import * as panels from './panels'
import * as server from './server'
import * as shell from './shell'
import * as state from './state'
import * as title from './title'
import * as ui from './ui'
import * as visitors from './visitors'

type Area = { text: Record<string, string>; names?: Record<string, string> }

const AREAS: readonly Area[] = [
  core,
  visitors,
  state,
  festival,
  clientText,
  build,
  attractions,
  operations,
  server,
  net,
  shell,
  main,
  panels,
  ui,
  title,
  legacy,
]

function merge(pick: (area: Area) => Record<string, string> | undefined): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const area of AREAS) Object.assign(merged, pick(area))
  return merged
}

const names = merge((area) => area.names)

export const EN: EnglishCatalog = {
  text: { ...merge((area) => area.text), ...names },
  names,
}
