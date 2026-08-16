export type Position = 'G' | 'F' | 'C';
export type DetailedPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type PositionSource = 'basketball-reference-position-estimate' | 'listed-position' | 'statistical-fallback';
export type PositionEligibility = Position[];
export type GameMode = 'classic' | 'daily' | 'unlimited' | 'historic';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Player {
  id: number | string;
  name: string;
  team: string;
  teamAbbreviation: string;
  position: Position;
  eligiblePositions?: PositionEligibility;
  detailedPositions?: DetailedPosition[];
  primaryDetailedPosition?: DetailedPosition;
  listedDetailedPosition?: DetailedPosition;
  positionPercentages?: Partial<Record<DetailedPosition, number>>;
  positionSource?: PositionSource;
  photo: string;
  teamLogo: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  season?: string;
  price: number;
  threePointPercentage: number;
  trueShooting: number;
  offensiveRating: number;
  defensiveRating: number;
  usageRate: number;
  assistPercentage: number;
  reboundPercentage: number;
  stealPercentage: number;
  blockPercentage: number;
  playerEfficiencyRating: number;
  winShares: number;
  boxPlusMinus: number;
  estimatedPlusMinus: number;
}

export interface TeamReport {
  overall: number;
  grade: string;
  projectedWins: number;
  offensiveRating: number;
  defensiveRating: number;
  netRating: number;
  categories: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
}
