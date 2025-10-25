import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Play, ChartBar, TrendDown, TrendUp, Gear } from '@phosphor-icons/react'

// Static data moved outside component to avoid recreation on each render
const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const highCardNames = ['Jack', 'Queen', 'King', 'Ace']

interface PayoutConfig {
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

interface SimulationResult {
  betType: string
  totalBet: number
  totalWon: number
  expectedReturn: number
  handsWon: number
  handsLost: number
  winRate: number
}

interface ThreeCardFlushStats {
  highCards: string
  totalHands: number
  wins: number
  losses: number
  winRate: number
}

interface HandDistributionStats {
  totalHands: number
  aboveMinimum: number
  belowMinimum: number
  aboveMinimumPercentage: number
  belowMinimumPercentage: number
}

function App() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [threeCardFlushStats, setThreeCardFlushStats] = useState<ThreeCardFlushStats[]>([])
  const [handDistribution, setHandDistribution] = useState<HandDistributionStats | null>(null)
  const [numHands, setNumHands] = useState(1000000)
  const [minThreeCardFlushRank, setMinThreeCardFlushRank] = useState(9) // Minimum high card value for 3-card flush
  
  const [payoutConfig, setPayoutConfig] = useState<PayoutConfig>({
    flushRush: {
      sevenCard: 100,
      sixCard: 20,
      fiveCard: 10,
      fourCard: 2
    },
    superFlushRush: {
      sevenCardStraight: 500,
      sixCardStraight: 200,
      fiveCardStraight: 100,
      fourCardStraight: 50,
      threeCardStraight: 9
    }
  })

  const getMinFlushDisplayText = () => {
    if (minThreeCardFlushRank >= 11) {
      return highCardNames[minThreeCardFlushRank - 11]
    }
    return minThreeCardFlushRank.toString()
  }

  const gameRules = `I Luv Suits Poker is a seven (7) card poker game that lets players play against the dealer using seven (7) cards per player. The goal is to get a higher ranking flush with more flush cards than the dealer. There is a qualifier of a three (3) card nine-high flush for the dealer.

Game Rules:
• Player makes an Ante wager and receives 7 cards
• Player can make a Play wager of 1-3x their Ante depending on how many flush cards they have:
  - More flush cards = higher play wager (1x to 3x Ante)
  - Player may fold their hand instead
• Current Strategy: Only play 3-card flush if high card is ${getMinFlushDisplayText()} or higher
• Dealer needs 3-card nine-high flush minimum to qualify
• If player's hand beats dealer's qualifying hand, player wins
• If dealer doesn't qualify: Ante pays even money, Play pushes
• If dealer qualifies and player wins: Both Ante and Play pay even money
• If dealer qualifies and dealer wins: Both Ante and Play lose

Bonus Bets (optional):
• Flush Rush Bonus: Pays based on player's flush cards (4+ to win)
• Super Flush Rush Bonus: Pays based on player's straight flush cards (3+ to win)
• Bonus bets win/lose regardless of base game outcome`

  const createDeck = (): { rank: string; suit: string }[] => {
    const deck: { rank: string; suit: string }[] = []
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit })
      }
    }
    return deck
  }

  const shuffleDeck = (deck: { rank: string; suit: string }[]) => {
    const shuffled = [...deck]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const getRankValue = (rank: string): number => {
    if (rank === 'A') return 14
    if (rank === 'K') return 13
    if (rank === 'Q') return 12
    if (rank === 'J') return 11
    return parseInt(rank)
  }

  const findLongestFlush = (cards: { rank: string; suit: string }[]) => {
    const suitGroups: { [suit: string]: { rank: string; suit: string }[] } = {}
    
    cards.forEach(card => {
      if (!suitGroups[card.suit]) {
        suitGroups[card.suit] = []
      }
      suitGroups[card.suit].push(card)
    })

    let longestFlush: { rank: string; suit: string }[] = []
    for (const suit in suitGroups) {
      if (suitGroups[suit].length > longestFlush.length) {
        longestFlush = suitGroups[suit].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
      }
    }

    return longestFlush
  }

  const findLongestStraightFlush = (cards: { rank: string; suit: string }[]) => {
    const suitGroups: { [suit: string]: { rank: string; suit: string }[] } = {}
    
    cards.forEach(card => {
      if (!suitGroups[card.suit]) {
        suitGroups[card.suit] = []
      }
      suitGroups[card.suit].push(card)
    })

    let longestStraightFlush: { rank: string; suit: string }[] = []

    for (const suit in suitGroups) {
      const suitCards = suitGroups[suit].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank))
      
      if (suitCards.length < 3) continue

      // Find longest straight in this suit
      for (let i = 0; i < suitCards.length; i++) {
        const straight = [suitCards[i]]
        let currentValue = getRankValue(suitCards[i].rank)
        
        for (let j = i + 1; j < suitCards.length; j++) {
          const nextValue = getRankValue(suitCards[j].rank)
          if (nextValue === currentValue + 1) {
            straight.push(suitCards[j])
            currentValue = nextValue
          } else if (nextValue > currentValue + 1) {
            break
          }
        }

        if (straight.length > longestStraightFlush.length) {
          longestStraightFlush = straight
        }
      }

      // Check for A-2-3-4-5 straight (wheel)
      const hasAce = suitCards.some(c => c.rank === 'A')
      const hasTwo = suitCards.some(c => c.rank === '2')
      const hasThree = suitCards.some(c => c.rank === '3')
      const hasFour = suitCards.some(c => c.rank === '4')
      const hasFive = suitCards.some(c => c.rank === '5')
      
      if (hasAce && hasTwo && hasThree && hasFour && hasFive) {
        const wheelStraight = suitCards.filter(c => ['A', '2', '3', '4', '5'].includes(c.rank))
        if (wheelStraight.length >= longestStraightFlush.length) {
          longestStraightFlush = wheelStraight
        }
      }
    }

    return longestStraightFlush
  }

  const dealerQualifies = (dealerFlush: { rank: string; suit: string }[]): boolean => {
    if (dealerFlush.length < 3) return false
    
    // Check if it's at least nine-high (9 or higher as the highest card)
    const highestCard = Math.max(...dealerFlush.map(card => getRankValue(card.rank)))
    return highestCard >= 9
  }

  const compareFlushes = (playerFlush: { rank: string; suit: string }[], dealerFlush: { rank: string; suit: string }[]): 'win' | 'lose' | 'push' => {
    // First compare by number of cards
    if (playerFlush.length > dealerFlush.length) return 'win'
    if (playerFlush.length < dealerFlush.length) return 'lose'
    
    // Same number of cards, compare high cards
    const playerSorted = [...playerFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
    const dealerSorted = [...dealerFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
    
    for (let i = 0; i < Math.min(playerSorted.length, dealerSorted.length); i++) {
      const playerValue = getRankValue(playerSorted[i].rank)
      const dealerValue = getRankValue(dealerSorted[i].rank)
      
      if (playerValue > dealerValue) return 'win'
      if (playerValue < dealerValue) return 'lose'
    }
    
    return 'push'
  }

  const getOptimalPlayWager = (flushCards: number, highCardValue: number, anteAmount: number): number => {
    // Strategy: Play wager varies based on flush strength
    if (flushCards >= 6) return anteAmount * 3  // Strong flush - max bet
    if (flushCards >= 4) return anteAmount * 2  // Good flush - moderate bet
    if (flushCards === 3) {
      // Only play 3-card flush if high card meets minimum threshold
      if (highCardValue >= minThreeCardFlushRank) return anteAmount * 1
      return 0 // Fold if high card is less than minimum
    }
    return 0 // Fold with 0-2 flush cards
  }

  const calculateFlushRushPayout = (flushCards: number): number => {
    if (flushCards >= 7) return payoutConfig.flushRush.sevenCard
    if (flushCards >= 6) return payoutConfig.flushRush.sixCard
    if (flushCards >= 5) return payoutConfig.flushRush.fiveCard
    if (flushCards >= 4) return payoutConfig.flushRush.fourCard
    return 0
  }

  const calculateSuperFlushRushPayout = (straightFlushCards: number): number => {
    if (straightFlushCards >= 7) return payoutConfig.superFlushRush.sevenCardStraight
    if (straightFlushCards >= 6) return payoutConfig.superFlushRush.sixCardStraight
    if (straightFlushCards >= 5) return payoutConfig.superFlushRush.fiveCardStraight
    if (straightFlushCards >= 4) return payoutConfig.superFlushRush.fourCardStraight
    if (straightFlushCards >= 3) return payoutConfig.superFlushRush.threeCardStraight
    return 0
  }

  const simulateHands = async () => {
    setIsSimulating(true)
    setSimulationProgress(0)
    
    const anteAmount = 1
    const flushRushBet = 1
    const superFlushRushBet = 1
    
    const betTotals: { [key: string]: { totalBet: number; totalWon: number; handsWon: number; handsLost: number } } = {
      'Base Game (Ante + Play)': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
      'Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 },
      'Super Flush Rush Bonus': { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 }
    }
    
    // Track 3-card flush stats by two highest cards (only for cards meeting minimum threshold)
    const threeCardStats: { [key: string]: { wins: number; losses: number; total: number } } = {}
    
    // Track hand distribution relative to minimum threshold
    let handsAboveMinimum = 0
    let handsBelowMinimum = 0

    for (let hand = 0; hand < numHands; hand++) {
      const deck = shuffleDeck(createDeck())
      
      // Deal 7 cards to player and 7 to dealer
      const playerCards = deck.slice(0, 7)
      const dealerCards = deck.slice(7, 14)
      
      // Find best flushes
      const playerBestFlush = findLongestFlush(playerCards)
      const dealerBestFlush = findLongestFlush(dealerCards)
      
      // Find straight flushes for bonus bets
      const playerStraightFlush = findLongestStraightFlush(playerCards)
      
      // Get high card value for 3-card flush decisions
      const highCardValue = playerBestFlush.length > 0 ? 
        Math.max(...playerBestFlush.map(card => getRankValue(card.rank))) : 0
      
      // Determine play wager based on player's flush cards and high card
      const playWager = getOptimalPlayWager(playerBestFlush.length, highCardValue, anteAmount)
      const shouldFold = playWager === 0
      
      // Track hand distribution relative to minimum threshold
      // A hand is "above minimum" if it either:
      // 1. Has 4+ flush cards (automatic play), OR
      // 2. Has exactly 3 flush cards with high card >= minimum threshold
      const meetsMinimumThreshold = playerBestFlush.length >= 4 || 
        (playerBestFlush.length === 3 && highCardValue >= minThreeCardFlushRank)
      
      if (meetsMinimumThreshold) {
        handsAboveMinimum++
      } else {
        handsBelowMinimum++
      }
      
      // Track 3-card flush statistics for two highest cards that meet minimum threshold
      if (playerBestFlush.length === 3) {
        // Get two highest cards
        const sortedFlush = [...playerBestFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
        const highestCard = sortedFlush[0]
        const secondHighestCard = sortedFlush[1]
        const highestValue = getRankValue(highestCard.rank)
        
        if (highestValue >= minThreeCardFlushRank) {
          const twoHighestKey = `${highestCard.rank}-${secondHighestCard.rank}`
          if (!threeCardStats[twoHighestKey]) {
            threeCardStats[twoHighestKey] = { wins: 0, losses: 0, total: 0 }
          }
          threeCardStats[twoHighestKey].total++
        }
      }
      
      // Evaluate dealer qualification
      const dealerQualified = dealerQualifies(dealerBestFlush)
      
      if (shouldFold) {
        // Player folds - loses ante only
        betTotals['Base Game (Ante + Play)'].totalBet += anteAmount
        betTotals['Base Game (Ante + Play)'].handsLost++
      } else {
        // Player plays
        const totalWager = anteAmount + playWager
        betTotals['Base Game (Ante + Play)'].totalBet += totalWager
        
        if (!dealerQualified) {
          // Dealer doesn't qualify - ante pays even money, play pushes
          betTotals['Base Game (Ante + Play)'].totalWon += anteAmount
          betTotals['Base Game (Ante + Play)'].handsWon++
          
          // Track 3-card flush win for stats
          if (playerBestFlush.length === 3) {
            const sortedFlush = [...playerBestFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
            const highestCard = sortedFlush[0]
            const secondHighestCard = sortedFlush[1]
            const highestValue = getRankValue(highestCard.rank)
            
            if (highestValue >= minThreeCardFlushRank) {
              const twoHighestKey = `${highestCard.rank}-${secondHighestCard.rank}`
              if (threeCardStats[twoHighestKey]) {
                threeCardStats[twoHighestKey].wins++
              }
            }
          }
        } else {
          // Dealer qualifies - compare hands
          const comparison = compareFlushes(playerBestFlush, dealerBestFlush)
          
          if (comparison === 'win') {
            betTotals['Base Game (Ante + Play)'].totalWon += totalWager * 2 // Both ante and play pay even money
            betTotals['Base Game (Ante + Play)'].handsWon++
            
            // Track 3-card flush win for stats
            if (playerBestFlush.length === 3) {
              const sortedFlush = [...playerBestFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
              const highestCard = sortedFlush[0]
              const secondHighestCard = sortedFlush[1]
              const highestValue = getRankValue(highestCard.rank)
              
              if (highestValue >= minThreeCardFlushRank) {
                const twoHighestKey = `${highestCard.rank}-${secondHighestCard.rank}`
                if (threeCardStats[twoHighestKey]) {
                  threeCardStats[twoHighestKey].wins++
                }
              }
            }
          } else if (comparison === 'push') {
            betTotals['Base Game (Ante + Play)'].totalWon += totalWager // Get wager back
          } else {
            betTotals['Base Game (Ante + Play)'].handsLost++
            
            // Track 3-card flush loss for stats
            if (playerBestFlush.length === 3) {
              const sortedFlush = [...playerBestFlush].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
              const highestCard = sortedFlush[0]
              const secondHighestCard = sortedFlush[1]
              const highestValue = getRankValue(highestCard.rank)
              
              if (highestValue >= minThreeCardFlushRank) {
                const twoHighestKey = `${highestCard.rank}-${secondHighestCard.rank}`
                if (threeCardStats[twoHighestKey]) {
                  threeCardStats[twoHighestKey].losses++
                }
              }
            }
          }
        }
      }
      
      // Evaluate bonus bets
      const flushRushMultiplier = calculateFlushRushPayout(playerBestFlush.length)
      const flushRushPayout = flushRushMultiplier > 0 ? flushRushBet * flushRushMultiplier : 0
      
      betTotals['Flush Rush Bonus'].totalBet += flushRushBet
      if (flushRushPayout > 0) {
        betTotals['Flush Rush Bonus'].totalWon += flushRushPayout
        betTotals['Flush Rush Bonus'].handsWon++
      } else {
        betTotals['Flush Rush Bonus'].handsLost++
      }
      
      const superFlushRushMultiplier = calculateSuperFlushRushPayout(playerStraightFlush.length)
      const superFlushRushPayout = superFlushRushMultiplier > 0 ? superFlushRushBet * superFlushRushMultiplier : 0
      
      betTotals['Super Flush Rush Bonus'].totalBet += superFlushRushBet
      if (superFlushRushPayout > 0) {
        betTotals['Super Flush Rush Bonus'].totalWon += superFlushRushPayout
        betTotals['Super Flush Rush Bonus'].handsWon++
      } else {
        betTotals['Super Flush Rush Bonus'].handsLost++
      }
      
      // Update progress and UI less frequently for performance
      const updateFrequency = Math.max(1, Math.floor(numHands / 100))
      if (hand % updateFrequency === 0) {
        const progress = (hand / numHands) * 100
        setSimulationProgress(progress)
        await new Promise(resolve => setTimeout(resolve, 1))
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

    // Compile 3-card flush statistics
    const threeCardFlushResults: ThreeCardFlushStats[] = Object.keys(threeCardStats)
      .sort((a, b) => {
        // Sort by first card value descending, then by second card value descending
        const [aFirst, aSecond] = a.split('-')
        const [bFirst, bSecond] = b.split('-')
        const aFirstValue = getRankValue(aFirst)
        const bFirstValue = getRankValue(bFirst)
        
        if (aFirstValue !== bFirstValue) {
          return bFirstValue - aFirstValue
        }
        
        const aSecondValue = getRankValue(aSecond)
        const bSecondValue = getRankValue(bSecond)
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

    // Compile hand distribution statistics
    const handDistributionStats: HandDistributionStats = {
      totalHands: numHands,
      aboveMinimum: handsAboveMinimum,
      belowMinimum: handsBelowMinimum,
      aboveMinimumPercentage: (handsAboveMinimum / numHands) * 100,
      belowMinimumPercentage: (handsBelowMinimum / numHands) * 100
    }

    // Update state with results
    setResults(simulationResults)
    setThreeCardFlushStats(threeCardFlushResults)
    setHandDistribution(handDistributionStats)
    setSimulationProgress(100)
    
    // Small delay to show 100% completion before hiding progress
    setTimeout(() => {
      setIsSimulating(false)
      setSimulationProgress(0)
    }, 500)
  }

  const formatPercentage = (value: number) => {
    const color = value >= 0 ? 'text-green-600' : 'text-red-600'
    const icon = value >= 0 ? <TrendUp className="w-4 h-4" /> : <TrendDown className="w-4 h-4" />
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        {icon}
        {value.toFixed(2)}%
      </div>
    )
  }

  const updatePayoutConfig = (category: 'flushRush' | 'superFlushRush', key: string, value: number) => {
    setPayoutConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">I Luv Suits Poker Simulator</h1>
          <p className="text-muted-foreground">Statistical analysis with configurable hand count and expected return calculations</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="w-5 h-5" />
              Game Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm">{gameRules}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulation Control</CardTitle>
            <CardDescription>Configure and run simulation to analyze betting returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="num-hands">Number of Hands</Label>
                <Input
                  id="num-hands"
                  type="number"
                  min="1000"
                  max="10000000"
                  step="1000"
                  value={numHands}
                  onChange={(e) => setNumHands(parseInt(e.target.value) || 1000000)}
                  disabled={isSimulating}
                />
                <p className="text-xs text-muted-foreground">1,000 - 10,000,000 hands</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="min-flush-rank">Min 3-Card Flush High Card</Label>
                <select
                  id="min-flush-rank"
                  value={minThreeCardFlushRank}
                  onChange={(e) => setMinThreeCardFlushRank(parseInt(e.target.value))}
                  disabled={isSimulating}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value={9}>9 (Current Default)</option>
                  <option value={10}>10</option>
                  <option value={11}>Jack</option>
                  <option value={12}>Queen</option>
                  <option value={13}>King</option>
                  <option value={14}>Ace</option>
                </select>
                <p className="text-xs text-muted-foreground">Fold 3-card flush if high card is lower</p>
              </div>
            </div>
            
            <Button 
              onClick={simulateHands} 
              disabled={isSimulating}
              className="w-full"
              size="lg"
            >
              {isSimulating ? (
                <>Simulating...</>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Simulation
                </>
              )}
            </Button>

            {isSimulating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Simulation Progress</span>
                  <span>{simulationProgress.toFixed(1)}%</span>
                </div>
                <Progress value={simulationProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">
                  Processing {numHands.toLocaleString()} hands... ({Math.floor((simulationProgress / 100) * numHands).toLocaleString()} completed)
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Gear className="w-4 h-4 mr-2" />
              Payouts
            </Button>
          </CardContent>
        </Card>

        {showConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Payout Configuration</CardTitle>
              <CardDescription>Adjust bonus bet payouts (odds-to-1)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Flush Rush Bonus</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="flush-7">7 Card Flush</Label>
                    <Input
                      id="flush-7"
                      type="number"
                      value={payoutConfig.flushRush.sevenCard}
                      onChange={(e) => updatePayoutConfig('flushRush', 'sevenCard', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flush-6">6 Card Flush</Label>
                    <Input
                      id="flush-6"
                      type="number"
                      value={payoutConfig.flushRush.sixCard}
                      onChange={(e) => updatePayoutConfig('flushRush', 'sixCard', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flush-5">5 Card Flush</Label>
                    <Input
                      id="flush-5"
                      type="number"
                      value={payoutConfig.flushRush.fiveCard}
                      onChange={(e) => updatePayoutConfig('flushRush', 'fiveCard', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flush-4">4 Card Flush</Label>
                    <Input
                      id="flush-4"
                      type="number"
                      value={payoutConfig.flushRush.fourCard}
                      onChange={(e) => updatePayoutConfig('flushRush', 'fourCard', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Super Flush Rush Bonus</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="straight-7">7 Card Straight Flush</Label>
                    <Input
                      id="straight-7"
                      type="number"
                      value={payoutConfig.superFlushRush.sevenCardStraight}
                      onChange={(e) => updatePayoutConfig('superFlushRush', 'sevenCardStraight', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="straight-6">6 Card Straight Flush</Label>
                    <Input
                      id="straight-6"
                      type="number"
                      value={payoutConfig.superFlushRush.sixCardStraight}
                      onChange={(e) => updatePayoutConfig('superFlushRush', 'sixCardStraight', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="straight-5">5 Card Straight Flush</Label>
                    <Input
                      id="straight-5"
                      type="number"
                      value={payoutConfig.superFlushRush.fiveCardStraight}
                      onChange={(e) => updatePayoutConfig('superFlushRush', 'fiveCardStraight', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="straight-4">4 Card Straight Flush</Label>
                    <Input
                      id="straight-4"
                      type="number"
                      value={payoutConfig.superFlushRush.fourCardStraight}
                      onChange={(e) => updatePayoutConfig('superFlushRush', 'fourCardStraight', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="straight-3">3 Card Straight Flush</Label>
                    <Input
                      id="straight-3"
                      type="number"
                      value={payoutConfig.superFlushRush.threeCardStraight}
                      onChange={(e) => updatePayoutConfig('superFlushRush', 'threeCardStraight', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Expected Return Analysis</CardTitle>
              <CardDescription>Statistical results from {numHands.toLocaleString()} hands ($1 Ante, 1-3x Play, $1 Bonus bets)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bet Type</TableHead>
                    <TableHead className="text-right">Total Bet</TableHead>
                    <TableHead className="text-right">Total Won</TableHead>
                    <TableHead className="text-right">Hands Won</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Expected Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.betType}>
                      <TableCell className="font-medium">{result.betType}</TableCell>
                      <TableCell className="text-right">${result.totalBet}</TableCell>
                      <TableCell className="text-right">${result.totalWon}</TableCell>
                      <TableCell className="text-right">
                        {result.handsWon} / {numHands.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {result.winRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercentage(result.expectedReturn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {handDistribution && (
          <Card>
            <CardHeader>
              <CardTitle>Hand Distribution Analysis</CardTitle>
              <CardDescription>Percentage of hands above and below the minimum 3-card flush threshold ({getMinFlushDisplayText()}+ high card)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-600">
                    {handDistribution.aboveMinimumPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Hands Above Minimum</div>
                  <div className="text-xs text-muted-foreground">
                    {handDistribution.aboveMinimum.toLocaleString()} / {handDistribution.totalHands.toLocaleString()} hands
                  </div>
                  <div className="text-xs text-muted-foreground">
                    (4+ flush cards OR 3-card flush with {getMinFlushDisplayText()}+ high card)
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-red-600">
                    {handDistribution.belowMinimumPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Hands Below Minimum</div>
                  <div className="text-xs text-muted-foreground">
                    {handDistribution.belowMinimum.toLocaleString()} / {handDistribution.totalHands.toLocaleString()} hands
                  </div>
                  <div className="text-xs text-muted-foreground">
                    (0-2 flush cards OR 3-card flush with &lt;{getMinFlushDisplayText()} high card)
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">
                    {((handDistribution.aboveMinimum / handDistribution.belowMinimum) || 0).toFixed(2)}:1
                  </div>
                  <div className="text-sm text-muted-foreground">Play to Fold Ratio</div>
                  <div className="text-xs text-muted-foreground">
                    How many hands we play vs fold
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${handDistribution.aboveMinimumPercentage}%` }}
                  ></div>
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${handDistribution.belowMinimumPercentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Play ({handDistribution.aboveMinimumPercentage.toFixed(1)}%)</span>
                  <span>Fold ({handDistribution.belowMinimumPercentage.toFixed(1)}%)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {threeCardFlushStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>3-Card Flush Win Rate by Two Highest Cards</CardTitle>
              <CardDescription>Performance analysis for 3-card flush hands when playing (high card {getMinFlushDisplayText()}+)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Two Highest Cards</TableHead>
                    <TableHead className="text-right">Total Hands</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threeCardFlushStats.filter(stat => stat.totalHands > 0).map((stat) => (
                    <TableRow key={stat.highCards}>
                      <TableCell className="font-medium">{stat.highCards}</TableCell>
                      <TableCell className="text-right">{stat.totalHands}</TableCell>
                      <TableCell className="text-right">{stat.wins}</TableCell>
                      <TableCell className="text-right">{stat.losses}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {stat.winRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {threeCardFlushStats.every(stat => stat.totalHands === 0) && (
                <div className="text-center text-muted-foreground py-4">
                  No 3-card flush hands with high cards {getMinFlushDisplayText()}+ were dealt in this simulation.
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}

export default App