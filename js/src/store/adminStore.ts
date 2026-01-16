import {
  SEED_ADMIN_STATS,
  SEED_MEMBERS,
  SEED_ADMIN_LOCATIONS,
  SEED_ACTIVE_MEMBERS_CHART,
  SEED_RETENTION_CHART,
} from '../adapters/mockData';
import type { AdminStats, Member, AdminLocation, ChartDataPoint } from '../core/models/admin';

type NavItem = 'dashboard' | 'members' | 'usage' | 'attrition' | 'attendants' | 'promotions' | 'revenue' | 'income' | 'widget';
type DateRange = 'today' | 'week' | 'month' | 'year';

export function adminStore() {
  return {
    stats: null as AdminStats | null,
    members: [] as Member[],
    locations: SEED_ADMIN_LOCATIONS as AdminLocation[],
    selectedLocation: 'all',
    dateRange: 'week' as DateRange,
    searchQuery: '',
    activeNav: 'dashboard' as NavItem,
    loading: true,
    sidebarOpen: false,

    activeMembersData: [] as ChartDataPoint[],
    retentionData: [] as ChartDataPoint[],

    get filteredMembers(): Member[] {
      if (!this.searchQuery) return this.members;
      const q = this.searchQuery.toLowerCase();
      return this.members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.plan.toLowerCase().includes(q)
      );
    },

    get locationName(): string {
      const loc = this.locations.find((l) => l.id === this.selectedLocation);
      return loc?.name || 'All Locations';
    },

    get dateRangeLabel(): string {
      const labels: Record<DateRange, string> = {
        today: 'Today',
        week: 'This Week',
        month: 'This Month',
        year: 'This Year',
      };
      return labels[this.dateRange];
    },

    init() {
      console.log('adminStore init called');
      this.loadStats();
      this.loadMembers();
    },

    loadStats() {
      this.loading = true;
      setTimeout(() => {
        this.stats = { ...SEED_ADMIN_STATS };
        this.activeMembersData = [...SEED_ACTIVE_MEMBERS_CHART];
        this.retentionData = [...SEED_RETENTION_CHART];
        this.loading = false;
      }, 300);
    },

    loadMembers() {
      this.members = [...SEED_MEMBERS];
    },

    changeLocation(locationId: string) {
      this.selectedLocation = locationId;
      this.loadStats();
    },

    changeDateRange(range: DateRange) {
      this.dateRange = range;
      this.loadStats();
    },

    search(query: string) {
      this.searchQuery = query;
    },

    navigate(section: NavItem) {
      this.activeNav = section;
    },

    formatCurrency(value: number): string {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    },

    formatPercentage(value: number): string {
      return `${value > 0 ? '+' : ''}${value}%`;
    },
  };
}
