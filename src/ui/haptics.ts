// Haptic feedback — Android/Chrome only (iOS Safari has no vibration API).
// Always silent-degrade; never gate anything on it.

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported — fine
  }
}

export const haptics = {
  tap: () => buzz(12), // completing anything
  crit: () => buzz([25, 40, 25]), // CRITICAL SYNC
  drop: () => buzz([15, 30, 15, 30, 40]), // data shard
  levelUp: () => buzz([40, 60, 40, 60, 80]),
};
