/**
 * ELO Rating System
 * Based on the official chess ELO calculation
 */

// K-factor determines how much ratings change
// Higher K = more volatile ratings
// Chess uses: 40 for new players, 20 for < 2400, 10 for > 2400
const K_FACTOR = 32;

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
 * @returns Object with new rating and change amount
 */
export function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  actualScore: number // 1 = win, 0.5 = draw, 0 = loss
): { newRating: number; change: number } {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const change = Math.round(K_FACTOR * (actualScore - expectedScore));
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
  player2Score: number
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
    player1ActualScore
  );

  const player2Result = calculateNewRating(
    player2Rating,
    player1Rating,
    player2ActualScore
  );

  return {
    player1Change: player1Result.change,
    player2Change: player2Result.change,
    player1NewRating: player1Result.newRating,
    player2NewRating: player2Result.newRating,
  };
}
