export interface VipLevel {
  id: string
  level: number
  name: string
  color: string | null
  icon: string | null
  requiredPoints: number
  keepPoints: number
  pointMultiplier: number
  cashbackPct: number
  weeklyBonus: number
}

export interface VipBenefit {
  key: string
  name: string
  type: string
  unit: string | null
  value: number
  valueMinor: number | null
}

export interface VipProgress {
  level: number
  levelName: string
  color: string | null
  icon: string | null
  loyaltyPoints: number
  statusPoints: number
  lifetimePoints: number
  pointMultiplier: number
  cashbackPct: number
  nextLevel: { level: number; name: string; requiredPoints: number } | null
  progressPercent: number
  pointsToNext: number
  graceEndsAt: string | null
  lastLevelUpAt: string | null
}

export interface Mission {
  id: string
  key: string
  name: string
  description: string | null
  type: string
  metric: string
  status: string
  progress: number
  target: number
  percent: number
  rewardPoints: number
  expiresAt: string | null
}

export interface ShopItem {
  id: string
  sku: string
  name: string
  description: string | null
  imageUrl: string | null
  type: string
  costPoints: number
  value: number | null
  stock: number | null
  minLevel: number
  locked: boolean
  soldOut: boolean
}

export interface Redemption {
  id: string
  item: string
  type: string
  costPoints: number
  status: string
  createdAt: string
}

// ── Socket payloads ──
export interface PointsEvent {
  loyaltyPoints: number
  statusPoints: number
  loyaltyBalance: number
  source: string
}
export interface LevelUpEvent {
  fromLevel: number
  toLevel: number
  levelName: string
}
export interface MissionProgressEvent {
  userMissionId: string
  missionKey: string
  progress: number
  target: number
  percent: number
}
export interface MissionCompletedEvent {
  userMissionId: string
  missionKey: string
  rewardPoints: number
}
