import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleAccountRequest } from '../server/accounts'
import { handleProgressRequest } from '../server/progress'
import { closeDatabase } from '../server/database'
import {
  PROGRESS_KEY,
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  readLocalProgress,
  recordScenarioResult,
  syncProgress,
  unlockAchievements,
  writeLocalProgress,
} from '../src/game/progress'
import { request, reply, type Reply } from './serverApi'

/**
 * Progress across games (A8) and achievements: records merge best-of wherever they
 * meet, survive in local storage, and a signed-in player's server copy catches up
 * with a browser that played offline without losing anything either side had.
 */
export async function testProgress(): Promise<void> {
  // Merging keeps the win, the better grade and the earliest date.
  let records = recordScenarioResult(emptyProgress(), 'woodstock', { won: false, score: 41, stars: 2 }, 1000)
  assert.equal(records.scenarios.woodstock!.won, false)
  records = recordScenarioResult(records, 'woodstock', { won: true, score: 78, stars: 4 }, 2000)
  records = recordScenarioResult(records, 'woodstock', { won: true, score: 60, stars: 3 }, 3000)
  assert.deepEqual(records.scenarios.woodstock, { won: true, bestScore: 78, bestStars: 4, firstWonAt: 2000 })
  const unlocked = unlockAchievements(records, ['firstWin', 'firstWin', 'notAnAchievement'], 5000)
  assert.deepEqual(unlocked.unlocked.map((achievement) => achievement.id), ['firstWin'])
  assert.equal(unlockAchievements(unlocked.records, ['firstWin'], 6000).unlocked.length, 0, 'an achievement unlocks once')
  records = unlocked.records

  // Storage: a broken or hostile entry reads as clean records.
  const stored = new Map<string, string>()
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) }
  writeLocalProgress(records, storage)
  assert.deepEqual(readLocalProgress(storage), records, 'progress survives a browser restart')
  stored.set(PROGRESS_KEY, '{kaputt')
  assert.deepEqual(readLocalProgress(storage), emptyProgress())
  assert.deepEqual(
    normalizeProgress({ scenarios: { 'Bad Id!': { won: true }, ok: { won: true, bestScore: 999, bestStars: -3 } }, achievements: { firstWin: 'yesterday', storm: 7 } }),
    { scenarios: { ok: { won: true, bestScore: 100, bestStars: 0 } }, achievements: { storm: 7 } },
  )
  assert.deepEqual(mergeProgress(records, emptyProgress()), records)

  // Server: sign-in required; PUT merges best-of with what is stored.
  const directory = mkdtempSync(join(tmpdir(), 'headliner-progress-'))
  process.env.HEADLINER_DATA_DIR = directory
  const call = async (method: string, body?: unknown, cookie?: string): Promise<Reply> => {
    const sink = reply()
    assert.equal(await handleProgressRequest(request(method, '/api/progress', body, cookie), sink.response), true)
    return sink.read()
  }
  try {
    assert.equal(await handleProgressRequest(request('GET', '/api/saves'), reply().response), false, 'other routes are not progress')
    assert.equal((await call('GET')).status, 401)
    const sink = reply()
    await handleAccountRequest(request('POST', '/api/account/register', { name: 'Fortschritt Test', password: 'wetterfest-2026' }), sink.response)
    const cookie = (sink.read().cookie ?? '').split(';')[0]!
    assert.deepEqual((await call('GET', undefined, cookie)).body, { records: emptyProgress() })
    const first = await call('PUT', { records }, cookie)
    assert.deepEqual(first.body.records, records)
    const otherBrowser = recordScenarioResult(emptyProgress(), 'kutschella', { won: true, score: 90, stars: 5 }, 9000)
    const merged = (await call('PUT', { records: otherBrowser }, cookie)).body.records
    assert.equal(merged.scenarios.woodstock.won, true, 'the first browser\'s win is kept')
    assert.equal(merged.scenarios.kutschella.bestStars, 5, 'the second browser\'s win is added')
    assert.equal(merged.achievements.firstWin, 5000)

    // Client sync: sends local records, keeps the merged answer; offline keeps local.
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const answer = await call('PUT', JSON.parse(String(init?.body)), cookie)
      return new Response(JSON.stringify(answer.body), { status: answer.status })
    }) as typeof fetch
    const synced = await syncProgress(emptyProgress(), fetchImpl)
    assert.equal(synced.synced, true)
    assert.equal(synced.records.scenarios.kutschella!.won, true, 'a new browser gets the account\'s progress')
    const offline = await syncProgress(records, (async () => { throw new Error('offline') }) as typeof fetch)
    assert.deepEqual(offline, { records, synced: false })
  } finally {
    closeDatabase()
    delete process.env.HEADLINER_DATA_DIR
    rmSync(directory, { recursive: true, force: true })
  }
  console.log('PASS progress: best-of records, local storage, account sync and offline fallback')
}
