import { describe, it, expect } from 'vitest'
import {
  mulberry32,
  stringToSeed,
  createDeck,
  shuffleDeckWithRng,
  sortHandBySuitThenRank,
  findBestFlush,
  findLongestStraightFlush,
  findLowAceStraight,
  findLongestStraight,
  divideHandIntoSuits,
  dealerQualifies,
  compareFlushes,
  getMaxPlayWager,
  calculateFlushRushPayout,
  calculateSuperFlushRushPayout,
  performSimulation,
  highCard,
  playerShouldFold,
  PayoutConfig
} from '../src/lib/simulation-core'

describe('simulation-core public API', () => {
  it('createDeck returns 52 unique cards with all suits and ranks', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const uniq = new Set(deck.map(c => `${c.suit}:${c.rank}`))
    expect(uniq.size).toBe(52)
    const suits = new Set(deck.map(c => c.suit))
    expect(suits.size).toBe(4)
  })

  it('shuffleDeckWithRng is deterministic for same seed (mulberry32)', () => {
    const deck = createDeck()
    const seed = 12345
    const r1 = mulberry32(seed)
    const r2 = mulberry32(seed)
    const s1 = shuffleDeckWithRng(deck, r1)
    const s2 = shuffleDeckWithRng(deck, r2)
    expect(s1).toEqual(s2)
  })

  it('sortHandBySuitThenRank orders by suit (♠ ♥ ♦ ♣) then rank desc', () => {
    const hand = [
      { suit: '♥', rank: 2 as any },
      { suit: '♠', rank: 14 as any },
      { suit: '♠', rank: 10 as any },
      { suit: '♣', rank: 13 as any },
      { suit: '♥', rank: 11 as any }
    ]
    const sorted = sortHandBySuitThenRank(hand as any)
    // Expect suits order: ♠ (0), ♥ (1), ♦ (2), ♣ (3)
    const suitOrder = sorted.map(c => c.suit)
    expect(suitOrder.indexOf('♠')).toBeLessThan(suitOrder.indexOf('♥'))
    // Within spades, 14 should come before 10
    const spades = sorted.filter(c => c.suit === '♠')
    expect(spades[0].rank).toBe(14)
    expect(spades[1].rank).toBe(10)
  })

  it('findBestFlush and compareFlushes pick the longest and then highest ranks', () => {
    const hand = [
      { suit: '♠', rank: 14 as any },
      { suit: '♠', rank: 13 as any },
      { suit: '♥', rank: 12 as any },
      { suit: '♠', rank: 11 as any },
      { suit: '♥', rank: 10 as any }
    ]
    const best = findBestFlush(hand as any)
    expect(best.every(c => c.suit === '♠')).toBe(true)
    expect(best.length).toBe(3)

    const a = [{ suit: '♠', rank: 14 as any }, { suit: '♠', rank: 13 as any }]
    const b = [{ suit: '♠', rank: 14 as any }, { suit: '♠', rank: 12 as any }]
    expect(compareFlushes(a as any, b as any)).toBeGreaterThan(0)
  })

  it('findLongestStraightFlush detects straight flush lengths including ace-low wheel', () => {
    // Straight flush 10-6 of hearts (10,9,8,7,6)
    const hearts = [10, 9, 8, 7, 6].map(r => ({ suit: '♥', rank: r as any }))
    // fill to 7 with other suits
    const playerHand1 = [...hearts, { suit: '♠', rank: 2 as any }, { suit: '♦', rank: 3 as any }]
    const len1 = findLongestStraightFlush(playerHand1 as any)
    expect(len1).toBeGreaterThanOrEqual(5)

    // Ace-low wheel: A,5,4,3,2 of clubs
    const wheel = [{ suit: '♣', rank: 14 as any }, { suit: '♣', rank: 5 as any }, { suit: '♣', rank: 4 as any }, { suit: '♣', rank: 3 as any }, { suit: '♣', rank: 2 as any }]
    const playerHand2 = [...wheel, { suit: '♥', rank: 9 as any }, { suit: '♦', rank: 8 as any }]
    const len2 = findLongestStraightFlush(playerHand2 as any)
    // expect wheel detected as length 5
    expect(len2).toBeGreaterThanOrEqual(5)
  })

  it('dealerQualifies rules and playerShouldFold/highCard behavior', () => {
    const threeLow = [{ suit: '♠', rank: 8 as any }, { suit: '♠', rank: 7 as any }, { suit: '♠', rank: 6 as any }]
    expect(dealerQualifies(threeLow as any)).toBe(false)
    const threeHigh = [{ suit: '♠', rank: 10 as any }, { suit: '♠', rank: 9 as any }, { suit: '♠', rank: 8 as any }]
    expect(dealerQualifies(threeHigh as any)).toBe(true)
    expect(highCard(threeHigh as any)).toBe(10)
    // playerShouldFold: less than 3 -> fold
    expect(playerShouldFold([{ suit: '♥', rank: 14 as any } as any], 9)).toBe(true)
    // exactly 3 but below min rank -> fold
    expect(playerShouldFold(threeLow as any, 9)).toBe(true)
    // exactly 3 and meets min rank -> play
    expect(playerShouldFold(threeHigh as any, 9)).toBe(false)
  })

  it('wager and payout helpers return expected multipliers', () => {
    expect(getMaxPlayWager(7, 1)).toBe(3)
    expect(getMaxPlayWager(5, 2)).toBe(4) // ante 2, five-card -> ante*2 => 4

    const cfg: PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 20, fiveCard: 10, fourCard: 2 },
      superFlushRush: { sevenCardStraight: 500, sixCardStraight: 200, fiveCardStraight: 100, fourCardStraight: 50, threeCardStraight: 9 }
    }
    expect(calculateFlushRushPayout(7, cfg)).toBe(100)
    expect(calculateFlushRushPayout(4, cfg)).toBe(2)
    expect(calculateSuperFlushRushPayout(6, cfg)).toBe(200)
    expect(calculateSuperFlushRushPayout(2, cfg)).toBe(0)
  })

  it('performSimulation smoke test returns correct shape and counts', async () => {
    const cfg: PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 20, fiveCard: 10, fourCard: 2 },
      superFlushRush: { sevenCardStraight: 500, sixCardStraight: 200, fiveCardStraight: 100, fourCardStraight: 50, threeCardStraight: 9 }
    }
    const rng = mulberry32(42)
    const summary = await performSimulation(20, cfg, 9, rng)
    expect(summary.handDistribution.totalHands).toBe(20)
    expect(Array.isArray(summary.results)).toBe(true)
    // totals should be numeric
    for (const r of summary.results) {
      expect(typeof r.totalBet).toBe('number')
      expect(typeof r.totalWon).toBe('number')
    }
  })
})
import { describe, it, expect } from 'vitest'
import * as sc from '../src/lib/simulation-core'

describe('simulation-core', () => {
  it('createDeck returns 52 unique cards', () => {
    const deck = sc.createDeck()
    expect(deck.length).toBe(52)
    const ids = new Set(deck.map(c => `${c.suit}:${c.rank}`))
    expect(ids.size).toBe(52)
  })

  it('mulberry32 produces deterministic sequences', () => {
    const a = sc.mulberry32(12345)
    const b = sc.mulberry32(12345)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('shuffleDeckWithRng is deterministic for same seed and preserves cards', () => {
    const seed = 42
    const deck = sc.createDeck()
    const s1 = sc.shuffleDeckWithRng(deck, sc.mulberry32(seed))
    const s2 = sc.shuffleDeckWithRng(deck, sc.mulberry32(seed))
    expect(s1).toEqual(s2)
    // Same multiset
    const ids1 = s1.map(c => `${c.suit}:${c.rank}`).sort()
    const ids2 = deck.map(c => `${c.suit}:${c.rank}`).sort()
    expect(ids1).toEqual(ids2)
  })

  it('getSuitOrder and sortHandBySuitThenRank order suits then ranks descending', () => {
    const unsorted: sc.Card[] = [
      { suit: '♦', rank: 2 },
      { suit: '♠', rank: 14 },
      { suit: '♥', rank: 10 },
      { suit: '♣', rank: 11 },
      { suit: '♠', rank: 9 }
    ]
    const sorted = sc.sortHandBySuitThenRank(unsorted)
    // suit order: ♠ (0), ♥ (1), ♦ (2), ♣ (3)
    expect(sorted[0].suit).toBe('♠')
    expect(sorted[0].rank).toBe(14) // high spade first
    expect(sorted[1].suit).toBe('♠')
    expect(sorted[1].rank).toBe(9)
  })

  it('findBestFlush picks the longest flush (or highest tie-breaker)', () => {
    // hearts: 3 cards (A, K, Q), spades: 4 cards (9,8,7,6)
    const hand: sc.Card[] = [
      { suit: '♥', rank: 14 },
      { suit: '♥', rank: 13 },
      { suit: '♥', rank: 12 },
      { suit: '♠', rank: 9 },
      { suit: '♠', rank: 8 },
      { suit: '♠', rank: 7 },
      { suit: '♠', rank: 6 }
    ]
    const best = sc.findBestFlush(hand)
    expect(best.length).toBe(4)
    // ensure it's spades (longest)
    expect(best.every(c => c.suit === '♠')).toBe(true)
  })

  it('findLongestStraightFlush returns correct lengths including ace-low wheel', () => {
    // Example 1: A-5-4-3-2 of hearts (ace-low wheel) -> length 5
    const aceLow: sc.Card[] = [
      { suit: '♥', rank: 14 },
      { suit: '♥', rank: 5 },
      { suit: '♥', rank: 4 },
      { suit: '♥', rank: 3 },
      { suit: '♥', rank: 2 }
    ]
    expect(sc.findLongestStraightFlush(aceLow)).toBeGreaterThanOrEqual(5)

    // Example 2: 7-6-5-4 of spades -> length 4
    const straight4: sc.Card[] = [
      { suit: '♠', rank: 7 },
      { suit: '♠', rank: 6 },
      { suit: '♠', rank: 5 },
      { suit: '♠', rank: 4 }
    ]
    expect(sc.findLongestStraightFlush(straight4)).toBeGreaterThanOrEqual(4)

    // Mixed suits should not combine: A♠ K♠ Q♥ J♠ 10♠ -> longest per suit should be 2 (A♠ + J♠ not consecutive)
    const mixed: sc.Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 11 },
      { suit: '♥', rank: 12 },
      { suit: '♠', rank: 10 }
    ]
    expect(sc.findLongestStraightFlush(mixed)).toBeLessThanOrEqual(2)
  })

  it('dealerQualifies rules', () => {
    expect(sc.dealerQualifies([{ suit: '♠', rank: 14 }, { suit: '♠', rank: 13 }, { suit: '♠', rank: 9 }])).toBe(true)
    expect(sc.dealerQualifies([{ suit: '♠', rank: 8 }, { suit: '♠', rank: 7 }, { suit: '♠', rank: 6 }])).toBe(false)
    expect(sc.dealerQualifies([{ suit: '♠', rank: 2 }])).toBe(false)
    expect(sc.dealerQualifies([{ suit: '♠', rank: 10 }, { suit: '♠', rank: 9 }, { suit: '♠', rank: 8 }, { suit: '♠', rank: 7 }])).toBe(true)
  })

  it('compareFlushes prioritizes length then high-card sequence', () => {
    const a: sc.Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 13 },
      { suit: '♠', rank: 12 }
    ]
    const b: sc.Card[] = [
      { suit: '♠', rank: 12 },
      { suit: '♠', rank: 11 }
    ]
    expect(sc.compareFlushes(a, b)).toBeGreaterThan(0) // a longer -> wins

    const c: sc.Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 10 },
      { suit: '♠', rank: 9 }
    ]
    const d: sc.Card[] = [
      { suit: '♠', rank: 13 },
      { suit: '♠', rank: 12 },
      { suit: '♠', rank: 11 }
    ]
    // Same length, compare first differing rank
    expect(sc.compareFlushes(c, d)).toBeGreaterThan(0)
  })

  it('wager and payout helpers behave as expected', () => {
    expect(sc.getMaxPlayWager(7, 1)).toBe(3)
    expect(sc.getMaxPlayWager(5, 2)).toBe(4) // ante 2 *2
    const payoutCfg: sc.PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 50, fiveCard: 20, fourCard: 10 },
      superFlushRush: { sevenCardStraight: 200, sixCardStraight: 100, fiveCardStraight: 50, fourCardStraight: 20, threeCardStraight: 5 }
    }
    expect(sc.calculateFlushRushPayout(7, payoutCfg)).toBe(100)
    expect(sc.calculateFlushRushPayout(3, payoutCfg)).toBe(0)
    expect(sc.calculateSuperFlushRushPayout(5, payoutCfg)).toBe(50)
    expect(sc.calculateSuperFlushRushPayout(2, payoutCfg)).toBe(0)
  })

  it('performSimulation returns well-formed summary for small runs', async () => {
    const payoutCfg: sc.PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 50, fiveCard: 20, fourCard: 10 },
      superFlushRush: { sevenCardStraight: 200, sixCardStraight: 100, fiveCardStraight: 50, fourCardStraight: 20, threeCardStraight: 5 }
    }
    const summary = await sc.performSimulation(10, payoutCfg, 0, sc.mulberry32(123), undefined)
    expect(summary.handDistribution.totalHands).toBe(10)
    expect(Array.isArray(summary.results)).toBe(true)
    expect(summary.results.length).toBeGreaterThanOrEqual(1)
    // Each result should have expected numeric fields
    for (const r of summary.results) {
      expect(typeof r.totalBet).toBe('number')
      expect(typeof r.totalWon).toBe('number')
      expect(typeof r.expectedReturn).toBe('number')
    }
  })
})
