import { describe, it, expect } from 'vitest'
import {
  mulberry32,
  stringToSeed,
  createDeck,
  shuffleDeckWithRng,
  sortHandBySuitThenRank,
  getSuitOrder,
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
  BetResults,
  PayoutConfig,
  Card,
  Suit,
  Rank
} from '../simulation-core'

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
    expect(len1).toBe(5)

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

  it('produces deterministic results for same seed', async () => {
    const cfg: PayoutConfig = {
      flushRush: { sevenCard: 100, sixCard: 20, fiveCard: 10, fourCard: 2 },
      superFlushRush: { sevenCardStraight: 500, sixCardStraight: 200, fiveCardStraight: 100, fourCardStraight: 50, threeCardStraight: 9 }
    }
    const summary1 = await performSimulation(50, cfg, 9, mulberry32(12345))
    const summary2 = await performSimulation(50, cfg, 9, mulberry32(12345))
    
    expect(summary1.handDistribution).toEqual(summary2.handDistribution)
    expect(summary1.results).toEqual(summary2.results)
  })

  it('returns properly sorted arrays from sorting helpers', () => {
    // Unsorted hand (mixed suits and ranks)
    const unsorted: Card[] = [
      { suit: '♥', rank: 2 },
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 10 },
      { suit: '♣', rank: 13 },
      { suit: '♥', rank: 11 },
      { suit: '♠', rank: 9 },
      { suit: '♣', rank: 2 }
    ]

    const sorted = sortHandBySuitThenRank(unsorted)

    // Verify overall suit ordering is non-decreasing according to getSuitOrder
    for (let i = 1; i < sorted.length; i++) {
      const prevSuitOrder = getSuitOrder(sorted[i - 1].suit)
      const curSuitOrder = getSuitOrder(sorted[i].suit)
      expect(prevSuitOrder).toBeLessThanOrEqual(curSuitOrder)
      // If same suit, ranks should be non-increasing
      if (prevSuitOrder === curSuitOrder) {
        expect(sorted[i - 1].rank).toBeGreaterThanOrEqual(sorted[i].rank)
      }
    }

    // Use the sorted hand to derive suit groups
    const groups = divideHandIntoSuits(sorted)
    // Each group's cards should be sorted descending by rank
    for (const suitKey of Object.keys(groups)) {
      const arr = groups[suitKey]
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i - 1].rank).toBeGreaterThanOrEqual(arr[i].rank)
      }
    }

    // Ensure findBestFlush returns a flush with same suit and descending ranks
    const handWithFlush: Card[] = [
      { suit: '♠', rank: 14 },
      { suit: '♠', rank: 13 },
      { suit: '♠', rank: 11 },
      { suit: '♥', rank: 12 },
      { suit: '♦', rank: 10 },
      { suit: '♣', rank: 9 }
    ]

    const sortedFlushHand = sortHandBySuitThenRank(handWithFlush)
    const bestFlush = findBestFlush(sortedFlushHand)
    if (bestFlush.length > 0) {
      const suit = bestFlush[0].suit
      expect(bestFlush.every(c => c.suit === suit)).toBe(true)
      for (let i = 1; i < bestFlush.length; i++) {
        expect(bestFlush[i - 1].rank).toBeGreaterThanOrEqual(bestFlush[i].rank)
      }
    }
  })
})
