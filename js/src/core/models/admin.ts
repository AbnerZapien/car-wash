export interface AdminStats {
  activeMemberCount: number;
  memberGrowth: number;
  averageUsageRate: number;
  monthlyProjection: number;
  demographics: DemographicData[];
}

export interface DemographicData {
  ageGroup: string;
  percentage: number;
  color: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  joinDate: Date;
}

export interface AdminLocation {
  id: string;
  name: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}
