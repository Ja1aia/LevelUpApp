/**
 * ELO Rating System
 * Based on the official chess ELO calculation with adaptive K-factor
 */

// K-factor determines how much ratings change
// Higher K = more volatile ratings
// We use adaptive K-factor similar to Chess.com:
// - High K-factor (64) for first 10 games (provisional period)
// - Medium K-factor (40) for games 11-30 (stabilization period)
// - Lower K-factor (24) for experienced players with rating < 2000
// - Lowest K-factor (16) for highly rated players (>= 2000)
const DEFAULT_K_FACTOR = 32;

/**
 * Calculate adaptive K-factor based on number of games played and rating
 * This allows ratings to adjust quickly for new players and stabilize for experienced players
 *
 * @param gamesPlayed - Total number of games the player has played
 * @param currentRating - Player's current ELO rating
 * @returns Appropriate K-factor for the player
 */
export function getAdaptiveKFactor(
  gamesPlayed: number,
  currentRating: number
): number {
  // Provisional period: First 10 games - rating adjusts very quickly
  if (gamesPlayed < 10) {
    return 64;
  }

  // Stabilization period: Games 11-30 - rating still adjusts relatively quickly
  if (gamesPlayed < 30) {
    return 40;
  }

  // Experienced players: Rating adjusts based on skill level
  // High-rated players (>= 2000) get lower K-factor for rating stability
  if (currentRating >= 2000) {
    return 16;
  }

  // Regular players: Standard K-factor
  return 24;
}

/**
 * Calculate expected score based on rating difference
 * Formula: E = 1 / (1 + 10^((opponentRating - playerRating) / 400))
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new ELO rating after a game
 * Formula: newRating = oldRating + K * (actualScore - expectedScore)
 *
 * @param currentRating - Player's current ELO rating
 * @param opponentRating - Opponent's ELO rating
 * @param actualScore - 1 for win, 0.5 for draw, 0 for loss
 * @param gamesPlayed - Total number of games played (for adaptive K-factor)
 * @returns Object with new rating and change amount
 */
export function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  actualScore: number, // 1 = win, 0.5 = draw, 0 = loss
  gamesPlayed: number = 30 // Default to experienced player if not provided
): { newRating: number; change: number } {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const kFactor = getAdaptiveKFactor(gamesPlayed, currentRating);
  const change = Math.round(kFactor * (actualScore - expectedScore));
  const newRating = currentRating + change;

  // Minimum rating is 100 to prevent negative ratings
  return {
    newRating: Math.max(100, newRating),
    change,
  };
}

/**
 * Calculate ELO changes for both players after a match
 */
export function calculateMatchEloChanges(
  player1Rating: number,
  player2Rating: number,
  player1Score: number,
  player2Score: number,
  player1GamesPlayed: number = 30,
  player2GamesPlayed: number = 30
): {
  player1Change: number;
  player2Change: number;
  player1NewRating: number;
  player2NewRating: number;
} {
  // Determine actual scores (1 = win, 0.5 = draw, 0 = loss)
  let player1ActualScore: number;
  let player2ActualScore: number;

  if (player1Score > player2Score) {
    player1ActualScore = 1;
    player2ActualScore = 0;
  } else if (player1Score < player2Score) {
    player1ActualScore = 0;
    player2ActualScore = 1;
  } else {
    player1ActualScore = 0.5;
    player2ActualScore = 0.5;
  }

  const player1Result = calculateNewRating(
    player1Rating,
    player2Rating,
    player1ActualScore,
    player1GamesPlayed
  );

  const player2Result = calculateNewRating(
    player2Rating,
    player1Rating,
    player2ActualScore,
    player2GamesPlayed
  );

  return {
    player1Change: player1Result.change,
    player2Change: player2Result.change,
    player1NewRating: player1Result.newRating,
    player2NewRating: player2Result.newRating,
  };
}
