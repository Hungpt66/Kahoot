/**
 * Kahoot-style speed & accuracy scoring formula
 */
export function calculateKahootScore(
  timeMs: number,
  timeLimitSeconds: number,
  maxPoints: number = 1000,
  streak: number = 0
): { points: number; speedBonus: number; streakBonus: number } {
  const timeLimitMs = timeLimitSeconds * 1000;
  const elapsed = Math.min(Math.max(0, timeMs), timeLimitMs);
  // Standard Kahoot curve: 500 to 1000 points depending on speed
  const fraction = elapsed / timeLimitMs;
  const basePoints = Math.round((1 - fraction / 2) * maxPoints);

  // Streak bonus: +100 for 2 in a row, up to +500 max
  let streakBonus = 0;
  if (streak >= 1) {
    streakBonus = Math.min(500, streak * 100);
  }

  return {
    points: basePoints + streakBonus,
    speedBonus: basePoints,
    streakBonus,
  };
}
