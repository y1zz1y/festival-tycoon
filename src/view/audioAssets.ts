import { AUDIO_ASSETS, type AudioAssetKey } from '../game/audio'

export type { AudioAssetKey }

export function audioAssetPublicPath(key: AudioAssetKey): string {
  return AUDIO_ASSETS[key]
}

export function audioAssetUrl(path: string): string {
  return `/${path.replace(/^\/+/, '')}`
}

export async function fetchAudioArrayBuffer(
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetchImpl(audioAssetUrl(path))
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    return buffer.byteLength > 0 ? buffer : null
  } catch {
    return null
  }
}

export async function decodeFestivalAudioBuffer(
  context: Pick<AudioContext, 'decodeAudioData'>,
  data: ArrayBuffer,
): Promise<AudioBuffer | null> {
  try {
    return await context.decodeAudioData(data.slice(0))
  } catch {
    return null
  }
}

export async function loadFestivalAudioBuffer(
  context: Pick<AudioContext, 'decodeAudioData'>,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AudioBuffer | null> {
  const data = await fetchAudioArrayBuffer(path, fetchImpl)
  if (!data) return null
  return decodeFestivalAudioBuffer(context, data)
}
