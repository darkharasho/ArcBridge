// src/positioning.ts
export type ReplayDegree = 'full' | 'coarse' | 'none'

type AnyPlayer = { notInSquad?: boolean; hasCommanderTag?: boolean; account?: string; profession?: string
  statsAll?: Array<{ distToCom?: number; stackDist?: number }>
  combatReplayData?: { positions?: Array<[number, number]>; dead?: Array<[number, number]>; down?: Array<[number, number]>; start?: number } }
export type ParsedReport = { details?: { players?: AnyPlayer[]
  combatReplayMetaData?: { pollingRate?: number; inchToPixel?: number; sizes?: [number, number] }
  durationMS?: number } }

export type PerPlayerDistance = {
  account: string
  avgDistToTag: number
  peakDistToTag: number
}

export type OutOfPositionDeath = {
  account: string
  distAtDown: number
  atSec: number
}

export type PositioningSummary = {
  degree: ReplayDegree
  perPlayer: PerPlayerDistance[]
  outOfPositionDeaths: OutOfPositionDeath[]
  squad: null
  commander: null
  deathClusters: []
  figure: undefined
}

export const OUT_OF_POSITION = 1200

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

const squadOf = (r: ParsedReport): AnyPlayer[] => (r.details?.players ?? []).filter((p) => !p?.notInSquad)

export function classifyDegree(report: ParsedReport): ReplayDegree {
  const squad = squadOf(report)
  const meta = report.details?.combatReplayMetaData ?? {}
  const commander = squad.find((p) => p?.hasCommanderTag)
  const tagPositions = commander?.combatReplayData?.positions ?? []
  if (commander && tagPositions.length > 0 && (meta.pollingRate ?? 0) > 0 && (meta.inchToPixel ?? 0) > 0) return 'full'
  if (squad.some((p) => typeof p?.statsAll?.[0]?.distToCom === 'number')) return 'coarse'
  return 'none'
}

export function computePositioning(report: ParsedReport): PositioningSummary {
  const degree = classifyDegree(report)
  const squad = squadOf(report)
  const meta = report.details?.combatReplayMetaData ?? {}
  const pollingRate = (meta.pollingRate ?? 0) > 0 ? (meta.pollingRate as number) : 0
  const inchToPixel = (meta.inchToPixel ?? 0) > 0 ? (meta.inchToPixel as number) : 0

  const commander = squad.find((p) => p?.hasCommanderTag)
  const tagPositions: Array<[number, number]> = commander?.combatReplayData?.positions ?? []
  const replayUsable = !!commander && tagPositions.length > 0 && pollingRate > 0 && inchToPixel > 0

  const perPlayerMap = new Map<string, number[]>()
  const outOfPositionDeaths: OutOfPositionDeath[] = []

  if (replayUsable) {
    for (const player of squad) {
      const account = player?.account ?? 'Unknown'
      const isCommanderPlayer = !!player?.hasCommanderTag
      const playerPositions = player?.combatReplayData?.positions
      if (!Array.isArray(playerPositions) || playerPositions.length === 0) continue

      const playerStart = Number(player?.combatReplayData?.start ?? 0)
      const playerOffset = Math.floor(playerStart / pollingRate)

      // Per-tick distance samples
      const samples: number[] = []
      for (let i = 0; i < playerPositions.length; i++) {
        const tagIdx = clamp(i + playerOffset, 0, tagPositions.length - 1)
        const [px, py] = playerPositions[i]
        const [tx, ty] = tagPositions[tagIdx]
        const dist = isCommanderPlayer ? 0 : Math.hypot(px - tx, py - ty) / inchToPixel
        samples.push(dist)
      }
      const existing = perPlayerMap.get(account)
      if (existing) {
        for (const s of samples) existing.push(s)
      } else {
        perPlayerMap.set(account, samples)
      }

      // Out-of-position downs/deaths
      if (isCommanderPlayer) continue
      const replay = player?.combatReplayData
      if (!replay || !Array.isArray(replay.down)) continue

      for (const entry of replay.down) {
        if (!Array.isArray(entry)) continue
        const downStartMs = Number(entry[0])
        if (!Number.isFinite(downStartMs) || downStartMs < 0) continue

        const pollIndex = Math.floor(downStartMs / pollingRate)
        const playerIdx = clamp(pollIndex - playerOffset, 0, playerPositions.length - 1)
        const tagIdx = clamp(pollIndex, 0, tagPositions.length - 1)

        const [px, py] = playerPositions[playerIdx]
        const [tx, ty] = tagPositions[tagIdx]
        const distAtDown = Math.round(Math.hypot(px - tx, py - ty) / inchToPixel)

        if (distAtDown > OUT_OF_POSITION) {
          outOfPositionDeaths.push({ account, distAtDown, atSec: Math.round(downStartMs / 1000) })
        }
      }
    }
  }

  const perPlayer: PerPlayerDistance[] = []
  for (const [account, samples] of perPlayerMap) {
    if (samples.length === 0) continue
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length
    const peak = Math.max(...samples)
    perPlayer.push({ account, avgDistToTag: Math.round(avg), peakDistToTag: Math.round(peak) })
  }
  perPlayer.sort((a, b) => b.peakDistToTag - a.peakDistToTag)

  return { degree, perPlayer, outOfPositionDeaths, squad: null, commander: null, deathClusters: [], figure: undefined }
}
