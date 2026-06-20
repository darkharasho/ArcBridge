// src/positioning.ts
export type ReplayDegree = 'full' | 'coarse' | 'none'

type AnyPlayer = { notInSquad?: boolean; hasCommanderTag?: boolean; account?: string; profession?: string
  statsAll?: Array<{ distToCom?: number; stackDist?: number }>
  combatReplayData?: { positions?: Array<[number, number]>; dead?: Array<[number, number]>; down?: Array<[number, number]>; start?: number } }
export type ParsedReport = { details?: { players?: AnyPlayer[]
  combatReplayMetaData?: { pollingRate?: number; inchToPixel?: number; sizes?: [number, number] }
  durationMS?: number } }

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
