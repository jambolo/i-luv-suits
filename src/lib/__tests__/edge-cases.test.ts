import { describe, it, expect } from 'vitest'
import {
  mulberry32,
  createDeck,
  shuffleDeckWithRng,
  sortHandBySuitThenRank,
  findBestFlush,
  findLowAceStraight,
  findLongestStraight,
  findLongestStraightFlush,
  divideHandIntoSuits,
  dealerQualifies,
  PayoutConfig,
  performSimulation,
  Card
} from '../simulation-core'

describe('edge cases & invariants', () => {
  it('shuffleDeckWithRng is deterministic and does not mutate original deck', () => {
    const deck = createDeck()
    const copy = deck.map(c => ({ ...c }))
    const rngA = mulberry32(12345)
    const rngB = mulberry32(12345)
    const s1 = shuffleDeckWithRng(deck, rngA)
    const s2 = shuffleDeckWithRng(deck, rngB)
    expect(s1).toEqual(s2)
    // original deck unchanged
    expect(deck).toEqual(copy)
    // uniqueness preserved
    expect(s1).toHaveLength(52)
    expect(new Set(s1.map(c => `${c.suit}:${c.rank}`)).size).toBe(52)
  })

  it('findLongestStraight returns correct length', () => {
    const flush: Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 13 },
      { suit: '♠', rank: 12 },
      { suit: '♠', rank: 11 },
      { suit: '♠', rank: 10 }
    ]
    // ensure sorted descending before calling
    const sorted = [...flush].sort((a, b) => b.rank - a.rank)
    expect(findLongestStraight(sorted)).toBe(5)
  })

  it('findLowAceStraight recognizes ace-low wheel', () => {
    const flush: Card[] = [
      { suit: '♥', rank: 14 },
      { suit: '♥', rank: 5 },
      { suit: '♥', rank: 4 },
      { suit: '♥', rank: 3 },
      { suit: '♥', rank: 2 }
    ]
    const sorted = [...flush].sort((a, b) => b.rank - a.rank)
    expect(findLowAceStraight(sorted)).toBe(5)
  })

  it('findBestFlush returns a flush sorted by rank descending', () => {
    const hand: Card[] = [
      { suit: '♠', rank: 9 },
      { suit: '♠', rank: 8 },
      { suit: '♠', rank: 7 },
      { suit: '♠', rank: 6 },
      { suit: '♥', rank: 14 },
      { suit: '♥', rank: 13 },
      { suit: '♥', rank: 12 }
    ]
    // Provide a sorted hand (by suit then rank) to match function expectations
    const sortedHand = sortHandBySuitThenRank(hand)
    const best = findBestFlush(sortedHand)
    // All cards should be same suit
    expect(best.every(c => c.suit === '♠')).toBe(true)
    // Ensure returned flush is sorted by rank descending
    for (let i = 1; i < best.length; i++) {
      expect(best[i - 1].rank).toBeGreaterThanOrEqual(best[i].rank)
    }
  })

  it('divideHandIntoSuits returns groups (caller-sorted) and groups contain sorted arrays', () => {
    const hand: Card[] = [
      { suit: '♣', rank: 3 },
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 10 },
      { suit: '♥', rank: 11 },
      { suit: '♠', rank: 9 }
    ]
    const sorted = sortHandBySuitThenRank(hand)
    const groups = divideHandIntoSuits(sorted)
    // For each suit group, ensure the group is in descending rank order
    for (const suit of Object.keys(groups)) {
      const arr = groups[suit]
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i - 1].rank).toBeGreaterThanOrEqual(arr[i].rank)
      }
    }
  })

  it('findLongestStraightFlush returns expected lengths', () => {
    // 5-card straight flush hearts
    const hand1: Card[] = [
      { suit: '♥', rank: 10 },
      { suit: '♥', rank: 9 },
      { suit: '♥', rank: 8 },
      { suit: '♥', rank: 7 },
      { suit: '♥', rank: 6 },
      { suit: '♣', rank: 2 }
    ]
    const sorted1 = sortHandBySuitThenRank(hand1)
    expect(findLongestStraightFlush(sorted1)).toBe(5)

    // mixed suits should not combine across suits
    const hand2: Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 11 },
      { suit: '♥', rank: 12 },
      { suit: '♠', rank: 10 }
    ]
    const sorted2 = sortHandBySuitThenRank(hand2)
    expect(findLongestStraightFlush(sorted2)).toBeLessThanOrEqual(2)
  })

  it('dealerQualifies boundary behavior', () => {
    const qualifies: Card[] = [
      { suit: '♠', rank: 9 },
      { suit: '♠', rank: 7 },
      { suit: '♠', rank: 5 }
    ] as Card[]
    const notQualify: Card[] = [
      { suit: '♠', rank: 8 },
      { suit: '♠', rank: 7 },
      { suit: '♠', rank: 6 }
    ] as Card[]
    expect(dealerQualifies(sortHandBySuitThenRank(qualifies))).toBe(true)
    expect(dealerQualifies(sortHandBySuitThenRank(notQualify))).toBe(false)
  })

  it('performSimulation deterministic for same seed (small run) and progress callback invoked', async () => {
    const cfg: PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 20, fiveCard: 10, fourCard: 2 },
      superFlushRush: { sevenCardStraight: 500, sixCardStraight: 200, fiveCardStraight: 100, fourCardStraight: 50, threeCardStraight: 9 }
    }
    const seed = 424242
    const rngA = mulberry32(seed)
    const rngB = mulberry32(seed)
    let progressA = -1
    let progressB = -1
    const s1 = await performSimulation(50, cfg, 9, rngA, (p) => { progressA = p })
    const s2 = await performSimulation(50, cfg, 9, rngB, (p) => { progressB = p })
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2))
    expect(progressA).toBeGreaterThanOrEqual(0)
    expect(progressB).toBeGreaterThanOrEqual(0)
  })
})
