// Diamond Hand tier ladder — shared by the create wizard (Hood Gate preview),
// the token detail page (Hood Score badge), and the leaderboard.
export type HoodTier = {
  name: string;
  emoji: string;
  minDays: number;
};

export const HOOD_TIERS: HoodTier[] = [
  { name: "Peasant", emoji: "🏚️", minDays: 0 },
  { name: "Outlaw", emoji: "🗡️", minDays: 7 },
  { name: "Archer", emoji: "🏹", minDays: 30 },
  { name: "Merry Man", emoji: "🎯", minDays: 60 },
  { name: "Little John", emoji: "🛡️", minDays: 90 },
  { name: "Robin Hood", emoji: "👑", minDays: 180 },
];

export function tierForDays(days: number): HoodTier {
  let tier = HOOD_TIERS[0];
  for (const t of HOOD_TIERS) {
    if (days >= t.minDays) tier = t;
  }
  return tier;
}
