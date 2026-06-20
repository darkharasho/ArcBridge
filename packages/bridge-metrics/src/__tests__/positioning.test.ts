import { describe, it, expect } from 'vitest'
import { classifyDegree, computePositioning, OUT_OF_POSITION } from '../positioning'

const player = (over: Record<string, unknown>) => ({ notInSquad: false, statsAll: [{}], ...over })

describe('computePositioning', () => {
  it('reports per-player distance-to-tag and out-of-position deaths', () => {
    const report = { details: { durationMS: 10000, combatReplayMetaData: { pollingRate: 150, inchToPixel: 0.01, sizes: [1000,1000] as [number,number] }, players: [
      { notInSquad: false, hasCommanderTag: true, account: 'Tag.1', combatReplayData: { positions: [[0,0],[0,0]] as [number,number][] } },
      { notInSquad: false, account: 'Stray.2', combatReplayData: { positions: [[0,0],[2000,0]] as [number,number][], down: [[150,9000]] as [number,number][], dead: [[9000,99999]] as [number,number][] } },
    ] } }
    const s = computePositioning(report)
    expect(s.degree).toBe('full')
    const stray = s.perPlayer.find(p => p.account === 'Stray.2')!
    expect(stray.peakDistToTag).toBeGreaterThan(OUT_OF_POSITION)
    expect(s.outOfPositionDeaths.some(d => d.account === 'Stray.2')).toBe(true)
  })
})

describe('classifyDegree', () => {
  it('returns "full" when a commander has replay positions', () => {
    const report = { details: { combatReplayMetaData: { pollingRate: 150, inchToPixel: 0.01 }, players: [
      player({ hasCommanderTag: true, combatReplayData: { positions: [[0,0],[1,1]] } }),
      player({ combatReplayData: { positions: [[2,2]] } }),
    ] } }
    expect(classifyDegree(report)).toBe('full')
  })
  it('returns "coarse" when only distToCom aggregates exist (no positions)', () => {
    const report = { details: { players: [ player({ statsAll: [{ distToCom: 420 }] }) ] } }
    expect(classifyDegree(report)).toBe('coarse')
  })
  it('returns "none" when neither positions nor distToCom exist', () => {
    const report = { details: { players: [ player({}) ] } }
    expect(classifyDegree(report)).toBe('none')
  })
})
