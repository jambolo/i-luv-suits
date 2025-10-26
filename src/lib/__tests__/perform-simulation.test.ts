import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../simulation-core'
import { performSimulation } from '../simulation-core'

const payoutConfig = {
  flushRush: { sevenCard: 100, sixCard: 20, fiveCard: 10, fourCard: 2 },
  superFlushRush: { sevenCardStraight: 500, sixCardStraight: 200, fiveCardStraight: 100, fourCardStraight: 50, threeCardStraight: 9 }
}

describe('performSimulation determinism', () => {
  it('two runs with the same seeded RNG produce identical summaries', async () => {
    const seed = 987654321
    const rngA = mulberry32(seed)
    const rngB = mulberry32(seed)

    // keep the run small but meaningful
    const numHands = 2000
    const minThreeCardFlushRank = 9

    const s1 = await performSimulation(numHands, payoutConfig as any, minThreeCardFlushRank, rngA)
    const s2 = await performSimulation(numHands, payoutConfig as any, minThreeCardFlushRank, rngB)

    // stringified comparison is a simple deep equality check
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2))
  }, 20000)
})
