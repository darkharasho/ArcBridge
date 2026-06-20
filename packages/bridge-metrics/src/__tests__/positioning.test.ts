import { describe, it, expect } from 'vitest'
import { classifyDegree } from '../positioning'

const player = (over: Record<string, unknown>) => ({ notInSquad: false, statsAll: [{}], ...over })

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
