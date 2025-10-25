// simulation-core.ts
// Shared simulation logic (no DOM / Worker APIs) used by main thread and worker.

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14
export interface Card { rank: Rank; suit: Suit }

export interface PayoutConfig {
  flushRush: {
    sevenCard: number
    sixCard: number
    fiveCard: number
    fourCard: number
  }
  superFlushRush: {
    sevenCardStraight: number
    sixCardStraight: number
    fiveCardStraight: number
    fourCardStraight: number
    threeCardStraight: number
  }
}

export interface SimulationResult {
  betType: string
  totalBet: number
  totalWon: number
  expectedReturn: number
  handsWon: number
  handsLost: number
  winRate: number
}

export interface HandDistributionStats {
  totalHands: number
  aboveMinimum: number
  belowMinimum: number
  aboveMinimumPercentage: number
  belowMinimumPercentage: number
}

export type RNG = () => number

// Utilities
export function mulberry32(seed: number): RNG {
  let t = seed >>> 0
  return function() {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function stringToSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffleDeckWithRng(deck: Card[], rng: RNG): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getSuitOrder(suit: Suit): number {
  switch (suit) {
    case '♠': return 0
    case '♥': return 1
    case '♦': return 2
    case '♣': return 3
    default: throw new Error(`Invalid suit: ${suit}`)
  }
}

export function sortHandBySuitThenRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = getSuitOrder(a.suit) - getSuitOrder(b.suit)
    if (suitDiff !== 0) return suitDiff
    return b.rank - a.rank
  })
}

export function findBestFlush(cards: Card[]): Card[] {
  const suitGroups: { [suit: string]: Card[] } = {}
  cards.forEach(card => {
    if (!suitGroups[card.suit]) suitGroups[card.suit] = []
    suitGroups[card.suit].push(card)
  })
  return Object.values(suitGroups).reduce((bestFlush, currentFlush) => {
    return compareFlushes(currentFlush, bestFlush) > 0 ? currentFlush : bestFlush
  }, [] as Card[])
}

export function findLongestStraightFlush(cards: Card[]): Card[] {
  const suitGroups: { [suit: string]: Card[] } = {}
  cards.forEach(card => {
    if (!suitGroups[card.suit]) suitGroups[card.suit] = []
    suitGroups[card.suit].push(card)
  })
  let longestStraightFlush: Card[] = []
  for (const suit in suitGroups) {
    const suitCards = suitGroups[suit].slice().sort((a,b)=>b.rank-a.rank)
    if (suitCards.length < 3) continue
    for (let i = 0; i < suitCards.length; i++) {
      const straight = [suitCards[i]]
      let currentValue = suitCards[i].rank
      for (let j = i + 1; j < suitCards.length; j++) {
        const nextValue = suitCards[j].rank
        if (nextValue === currentValue - 1) {
          straight.push(suitCards[j])
          currentValue = nextValue
        } else if (nextValue < currentValue - 1) {
          break
        }
      }
      if (straight.length > longestStraightFlush.length) {
        longestStraightFlush = straight
      }
    }
    if (suitCards.length > 0 && suitCards[0].rank === 14) {
      const aceCard = suitCards[0]
      const aceLowStraight = [aceCard]
      let expectedRank = 2
      for (let i = suitCards.length - 1; i >= 1 && expectedRank <= 6; i--) {
        if (suitCards[i].rank === expectedRank) {
          aceLowStraight.push(suitCards[i])
          expectedRank++
        } else {
          break
        }
      }
      if (aceLowStraight.length >= 3 && aceLowStraight.length > longestStraightFlush.length) {
        const sortedAceLow = [aceCard, ...aceLowStraight.slice(1).sort((a, b) => a.rank - b.rank)]
        longestStraightFlush = sortedAceLow
      }
    }
  }
  return longestStraightFlush
}

export function dealerQualifies(dealerFlush: Card[]): boolean {
  if (dealerFlush.length > 3) return true
  if (dealerFlush.length < 3) return false
  return dealerFlush[0].rank >= 9
}

export function compareFlushes(firstFlush: Card[], secondFlush: Card[]): number {
  const lengthDiff = firstFlush.length - secondFlush.length
  if (lengthDiff !== 0) return lengthDiff
  for (let i = 0; i < Math.min(firstFlush.length, secondFlush.length); i++) {
    const firstValue = firstFlush[i].rank
    const secondValue = secondFlush[i].rank
    const rankDiff = firstValue - secondValue
    if (rankDiff !== 0) return rankDiff
  }
  return 0
}

export function getMaxPlayWager(flushCards: number, anteAmount: number): number {
  if (flushCards >= 6) return anteAmount * 3
  if (flushCards >= 5) return anteAmount * 2
  return anteAmount * 1
}

export function calculateFlushRushPayout(flushCards: number, payoutConfig: PayoutConfig): number {
  if (flushCards >= 7) return payoutConfig.flushRush.sevenCard
  if (flushCards >= 6) return payoutConfig.flushRush.sixCard
  if (flushCards >= 5) return payoutConfig.flushRush.fiveCard
  if (flushCards >= 4) return payoutConfig.flushRush.fourCard
  return 0
}

export function calculateSuperFlushRushPayout(straightFlushCards: number, payoutConfig: PayoutConfig): number {
  if (straightFlushCards >= 7) return payoutConfig.superFlushRush.sevenCardStraight
  if (straightFlushCards >= 6) return payoutConfig.superFlushRush.sixCardStraight
  if (straightFlushCards >= 5) return payoutConfig.superFlushRush.fiveCardStraight
  if (straightFlushCards >= 4) return payoutConfig.superFlushRush.fourCardStraight
  if (straightFlushCards >= 3) return payoutConfig.superFlushRush.threeCardStraight
  return 0
}

export interface SimulationSummary {
  results: SimulationResult[]
  handDistribution: HandDistributionStats
}

export async function performSimulation(
  numHands: number,
  payoutConfig: PayoutConfig,
  minThreeCardFlushRank: number,
  rng: RNG,
  onProgress?: (progress: number) => void
): Promise<SimulationSummary> {
  const anteAmount = 1
  const flushRushBet = 1
  const superFlushRushBet = 1
  const betTotals: { [key: string]: { totalBet: number; totalWon: number; handsWon: number; handsLost: number } } = {
    'Base Game (Ante + Play)': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
    'Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
    'Super Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 }
  }
  let handsAboveMinimum = 0
  let handsBelowMinimum = 0

  const deck = createDeck()
  const updateFrequency = Math.max(1, Math.floor(numHands / 100))

  for (let hand = 0; hand < numHands; hand++) {
    const shuffledDeck = shuffleDeckWithRng(deck, rng)
    const playerHand = sortHandBySuitThenRank(shuffledDeck.slice(0, 7))
    const dealerHand = sortHandBySuitThenRank(shuffledDeck.slice(7, 14))
    const playerFlush = findBestFlush(playerHand)
    const dealerFlush = findBestFlush(dealerHand)
    const playerStraightFlush = findLongestStraightFlush(playerHand)
    const highCardValue = playerFlush.length > 0 ? playerFlush[0].rank : 0
    const shouldFold = playerFlush.length < 3 || (playerFlush.length === 3 && minThreeCardFlushRank !== 0 && highCardValue < minThreeCardFlushRank)

    if (shouldFold) handsBelowMinimum++
    else handsAboveMinimum++

    const dealerQualified = dealerQualifies(dealerFlush)

    if (shouldFold) {
      betTotals['Base Game (Ante + Play)'].totalBet += anteAmount
      betTotals['Base Game (Ante + Play)'].handsLost++
    } else {
      const playWager = getMaxPlayWager(playerFlush.length, anteAmount)
      const totalWager = anteAmount + playWager
      betTotals['Base Game (Ante + Play)'].totalBet += totalWager

      if (!dealerQualified) {
        betTotals['Base Game (Ante + Play)'].totalWon += totalWager + anteAmount
        betTotals['Base Game (Ante + Play)'].handsWon++
      } else {
        const comparison = compareFlushes(playerFlush, dealerFlush)
        if (comparison > 0) {
          betTotals['Base Game (Ante + Play)'].totalWon += totalWager + totalWager
          betTotals['Base Game (Ante + Play)'].handsWon++
        } else if (comparison < 0) {
          betTotals['Base Game (Ante + Play)'].handsLost++
        } else {
          betTotals['Base Game (Ante + Play)'].totalWon += totalWager
        }
      }
    }

    const flushRushMultiplier = calculateFlushRushPayout(playerFlush.length, payoutConfig)
    const flushRushPayout = flushRushMultiplier > 0 ? flushRushBet * flushRushMultiplier : 0
    betTotals['Flush Rush Bonus'].totalBet += flushRushBet
    if (flushRushPayout > 0) {
      betTotals['Flush Rush Bonus'].totalWon += flushRushBet + flushRushPayout
      betTotals['Flush Rush Bonus'].handsWon++
    } else {
      betTotals['Flush Rush Bonus'].handsLost++
    }

    const superFlushRushMultiplier = calculateSuperFlushRushPayout(playerStraightFlush.length, payoutConfig)
    const superFlushRushPayout = superFlushRushMultiplier > 0 ? superFlushRushBet * superFlushRushMultiplier : 0
    betTotals['Super Flush Rush Bonus'].totalBet += superFlushRushBet
    if (superFlushRushPayout > 0) {
      betTotals['Super Flush Rush Bonus'].totalWon += superFlushRushBet + superFlushRushPayout
      betTotals['Super Flush Rush Bonus'].handsWon++
    } else {
      betTotals['Super Flush Rush Bonus'].handsLost++
    }

    if (onProgress && hand % updateFrequency === 0) {
      const progress = (hand / numHands) * 100
      onProgress(progress)
      // yield to event loop briefly
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  const simulationResults: SimulationResult[] = Object.keys(betTotals).map(betType => {
    const data = betTotals[betType]
    const expectedReturn = ((data.totalWon - data.totalBet) / data.totalBet) * 100
    const winRate = (data.handsWon / (data.handsWon + data.handsLost)) * 100
    return {
      betType,
      totalBet: data.totalBet,
      totalWon: data.totalWon,
      expectedReturn,
      handsWon: data.handsWon,
      handsLost: data.handsLost,
      winRate
    }
  })

  const handDistributionStats: HandDistributionStats = {
    totalHands: numHands,
    aboveMinimum: handsAboveMinimum,
    belowMinimum: handsBelowMinimum,
    aboveMinimumPercentage: (handsAboveMinimum / numHands) * 100,
    belowMinimumPercentage: (handsBelowMinimum / numHands) * 100
  }

  return {
    results: simulationResults,
    handDistribution: handDistributionStats
  }
}
