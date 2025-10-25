// simulation.ts
// Core simulation logic for I Luv Suits Poker

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

export interface ThreeCardFlushStats {
  highCards: string
  totalHands: number
  wins: number
  losses: number
  winRate: number
}

export interface HandDistributionStats {
  totalHands: number
  aboveMinimum: number
  belowMinimum: number
  aboveMinimumPercentage: number
  belowMinimumPercentage: number
}

// Returns a standard sorted 52-card deck
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

// Shuffles a deck of cards using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Returns a string representation of the rank
export function getRankDisplay(rank: Rank): string {
  if (rank === 14) return 'A'
  if (rank === 13) return 'K'
  if (rank === 12) return 'Q'
  if (rank === 11) return 'J'
  return rank.toString()
}

// Returns a numeric order for suits for sorting purposes
export function getSuitOrder(suit: Suit): number {
  // Order: Spades, Hearts, Diamonds, Clubs
  switch (suit) {
    case '♠': return 0
    case '♥': return 1
    case '♦': return 2
    case '♣': return 3
    default: return 4
  }
}

// Sorts cards first by suit (Spades, Hearts, Diamonds, Clubs) then by rank (highest to lowest)
export function sortHandBySuitThenRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    // First sort by suit
    const suitDiff = getSuitOrder(a.suit) - getSuitOrder(b.suit)
    if (suitDiff !== 0) return suitDiff
    // Then sort by rank (highest to lowest)
    return b.rank - a.rank
  })
}

// Returns the best flush in the given hand of cards
export function findBestFlush(cards: Card[]): Card[] {
  // Extract cards by suit
  const suitGroups: { [suit: string]: Card[] } = {}
  // Cards are already sorted by suit then rank, so the order of the ranks within each suit is preserved
  cards.forEach(card => {
    if (!suitGroups[card.suit]) suitGroups[card.suit] = []
    suitGroups[card.suit].push(card)
  })

  // Find the best flush among all suit groups using reduce and compareFlushes
  return Object.values(suitGroups).reduce((bestFlush, currentFlush) => {
    return compareFlushes(currentFlush, bestFlush) > 0 ? currentFlush : bestFlush
  }, [] as Card[])
}

// Returns the longest straight flush in the given hand of cards
export function findLongestStraightFlush(cards: Card[]): Card[] {
  const suitGroups: { [suit: string]: Card[] } = {}
  cards.forEach(card => {
    if (!suitGroups[card.suit]) suitGroups[card.suit] = []
    suitGroups[card.suit].push(card)
  })
  let longestStraightFlush: Card[] = []
  for (const suit in suitGroups) {
    // Cards are already sorted by rank (highest to lowest)
    const suitCards = suitGroups[suit]
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
    
    // Check for A-low straight (A-2-3-...) - special case
    // If an ace is present, it will be the first element since cards are sorted highest to lowest
    if (suitCards.length > 0 && suitCards[0].rank === 14) {
      const aceCard = suitCards[0]
      const aceLowStraight = [aceCard]
      
      // Look for consecutive cards 2 through 6 by checking from the end of the array
      // Since cards are sorted highest to lowest, lower ranks will be at the end
      let expectedRank = 2
      for (let i = suitCards.length - 1; i >= 1 && expectedRank <= 6; i--) {
        if (suitCards[i].rank === expectedRank) {
          aceLowStraight.push(suitCards[i])
          expectedRank++
        } else {
          // We've gone past the expected rank, no point checking further
          break
        }
      }
      
      if (aceLowStraight.length >= 3 && aceLowStraight.length > longestStraightFlush.length) {
        // Sort the ace-low straight to maintain A-2-3-4-5-6-7 order
        const sortedAceLow = [aceCard, ...aceLowStraight.slice(1).sort((a, b) => a.rank - b.rank)]
        longestStraightFlush = sortedAceLow
      }
    }
  }
  return longestStraightFlush
}

// Returns true if the dealer qualifies with at least a 3-card flush and highest card 9 or above
export function dealerQualifies(dealerFlush: Card[]): boolean {
  if (dealerFlush.length > 3)
    return true
  else if (dealerFlush.length < 3)
    return false
  else 
    return dealerFlush[0].rank >= 9
}

// Compares two flushes and returns a positive number if the first is better, negative if the second is better, or 0 if they are equal
export function compareFlushes(firstFlush: Card[], secondFlush: Card[]): number {
  const lengthDiff = firstFlush.length - secondFlush.length
  if (lengthDiff !== 0) return lengthDiff
  // Cards in each flush are already sorted by rank (highest to lowest) and assumed to be the same suit
  for (let i = 0; i < Math.min(firstFlush.length, secondFlush.length); i++) {
    const firstValue = firstFlush[i].rank
    const secondValue = secondFlush[i].rank
    const rankDiff = firstValue - secondValue
    if (rankDiff !== 0) return rankDiff
  }
  return 0
}

// Determines the play wager based on the player's best flush
// Returns 0 if the player should fold
// Note: The wager amount is predetermined for simulation purposes. It is not necessarily the optimal strategy.
export function getPlayWager(flushCards: number, highCardValue: number, anteAmount: number, minThreeCardFlushRank: number): number {
  if (flushCards >= 6) return anteAmount * 3
  if (flushCards >= 5) return anteAmount * 2
  if (flushCards >= 3 && highCardValue >= minThreeCardFlushRank) return anteAmount * 1
  return 0
}

// Returns the Flush Rush payout multiplier based on the number of flush cards
export function calculateFlushRushPayout(flushCards: number, payoutConfig: PayoutConfig): number {
  if (flushCards >= 7) return payoutConfig.flushRush.sevenCard
  if (flushCards >= 6) return payoutConfig.flushRush.sixCard
  if (flushCards >= 5) return payoutConfig.flushRush.fiveCard
  if (flushCards >= 4) return payoutConfig.flushRush.fourCard
  return 0
}

// Returns the Super Flush Rush payout multiplier based on the number of straight flush cards
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
  threeCardFlushStats: ThreeCardFlushStats[]
  handDistribution: HandDistributionStats
}

export async function simulateHands(
  numHands: number,
  payoutConfig: PayoutConfig,
  minThreeCardFlushRank: number,
  setProgress?: (progress: number) => void
): Promise<SimulationSummary> {
  const anteAmount = 1
  const flushRushBet = 1
  const superFlushRushBet = 1
  const betTotals: { [key: string]: { totalBet: number; totalWon: number; handsWon: number; handsLost: number } } = {
    'Base Game (Ante + Play)': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
    'Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
    'Super Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 }
  }
  const threeCardStats: { [key: string]: { wins: number; losses: number; total: number } } = {}
  let handsAboveMinimum = 0
  let handsBelowMinimum = 0
  const deck = createDeck()
  for (let hand = 0; hand < numHands; hand++) {
    const shuffledDeck = shuffleDeck(deck)
    const playerCards = sortHandBySuitThenRank(shuffledDeck.slice(0, 7))
    const dealerCards = sortHandBySuitThenRank(shuffledDeck.slice(7, 14))
    const playerBestFlush = findBestFlush(playerCards)
    const dealerBestFlush = findBestFlush(dealerCards)
    const playerStraightFlush = findLongestStraightFlush(playerCards)
    const highCardValue = playerBestFlush.length > 0 ? playerBestFlush[0].rank : 0
    const playWager = getPlayWager(playerBestFlush.length, highCardValue, anteAmount, minThreeCardFlushRank)
    const shouldFold = playWager === 0
    if (shouldFold)
      handsBelowMinimum++
    else
      handsAboveMinimum++
    if (playerBestFlush.length === 3) {
      // Cards are already sorted by suit then rank (highest to lowest)
      const highestCard = playerBestFlush[0]
      const secondHighestCard = playerBestFlush[1]
      const highestValue = highestCard.rank
      if (highestValue >= minThreeCardFlushRank) {
        const twoHighestKey = `${getRankDisplay(highestCard.rank)}-${getRankDisplay(secondHighestCard.rank)}`
        if (!threeCardStats[twoHighestKey]) threeCardStats[twoHighestKey] = { wins: 0, losses: 0, total: 0 }
        threeCardStats[twoHighestKey].total++
      }
    }
    const dealerQualified = dealerQualifies(dealerBestFlush)
    // Must decide to fold or play before knowing if dealer qualifies
    if (shouldFold) {
      // Folding means losing the ante bet
      betTotals['Base Game (Ante + Play)'].totalBet += anteAmount
      betTotals['Base Game (Ante + Play)'].handsLost++
    } else {
      // Playing means risking both ante and play wagers
      const totalWager = anteAmount + playWager
      betTotals['Base Game (Ante + Play)'].totalBet += totalWager
      // If dealer does not qualify, player wins ante bet only
      if (!dealerQualified) {
        betTotals['Base Game (Ante + Play)'].totalWon += totalWager + anteAmount
        betTotals['Base Game (Ante + Play)'].handsWon++
        if (playerBestFlush.length === 3) {
          // Cards are already sorted by suit then rank (highest to lowest)
          const highestCard = playerBestFlush[0]
          const secondHighestCard = playerBestFlush[1]
          const highestValue = highestCard.rank
          if (highestValue >= minThreeCardFlushRank) {
            const twoHighestKey = `${getRankDisplay(highestCard.rank)}-${getRankDisplay(secondHighestCard.rank)}`
            if (threeCardStats[twoHighestKey]) threeCardStats[twoHighestKey].wins++
          }
        }
      // If dealer qualifies, compare flushes
      } else {
        const comparison = compareFlushes(playerBestFlush, dealerBestFlush)
        // If the player wins, they get their total wager (ante + play)
        if (comparison > 0) {
          betTotals['Base Game (Ante + Play)'].totalWon += totalWager + totalWager
          betTotals['Base Game (Ante + Play)'].handsWon++
          if (playerBestFlush.length === 3) {
            // Cards are already sorted by suit then rank (highest to lowest)
            const highestCard = playerBestFlush[0]
            const secondHighestCard = playerBestFlush[1]
            const highestValue = highestCard.rank
            if (highestValue >= minThreeCardFlushRank) {
              const twoHighestKey = `${getRankDisplay(highestCard.rank)}-${getRankDisplay(secondHighestCard.rank)}`
              if (threeCardStats[twoHighestKey]) threeCardStats[twoHighestKey].wins++
            }
          }
        // If the dealer wins, the player loses their total wager
        } else if (comparison < 0) {
          betTotals['Base Game (Ante + Play)'].handsLost++
          if (playerBestFlush.length === 3) {
            // Cards are already sorted by suit then rank (highest to lowest)
            const highestCard = playerBestFlush[0]
            const secondHighestCard = playerBestFlush[1]
            const highestValue = highestCard.rank
            if (highestValue >= minThreeCardFlushRank) {
              const twoHighestKey = `${getRankDisplay(highestCard.rank)}-${getRankDisplay(secondHighestCard.rank)}`
              if (threeCardStats[twoHighestKey]) threeCardStats[twoHighestKey].losses++
            }
          }
        } else {
          // Tie is a push - player gets back their total wager
          betTotals['Base Game (Ante + Play)'].totalWon += totalWager
        }
      }
    }
    const flushRushMultiplier = calculateFlushRushPayout(playerBestFlush.length, payoutConfig)
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
    if (setProgress) {
      const updateFrequency = Math.max(1, Math.floor(numHands / 100))
      if (hand % updateFrequency === 0) {
        const progress = (hand / numHands) * 100
        setProgress(progress)
        await new Promise(resolve => setTimeout(resolve, 1))
      }
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
  const threeCardFlushResults: ThreeCardFlushStats[] = Object.keys(threeCardStats)
    .sort((a, b) => {
      const [aFirst, aSecond] = a.split('-')
      const [bFirst, bSecond] = b.split('-')
      // Convert display strings back to numeric values for sorting
      const aFirstValue = aFirst === 'A' ? 14 : aFirst === 'K' ? 13 : aFirst === 'Q' ? 12 : aFirst === 'J' ? 11 : parseInt(aFirst)
      const bFirstValue = bFirst === 'A' ? 14 : bFirst === 'K' ? 13 : bFirst === 'Q' ? 12 : bFirst === 'J' ? 11 : parseInt(bFirst)
      if (aFirstValue !== bFirstValue) return bFirstValue - aFirstValue
      const aSecondValue = aSecond === 'A' ? 14 : aSecond === 'K' ? 13 : aSecond === 'Q' ? 12 : aSecond === 'J' ? 11 : parseInt(aSecond)
      const bSecondValue = bSecond === 'A' ? 14 : bSecond === 'K' ? 13 : bSecond === 'Q' ? 12 : bSecond === 'J' ? 11 : parseInt(bSecond)
      return bSecondValue - aSecondValue
    })
    .map(highCards => {
      const stats = threeCardStats[highCards]
      return {
        highCards,
        totalHands: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.total > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0
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
    threeCardFlushStats: threeCardFlushResults,
    handDistribution: handDistributionStats
  }
}
