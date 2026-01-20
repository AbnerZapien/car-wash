type AdminMember = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  planId: string;
  planName: string;
  subStatus: string;
  nextBillingDate: string;
  washCount: number;
};

export function adminStore() {
  return {
    // --- UI state expected by portal.templ ---
    sidebarOpen: false,
    activeNav: 'dashboard',
    searchQuery: '',
    locationName: 'All Locations',
    dateRangeLabel: 'Last 30 days',

    stats: {
      activeMemberCount: 0,
      memberGrowth: 0,
      averageUsageRate: 0,
      monthlyProjection: 0,
    } as any,

    // --- DB-backed data ---
    members: [] as AdminMember[],
    filteredMembers: [] as AdminMember[],
    loading: false,
    error: null as string | null,

    async init() {
      await this.refresh();
      this.computeStats();
    },

    navigate(id: string) {
      this.activeNav = id;
    },

    search(q: string) {
      this.searchQuery = q;
      const s = (q || '').toLowerCase().trim();
      if (!s) {
        this.filteredMembers = this.members;
        return;
      }
      this.filteredMembers = this.members.filter((m) =>
        String(m.id).includes(s) ||
        (m.username || '').toLowerCase().includes(s) ||
        (m.email || '').toLowerCase().includes(s) ||
        (m.firstName || '').toLowerCase().includes(s) ||
        (m.lastName || '').toLowerCase().includes(s) ||
        (m.planName || '').toLowerCase().includes(s)
      );
    },

    formatPercentage(v: number) {
      const n = Number(v || 0);
      return `${n.toFixed(1)}%`;
    },

    formatCurrency(v: number) {
      const n = Number(v || 0);
      return `$${n.toFixed(2)}`;
    },

    async refresh() {
      this.loading = true;
      this.error = null;
      try {
        const res = await fetch('/api/v1/admin/members', { credentials: 'include' });
        if (res.status === 401) throw new Error('Please sign in as admin.');
        if (res.status === 403) throw new Error('Forbidden (admin only).');
        if (!res.ok) throw new Error('Failed to load members');
        const data = await res.json();
        this.members = (data.members || []) as AdminMember[];
        this.filteredMembers = this.members;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load members';
      } finally {
        this.loading = false;
      }
    },

    computeStats() {
      const active = this.members.filter((m) => m.subStatus === 'active').length;
      this.stats.activeMemberCount = active;

      // Placeholders (you can compute later from wash_events)
      this.stats.memberGrowth = 0;
      this.stats.averageUsageRate = 0;
      this.stats.monthlyProjection = 0;
    },

    async deleteUser(id: number) {
      if (!confirm('Delete this user? This deletes sessions, subscriptions, and wash events.')) return;
      try {
        const res = await fetch(`/api/v1/admin/users/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Delete failed');
        await this.refresh();
        this.computeStats();
      } catch (e: any) {
        alert(e?.message ?? 'Delete failed');
      }
    },
  };
}
