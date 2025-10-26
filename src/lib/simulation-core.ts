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

export class BetResults {
  totalBet: number
  totalWon: number
  handsWon: number
  handsLost: number

  constructor() {
    this.totalBet = 0
    this.totalWon = 0
    this.handsWon = 0
    this.handsLost = 0
  }

  // Record a win
  recordWin(bet: number, won: number) {
    this.handsWon++
    this.totalBet += bet
    this.totalWon += bet + won // Include returned bet
  }

  // Record a loss
  recordLoss(bet: number) {
    this.handsLost++
    this.totalBet += bet
  }

  // Record a push
  recordPush(bet: number) {
    this.totalBet += bet
    this.totalWon += bet // Return bet
  }
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

// Returns an arbitrary numeric order for suits for sorting
export function getSuitOrder(suit: Suit): number {
  switch (suit) {
    case '♠': return 0
    case '♥': return 1
    case '♦': return 2
    case '♣': return 3
    default: throw new Error(`Invalid suit: ${suit}`)
  }
}

// Sorts cards by suit (♠, ♥, ♦, ♣) then by descending rank
export function sortHandBySuitThenRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = getSuitOrder(a.suit) - getSuitOrder(b.suit)
    if (suitDiff !== 0) return suitDiff
    return b.rank - a.rank
  })
}

// Returns the best flush in the hand
// Assumes cards are sorted by suit then descending rank
// Returned flush is also sorted by descending rank
export function findBestFlush(cards: Card[]): Card[] {
  const suitGroups = divideHandIntoSuits(cards)
  return Object.values(suitGroups).reduce((bestFlush, currentFlush) => {
    return compareFlushes(currentFlush, bestFlush) > 0 ? currentFlush : bestFlush
  }, [] as Card[])
}

// Returns the length of the longest straight flush in the hand
// Assumes cards are sorted by suit then descending rank
export function findLongestStraightFlush(cards: Card[]): number {
  const suitGroups = divideHandIntoSuits(cards);
  let longest = 0;

  for (const suit in suitGroups) {
    const flush = suitGroups[suit];
    if (flush.length < 1) continue;
    longest = Math.max(longest, findLongestStraight(flush));
    longest = Math.max(longest, findLowAceStraight(flush))
  }
  return longest
}

// Returns the length of the longest straight considering Ace as low (1)
// Assumes flush is sorted in descending order
export function findLowAceStraight(flush: Card[]): number {
  if (flush.length === 0) return 0
  let longest = 0;
  // If there is an Ace, check for 2, 3, ... at the end.
  if (highCard(flush) === 14) {
    let length = 1;
    let i = flush.length; // Pretend like the Ace is after the end
    let prev = 1; // Start with low Ace
    while (i > 0) {
      const current = flush[i - 1].rank;
      if (current === prev + 1) {
        length++;
      } else {
        // Not consecutive, save this result and reset
        longest = Math.max(longest, length);
        length = 1;
      }
      prev = current;
      i--;
    }
    longest = Math.max(longest, length);
  }
  return longest
}

// Returns the length of the longest straight considering Ace high (14)
// Assumes flush is sorted in descending order
export function findLongestStraight(flush: Card[]): number {
  if (flush.length === 0) return 0
  let longest = 0
  let length = 1
  let i = 1
  let prev = flush[0].rank
  while (i < flush.length) {
    const current = flush[i].rank;
    if (current === prev - 1) {
      length++;
    } else {
      // Not consecutive, save this result and reset
      longest = Math.max(longest, length);
      length = 1;
    }
    prev = current;
    i++;
  }
  longest = Math.max(longest, length);
  return longest
}

// Divides a hand into suits, returns an object mapping suit to array of cards sorted by descending rank
// Assumes cards are sorted by suit then descending rank
export function divideHandIntoSuits(cards: Card[]): { [suit: string]: Card[]; } {
  const suitGroups: { [suit: string]: Card[]; } = {};
  cards.forEach(card => {
    if (!suitGroups[card.suit]) suitGroups[card.suit] = [];
    suitGroups[card.suit].push(card);
  });
  return suitGroups;
}

// Dealer qualifies with more than 3 cards or with 3 cards and high card 9 or above
// Assumes flush is sorted by descending rank
export function dealerQualifies(flush: Card[]): boolean {
  if (flush.length > 3) return true
  if (flush.length < 3) return false
  return highCard(flush) >= 9
}

// Compares two flushes, returns positive if firstFlush is better, negative if secondFlush is better, zero if equal
// Assumes flushes are sorted by descending rank
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

// Returns the maximum play wager based on number of flush cards
export function getMaxPlayWager(flushCards: number, anteAmount: number): number {
  if (flushCards >= 6) return anteAmount * 3
  if (flushCards >= 5) return anteAmount * 2
  return anteAmount * 1
}

// Returns the Flush Rush payout multiplier based on number of flush cards
export function calculateFlushRushPayout(flushCards: number, payoutConfig: PayoutConfig): number {
  if (flushCards >= 7) return payoutConfig.flushRush.sevenCard
  if (flushCards >= 6) return payoutConfig.flushRush.sixCard
  if (flushCards >= 5) return payoutConfig.flushRush.fiveCard
  if (flushCards >= 4) return payoutConfig.flushRush.fourCard
  return 0
}

// Returns the Super Flush Rush payout multiplier based on length of straight flush
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
  const betTotals: { [key: string]: BetResults } = {
    'Base Game (Ante + Play)': new BetResults(),
    'Flush Rush Bonus': new BetResults(),
    'Super Flush Rush Bonus': new BetResults()
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

    if (playerShouldFold(playerFlush, minThreeCardFlushRank)) {
      // Player folds
      handsBelowMinimum++
      betTotals['Base Game (Ante + Play)'].recordLoss(anteAmount)
    } else {
      // Player plays
      handsAboveMinimum++
      const playWager = getMaxPlayWager(playerFlush.length, anteAmount)
      const totalWager = anteAmount + playWager

      if (dealerQualifies(dealerFlush)) {
        const comparison = compareFlushes(playerFlush, dealerFlush)
        if (comparison > 0) {
          betTotals['Base Game (Ante + Play)'].recordWin(totalWager, totalWager)
        } else if (comparison < 0) {
          betTotals['Base Game (Ante + Play)'].recordLoss(totalWager)
        } else {
          betTotals['Base Game (Ante + Play)'].recordPush(totalWager)
        }
      } else {
        betTotals['Base Game (Ante + Play)'].recordWin(totalWager, anteAmount)
      }
    }

    const flushRushMultiplier = calculateFlushRushPayout(playerFlush.length, payoutConfig)
    const flushRushPayout = flushRushMultiplier > 0 ? flushRushBet * flushRushMultiplier : 0
    if (flushRushPayout > 0) {
      betTotals['Flush Rush Bonus'].recordWin(flushRushBet, flushRushPayout)
    } else {
      betTotals['Flush Rush Bonus'].recordLoss(flushRushBet)
    }

    const playerStraightLength = findLongestStraightFlush(playerHand)
    const superFlushRushMultiplier = calculateSuperFlushRushPayout(playerStraightLength, payoutConfig)
    const superFlushRushPayout = superFlushRushMultiplier > 0 ? superFlushRushBet * superFlushRushMultiplier : 0
    if (superFlushRushPayout > 0) {
      betTotals['Super Flush Rush Bonus'].recordWin(superFlushRushBet, superFlushRushPayout)
    } else {
      betTotals['Super Flush Rush Bonus'].recordLoss(superFlushRushBet)
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

// Returns the high card rank from the flush, or 0 if flush is empty
// Assumes flush is sorted by descending rank
export function highCard(flush: Card[]): number {
  return flush.length > 0 ? flush[0].rank : 0;
}

// Returns true if player should fold based on flush and minimum rank
// Assumes flush is sorted by descending rank
export function playerShouldFold(flush: Card[], minRank: number): boolean {
  return flush.length < 3 || (flush.length === 3 && minRank !== 0 && highCard(flush) < minRank);
}
