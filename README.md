
# I Luv Suits Poker — Simulator

A lightweight simulator and UI for "I Luv Suits Poker" — a 7-card casino poker variant focused on flushes. This project lets you configure bonus-payout tables and play strategy, then run large Monte Carlo simulations (default: 1,000,000 hands) and view expected-return metrics for base bets and optional side bets.

## Overview

This app simulates head-to-head play between a player and dealer. It computes:
- Expected return (percentage) for the base game (Ante / Play) assuming $1 Ante and the maximum Play according to strategy.
- Expected return for the two optional side bets: Flush Rush and Super Flush Rush (configurable payouts).
- Win/loss counts, win rates, and a three-card-flush analysis broken down by high card (9, 10, J, Q, K, A).
- Hand distribution statistics showing how often the player will play vs fold given a configurable minimum 3-card flush high-card threshold.

The UI provides controls for number of simulated hands, minimum 3-card flush high-card to play, and editable payout tables for the two side bets.

## What the results mean

- Total Bet: Sum of wager amounts placed across all simulated hands for a given bet type (e.g., Ante, Play, Flush Rush).
- Total Won: Total payouts received for that bet type across all hands.
- Hands Won: Number of hands that produced a win for that bet type.
- Win Rate: Percentage of hands that won for that bet type.
- Expected Return: The percentage return on the total bet for that bet type (positive = player profit, negative = house edge). The UI shows it as a percentage with an up/down indicator.

Hand Distribution analysis breaks out how many hands are above/below the player’s play threshold. This is used to compute how often the player chooses to Play (bet the Play wager) vs Fold.

## How to use the app (local)

Using the UI:
- Number of Hands: Set how many Monte Carlo hands to simulate (min 1,000; default 1,000,000).
- Min 3-Card Flush High Card: Configure the minimum high-card required for the simulated player to "play" a 3-card flush (9 is the default). "None" means always play any 3-card flush. Smaller flushes are never played. Larger flushes are always played.
- Run Simulation: Starts the simulation. A progress bar shows progress and estimated hands processed.
- Payouts: Toggle the Payout Configuration panel to edit Flush Rush and Super Flush Rush payout tables (odds-to-1). Changes apply to subsequent simulations.

Interpretation tips:
- Results assume $1 Ante and $1 side bets each hand. The Play wager is chosen by the strategy rules described below.
- For accurate estimates of expected return, use large sample sizes (1,000,000 preferred). Smaller runs are useful for quick experimentation.

## Rules of the game (I Luv Suits Poker)

Base-play rules:
- Players makes an Ante wager and may optionally place two side bets: Flush Rush and Super Flush Rush.
- Players and Dealer receive 7 cards from a standard 52-card deck. The deck is reshuffled between hands.
- After receiving 7 cards, the player must choose to either place a Play wager or fold (and lose the Ante):
	- Maximum Play wager size depends on the player's number of flush cards:
		- 2, 3, or 4 flush cards: up to 1 × Ante
		- 5 flush cards: up to 2 × Ante
		- 6 or 7 flush cards: up to 3 × Ante
- Dealer qualification: Dealer must have a 4+ card flush, or a 3-card flush with high-card 9 or higher, to qualify.
- Payout resolution:
	- If dealer does NOT qualify: Ante pays even money (1:1); Play pushes.
	- If dealer qualifies and player's flush beats dealer's flush: Ante and Play both pay even money.
	- If dealer qualifies and dealer's flush beats player's: Ante and Play lose.
	- Ties push Ante and Play (no win/loss on those wagers).

Hand comparison:
- When evaluating a 7-card hand, only the single "best" flush is considered for comparison: the flush with the most cards in the same suit.
- If a hand contains multiple flushes of the same size (for example two different 3-card flushes), the flush whose ranks are highest is used (compare highest card, then next highest, etc.).
- Flushes are compared first by number of cards (more cards wins). If both flushes have the same number of cards, compare the flush cards by rank from highest to lowest; the higher rank at the first difference wins.
- If both flush size and all ranked cards are identical, the hand is a tie.

Side bet rules (Flush Rush and Super Flush Rush):
- Side bets are evaluated only on the player's 7 cards (they win or lose regardless of base game outcome).
- Flush Rush: Pays based on the total number of flush-suited cards in the player's 7-card hand (typically wins for 4+ flush cards).
- Super Flush Rush: Pays when the player's flush cards also form a straight flush sequence (3+ to win depending on table).

## Steps the simulator performs (per hand)

1. Build and shuffle a standard 52-card deck.
2. Deal 7 cards to the player and 7 cards to the dealer (no shared community cards; independent 7-card hands).
3. Evaluate both hands to determine:
	 - The best flush for each hand (the flush with the most cards; if multiple equal-size flushes exist, choose the one with the highest ranks).
	 - Whether any flush cards form straight flush sequences relevant to the Super Flush Rush bonus.
4. Determine player action using configured strategy:
	 - Always ante and place side bets (Flush Rush & Super Flush Rush) of $1 each.
	 - Decide Play vs Fold: If the hand qualifies as "above minimum" (4+ flush cards OR a 3-card flush meeting the configured high-card threshold), the player plays the maximum allowed Play wager for that hand; otherwise the player folds (loses the Ante only).
5. Determine dealer qualification (3-card 9-high+ required). If dealer fails to qualify, base-play resolution follows the non-qualifier rules.
6. Resolve wagers:
	 - Compute outcomes for Ante and Play according to comparison and qualification.
	 - Compute side-bet payouts independently using the configured payout tables.
7. Record per-hand statistics (bets placed, payouts received, win/loss counts) and update running totals.
8. Optionally report progress back to the UI so the progress bar shows completion percentage.

## Defaults & configuration

Default side-bet payout tables included in the UI and simulation code:

- Flush Rush (odds-to-1):
	- 7 Card Flush: 100
	- 6 Card Flush: 20
	- 5 Card Flush: 10
	- 4 Card Flush: 2

- Super Flush Rush (odds-to-1):
	- 7 Card Straight Flush: 500
	- 6 Card Straight Flush: 200
	- 5 Card Straight Flush: 100
	- 4 Card Straight Flush: 50
	- 3 Card Straight Flush: 9

Minimum hands recommended for stable expected-return estimates: 1,000,000.

---

License: See `LICENSE` in repository root.
