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

type AdminPlan = {
  id: string;
  name: string;
  priceCents: number;
  featuresJson: string;
  features?: string[];
};

export function adminStore() {
  return {
    // portal UI expects these
    sidebarOpen: false,
    activeNav: 'dashboard',
    searchQuery: '',
    locationName: 'All Locations',
    dateRangeLabel: 'Last 30 days',
    
    // Toast/snackbar
    toastOpen: false,
    toastMessage: '' as string,
    toastType: 'info' as 'info' | 'success' | 'error',
    toastTimer: null as any,

    toast(message: string, type: 'info' | 'success' | 'error' = 'info') {
      this.toastMessage = message;
      this.toastType = type;
      this.toastOpen = true;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toastOpen = false; }, 3000);
    },


    stats: {
      activeMemberCount: 0,
      memberGrowth: 0,
      averageUsageRate: 0,
      monthlyProjection: 0,
    } as any,

    // Members
    members: [] as AdminMember[],
    filteredMembers: [] as AdminMember[],
    loading: false,
    error: null as string | null,

    // Plans
    plans: [] as AdminPlan[],
    plansLoading: false,
    plansError: null as string | null,
    planModalOpen: false,
    planEditingId: null as string | null,
    planSaving: false,
    planForm: {
      id: '',
      name: '',
      price: '',       // dollars string
      featuresText: '',// one feature per line
    },

    async init() {
      await this.refresh();
      await this.refreshPlans();
        this.toast('Plan deleted', 'success');
      this.
    async refreshStats(days: number = 30) {
      try {
        const res = await fetch(`/api/v1/admin/stats?days=${days}`, { credentials: 'include' });
        const j = await res.json().catch(() => null);
        if (!res.ok) return;

        this.stats = {
          ...this.stats,
          activeMemberCount: j?.activeMemberCount ?? this.stats.activeMemberCount,
          averageUsageRate: j?.averageUsageRate ?? this.stats.averageUsageRate,
          monthlyProjection: j?.monthlyProjection ?? this.stats.monthlyProjection,
        };
        this.dateRangeLabel = `Last ${j?.days || days} days`;
      } catch {}
    }

computeStats();
        this.toast('User deleted', 'success');
    },

    navigate(id: string) {
      this.activeNav = id;
      // optional: lazy load
      if (id === 'members') this.refresh();
      if (id === 'plans') this.refreshPlans();
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

    formatPriceCents(priceCents: number) {
      return `$${((priceCents || 0) / 100).toFixed(2)}`;
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
        this.toast(e?.message ?? 'Delete failed', 'error');
      }
    },

    // --- Plans ---
    async refreshPlans() {
      this.plansLoading = true;
      this.plansError = null;
      try {
        const res = await fetch('/api/v1/admin/plans', { credentials: 'include' });
        if (res.status === 401) throw new Error('Please sign in as admin.');
        if (res.status === 403) throw new Error('Forbidden (admin only).');
        if (!res.ok) throw new Error('Failed to load plans');
        const data = await res.json();
        this.plans = (data.plans || []).map((p: any) => {
          let features: string[] = [];
          try { features = JSON.parse(p.featuresJson || '[]'); } catch {}
          return { ...p, features };
        });
      } catch (e: any) {
        this.plansError = e?.message ?? 'Failed to load plans';
      } finally {
        this.plansLoading = false;
      }
    },

    openAddPlan() {
      this.planEditingId = null;
      this.planForm = { id: '', name: '', price: '', featuresText: '' };
      this.planModalOpen = true;
      this.plansError = null;
    },

    openEditPlan(p: AdminPlan) {
      this.planEditingId = p.id;
      const features = p.features || [];
      this.planForm = {
        id: p.id,
        name: p.name,
        price: ((p.priceCents || 0) / 100).toFixed(2),
        featuresText: features.join('\n'),
      };
      this.planModalOpen = true;
      this.plansError = null;
    },

    closePlanModal() {
      this.planModalOpen = false;
      this.planSaving = false;
    },

    async savePlan() {
      this.planSaving = true;
      this.plansError = null;

      try {
        const id = (this.planForm.id || '').trim();
        const name = (this.planForm.name || '').trim();
        const priceNum = Number(this.planForm.price || '0');
        if (!name) throw new Error('Name is required');
        if (!this.planEditingId && !id) throw new Error('ID is required for new plans');

        const features = (this.planForm.featuresText || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        const featuresJson = JSON.stringify(features);
        const priceCents = Math.round(priceNum * 100);

        const payload = {
          id,
          name,
          priceCents,
          featuresJson,
        };

        if (this.planEditingId) {
          const res = await fetch(`/api/v1/admin/plans/${encodeURIComponent(this.planEditingId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || 'Update failed');
        } else {
          const res = await fetch('/api/v1/admin/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || 'Create failed');
        }

        this.closePlanModal();
        await this.refreshPlans();
      } catch (e: any) {
        this.plansError = e?.message ?? 'Save failed';
        this.planSaving = false;
      }
    },

    async deletePlan(id: string) {
      if (!confirm('Delete this plan?')) return;
      try {
        const res = await fetch(`/api/v1/admin/plans/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'Delete failed');
        await this.refreshPlans();
      } catch (e: any) {
        this.toast(e?.message ?? 'Delete failed', 'error');
      }
    },
  };
}
