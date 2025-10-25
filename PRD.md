# I Luv Suits Casino Game Simulator

Simulate the casino game "I Luv Suits Poker" (1,000,000 hands by default) and report clear expected-return metrics for Ante/Play and optional bonus bets. This document combines product, design, and explicit implementation/validation details so an automated agent (GPT-5) or an engineer can implement, test, and validate the simulation.

## Project Classification & User Context
- **Complexity Level**: Light Application (multiple features with moderate state management)
- **Primary User Activity**: Analyzing - users consume statistical data and interact with configuration options
- **User Context**: Gaming analysts, casino operators, and informed players analyzing house edge and return rates
- **Experience Qualities**: Professional, analytical, trustworthy - like a casino gaming analysis tool

## Thought Process for Feature Selection
- **Core Problem Analysis**: Casino operators and players need to understand the mathematical expectations of "I Luv Suits Poker" betting strategies
- **Critical Path**: Configure payouts → Run simulation → View detailed results with expected returns
- **Key Moments**: 
  1. Understanding the complex game rules clearly
  2. Configuring bonus bet payouts
  3. Interpreting simulation results and expected returns

## Comprehensive Results Display
- **Success Criteria**: Clear tables showing win rates, expected returns, and statistical confidence with $1 betting units
- **Granular Analysis**: Detailed 3-card flush analysis by high card (9, 10, J, Q)

## Design Direction

### Visual Tone & Identity
- **Emotional Response**: Professional confidence and analytical precision
- **Design Personality**: Serious, trustworthy, data-focused - like financial analysis software
- **Visual Metaphors**: Casino green with clean data presentation, suggesting both gaming and statistical analysis

### Color Strategy
- **Color Scheme Type**: Monochromatic with accent colors
- **Primary Color**: Deep casino green (oklch(0.25 0.08 150)) - professional and gambling-associated
- **Secondary Colors**: Navy blue for secondary actions and data organization
- **Accent Color**: Gold/amber (oklch(0.75 0.12 80)) for highlighting important statistics and positive returns
- **Color Accessibility**: High contrast white text on dark backgrounds, gold accents meet WCAG AA standards

### Typography System
- **Font Pairing Strategy**: Single family (Inter) in multiple weights for hierarchy
- **Typographic Hierarchy**: Bold titles, medium subheadings, regular body text, light annotations
- **Font Personality**: Clean, modern, highly legible - conveying precision and reliability

### Visual Hierarchy & Layout
- **Attention Direction**: Game rules → Configuration options → Simulation controls → Results analysis
- **White Space Philosophy**: Generous spacing between sections, tight spacing within related elements
- **Grid System**: Card-based layout with responsive grid for different data types
- **Responsive Approach**: Single column on mobile, multi-column dashboard on desktop

### Animations
- **Purposeful Meaning**: Subtle progress indicators and state transitions to convey simulation progress
- **Hierarchy of Movement**: Progress bars for long operations, gentle hover states for interactivity

### UI Elements & Component Selection
- **Component Usage**: 
  - Cards for organizing different data sections
  - Tables for detailed statistical results
  - Forms for payout configuration
  - Progress bars for simulation status
  - Alerts for status messages
- **Component Customization**: Dark theme variants with casino-appropriate styling
- **Component States**: Clear disabled states during simulation, hover states for interactive elements
- **Icon Selection**: Play icons for simulation, chart icons for results, settings icons for configuration
- **Spacing System**: Consistent 4px base unit with generous gaps between major sections
- **Mobile Adaptation**: Stacked layout for forms, horizontally scrollable tables for detailed data

### Visual Consistency Framework
- **Design System Approach**: Component-based with consistent spacing and color application
- **Style Guide Elements**: Consistent button styles, table formatting, card layouts
- **Visual Rhythm**: Regular spacing patterns and consistent component heights
- **Brand Alignment**: Professional gambling/analysis aesthetic throughout

### Accessibility & Readability
- **Contrast Goal**: WCAG AA compliance minimum (4.5:1 for normal text, 3:1 for large text)

## Edge Cases & Problem Scenarios
- **Potential Obstacles**: Complex poker hand evaluation, ensuring statistical accuracy over large simulations
- **Edge Case Handling**: Proper handling of edge cases in straight flush detection, dealer qualification scenarios

## Reflection
This approach transforms a simple card game simulation into a comprehensive analytical tool that provides real value for understanding the mathematics behind casino games. The focus on configurability and detailed analysis makes it useful for both educational and professional purposes.

## Core purpose & success criteria
- Mission: Simulate the I Luv Suits Poker game to compute expected returns for base bets and bonus bets across a configurable number of hands (default 1,000,000).
- Success indicators:
  - Correct implementation of 7-card dealing, flush and straight-flush detection, and dealer qualification rules.
  - Ability to configure Flush Rush and Super Flush Rush payout tables and immediately observe impact on expected returns.
  - Clear output: expected return percentages and win/loss rates.

## Tiny contract (inputs, outputs, error modes)
- Inputs (required):
  - payoutTables: object (keys: "flushRush", "superFlushRush") mapping hand-ranks to payouts (numbers).
  - handsToSimulate: integer (default 1,000,000).
  - showHandDetails: boolean (default false).
  - randomSeed (optional): number/string for reproducible runs.
- Outputs:
  - summary: {handsSimulated, anteReturnPct, bonusReturnPct, superBonusReturnPct, dealerQualRate}
  - breakdowns: {winRatesByBet, perHandRecords?}
  - threeCardFlushAnalysis: {byHighCard: {9,10,J,Q} -> {wins, trials, winPct}}
- Error modes:
  - Invalid payout table shape → deterministic error with helpful message.
  - handsToSimulate <= 0 → validation error.
  - randomSeed not usable → fallback to non-deterministic RNG and record a warning.

## Essential features

1) Game simulation engine (detailed)
  - Functionality: implement accurate 7-card dealing from a standard 52-card deck, per-hand deck reset, and evaluation of best hands for player and dealer.
  - Specific evaluations required: flush detection, straight flush detection, and tie-breakers consistent with standard poker rules.
  - Dealer qualification: implement qualifier logic (e.g., dealer qualifies on 3 card flush with 9-high or better) and record qualifier rate. This logic is not configurable.

2) Configuration
  - Must accept and apply configurable Flush Rush and Super Flush Rush payout tables.
  - Must accept and apply a configurable minimum playable player hand as always a 3-card flush, with a configurable high card 9 through Ace, with 9 being the default.
  - The number of simulated hands is configurable. The default and minimum are 1,000,000.

3) Results display & statistics
  - Expected return for Ante/Play (base strategy) expressed as a percentage assuming $1 unit bets.
  - Expected return for Flush Rush and Super Flush Rush bonus bets.
  - Win/loss counts and rates for each bet type.
  - 3-card flush analysis broken down by high-card (9, 10, J, Q, K, A): trials, wins, win percentage.

## Game Description

I Luv Suits Poker is a poker variant in which a player and dealer play against each other with a seven card hand. The player's goal is to get a larger or better flush than the dealer.

### Rules:
- A "flush" means 2 or more cards of the same suit.
- Player makes an Ante wager and receives 7 cards
- Player must choose either to make a Play wager or to fold and lose their Ante:
  - More flush cards = higher maximum Play wager
    - 2, 3, or 4 flush cards = up to 1 x Ante
    - 5 flush cards = up to 2 x Ante
    - 6 or 7 flush cards = up to 3 x Ante
- Dealer must have a 3-card flush with a 9 or better to qualify.
- If dealer doesn't qualify: Ante pays even money, Play pushes
- If player's hand beats dealer's qualifying hand, player wins
- If dealer qualifies and player wins: Both Ante and Play pay even money
- If dealer qualifies and dealer wins: Both Ante and Play lose
- Hand comparison
  - When ranking the hand, only the flush with the most cards is considered. If a hand contains two 3-card flushes, then the flush with the highest ranking cards is considered.
  - The player's flush is compared to the dealer's flush.
    - The flush with the most cards wins.
    - If both flushes have the same number of cards, then cards are compared in order from highest to lowest, and the flush with the higher card wins.
    - Flushes with the same number of cards and the same ranks are a tie.
- Side Bets:
  - Flush Rush Bonus: Pays based on the number of player's flush cards
  - Super Flush Rush Bonus: Pays based on the number of player's flush cards that make a straight
  - Side bets win/lose regardless of base game outcome

## Simulation details
- Flush Rush Bonus and Super Flush Rush Bonus payouts are configurable. The defaults are as follows:
  - Flush Rush Bonus:
      - 7 Cards: 100
      - 6 Cards: 20
      - 5 Cards: 10
      - 4 Cards: 2
  - Super Flush Rush Bonus:
      7 Cards: 500
      6 Cards: 200
      5 Cards: 100
      4 Cards: 50
      3 Cards: 9
- The player plays as follows:
  - The player always bets Ante, Flush Rush Bonus, and Super Flush Rush Bonus wagers of 1 each.
  - The player always folds if their hand is less than the minimum playable hand.
  - The minimum playable hand is a flush with 3 cards, with the minimum high card being configurable. Flushes with with more than 3 cards are always played.
  - The player always bets the maximum Play wager.

## Design & UX notes (concise)
- Tone: professional, data-first (casino-grade). Use clear tables and cards to show summary and breakdowns.
- Color & typography: retain existing root choices (Deep Casino Green, Navy, Gold; Inter family). Keep accessibility contrast goals.

## Edge cases & implementation constraints
- Deck shuffling: use a secure PRNG or seeded RNG for reproducibility when randomSeed is provided.
- Card independence: reset deck between hands; don't simulate continuous shoe unless explicitly requested.
- Floating point: use safe accumulation (e.g., integer cents where needed) to avoid rounding drift.
- Performance: target smooth UI by running simulation in a Web Worker or background thread for the required number of hands.

## Testing and validation
- Unit tests required:
  - Hand evaluation tests (flush, straight flush, ties, kickers).
  - Dealer qualification cases.
  - Payout application with sample payout tables.
- Integration test:
  - Run 10,000-hand deterministic simulation with a fixed seed; assert summary metrics are within known tolerance ranges (established by offline runs).

## Implementation considerations & GPT-5 instructions
- When asked to implement, GPT-5 should:
  1. Start by implementing deterministic hand-evaluation functions with unit tests.
  2. Add a simulation harness that accepts inputs from the Tiny contract above.
  3. Run small verification simulations and output comparison logs for review.
- Acceptance criteria for an automated PR:
  - All unit tests pass.
  - Simulation produces a non-empty summary with expected shapes.
  - Configurable payout tables change results when altered.

## Short checklist for reviewers
- [ ] Hand evaluation functions (flush/straight flush) implemented and unit-tested
- [ ] Simulation harness accepts payout tables and handsToSimulate
- [ ] Results include three-card flush analysis by high-card
- [ ] UI/worker integration to keep UI responsive

---
