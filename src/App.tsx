import { useState } from 'react'
import {
  PayoutConfig,
  SimulationResult,
  HandDistributionStats,
  simulateHands
} from './lib/simulation'
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

function App() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [handDistribution, setHandDistribution] = useState<HandDistributionStats | null>(null)
  const [numHands, setNumHands] = useState(1000000)
  const [minThreeCardFlushRank, setMinThreeCardFlushRank] = useState(9) // Minimum high card value for 3-card flush (0 = none)
  
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
    if (minThreeCardFlushRank === 0) {
      return 'None'
    }
    if (minThreeCardFlushRank >= 11) {
      return highCardNames[minThreeCardFlushRank - 11]
    }
    return minThreeCardFlushRank.toString()
  }

  const gameRules = `I Luv Suits Poker is a seven (7) card poker game in which players play against the dealer with a seven card hand. The goal is to get a higher ranking flush with more flush cards than the dealer.

Game Rules:
• Player makes an Ante wager and receives 7 cards
• Player must choose either to make a Play wager or to fold and lose their Ante:
  - More flush cards = higher maximum play wager
    - 2 - 4 flush cards = up to 1 x Ante
    - 5 flush cards = up to 2 x Ante
    - 6 - 7 flush cards = up to 3 x Ante
  - Player may fold their hand instead
• Current Strategy: ${minThreeCardFlushRank === 0 ? 'Always play 3-card flush (no minimum)' : `Only play 3-card flush if high card is ${getMinFlushDisplayText()} or higher`}
• Dealer needs 3-card nine-high flush minimum to qualify
• If dealer doesn't qualify: Ante pays even money, Play pushes
• If player's hand beats dealer's qualifying hand, player wins
• If dealer qualifies and player wins: Both Ante and Play pay even money
• If dealer qualifies and dealer wins: Both Ante and Play lose

Bonus Bets (optional):
• Flush Rush Bonus: Pays based on player's flush cards (4+ to win)
• Super Flush Rush Bonus: Pays based on player's straight flush cards (3+ to win)
• Bonus bets win/lose regardless of base game outcome`

  // ...existing code...
  const simulateHandsUI = async () => {
    setIsSimulating(true)
    setSimulationProgress(0)
    const summary = await simulateHands(
      numHands,
      payoutConfig,
      minThreeCardFlushRank,
      (progress) => setSimulationProgress(progress)
    )
    setResults(summary.results)
    setHandDistribution(summary.handDistribution)
    setSimulationProgress(100)
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
          <p className="text-muted-foreground">Statistical analysis with configurable play and expected return calculations</p>
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
                  max="100000000"
                  step="1000"
                  value={numHands}
                  onChange={(e) => setNumHands(parseInt(e.target.value) || 1000000)}
                  disabled={isSimulating}
                />
                <p className="text-xs text-muted-foreground">1,000 - 100,000,000 hands</p>
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
                  <option value={0}>None</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                  <option value={9}>9 (Default)</option>
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
              onClick={simulateHandsUI} 
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
                    <TableHead className="text-right">Return</TableHead>
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
              <CardDescription>
                {minThreeCardFlushRank === 0 
                  ? 'Percentage of hands with 3+ flush cards (no minimum required)'
                  : `Percentage of hands above and below the minimum 3-card flush threshold (${getMinFlushDisplayText()}+ high card)`
                }
              </CardDescription>
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
                    {minThreeCardFlushRank === 0 
                      ? '(3+ flush cards)' 
                      : `(4+ flush cards OR 3-card flush with ${getMinFlushDisplayText()}+ high card)`
                    }
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
                    {minThreeCardFlushRank === 0 
                      ? '(0-2 flush cards)' 
                      : `(0-2 flush cards OR 3-card flush with <${getMinFlushDisplayText()} high card)`
                    }
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

      </div>
    </div>
  )
}

export default App