export interface AdminVipLevel {
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

export interface AdminMission {
  id: string
  key: string
  name: string
  description: string | null
  type: string
  metric: string
  status: string
  target: number
  rewardPoints: number
  rewardStatusPoints: number
  sortOrder: number
  _count?: { userMissions: number }
}

export interface AdminShopItem {
  id: string
  sku: string
  name: string
  description: string | null
  type: string
  costPoints: number
  valueMinor: number | null
  stock: number | null
  minLevel: number
  enabled: boolean
  sortOrder: number
}

export interface LoyaltyAnalytics {
  totalPointsIssued: number
  totalPointsRedeemed: number
  redemptionRate: number
  totalRedemptions: number
  levelDistribution: Array<{ level: number; name: string; players: number }>
}

export interface PointConfig {
  loyaltyPerStakeMinor: number
  statusPerStakeMinor: number
  loyaltyPerDepositMinor: number
  statusPerDepositMinor: number
  categoryWeights: Record<string, number>
}

export interface MissionFormData {
  id?: string
  key: string
  name: string
  description?: string
  type: string
  metric: string
  status: string
  target: number
  rewardPoints: number
  rewardStatusPoints: number
  sortOrder: number
  params?: Record<string, unknown>
}

export interface LevelFormData {
  id?: string
  level: number
  name: string
  color?: string
  requiredPoints: number
  keepPoints: number
  pointMultiplier: number
  cashbackPct: number
  weeklyBonusMinor?: number
}
