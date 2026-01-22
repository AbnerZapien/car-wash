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
    // Audit
    auditItems: [] as any[],
    auditLoading: false,
    auditError: null as string | null,

    plansLoading: false,
    plansError: null as string | null,
    planModalOpen: false,
    // Reassign subscribers (blocked plan delete)
    reassignOpen: false,
    reassignFromId: '' as string,
    reassignToId: '' as string,
    reassignLoading: false,
    reassignAutoDelete: false,

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
        
      this.computeStats();
      await this.refreshStats(30);
    },

    navigate(id: string) {
      this.activeNav = id;
      if (id === 'members') this.refresh();
      if (id === 'plans') this.refreshPlans();
      if (id === 'audit') this.refreshAudit(100);
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

    async refreshStats(days: number = 30) {
      try {
        const res = await fetch(`/api/v1/admin/stats?days=${days}`, { credentials: 'include' });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) return;

        // Map API -> UI
        this.stats.activeMemberCount = Number(j.activeMemberCount || 0);
        this.stats.averageUsageRate = Number(j.averageUsageRate || 0);
        this.stats.monthlyProjection = Number(j.monthlyProjection || 0);
        // keep memberGrowth as placeholder for now
        this.dateRangeLabel = `Last ${Number(j.days || days)} days`;
      } catch {}
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
      // NOTE: averageUsageRate and monthlyProjection come from /api/v1/admin/stats
      // so we do NOT overwrite them here.
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
    async refreshAudit(limit: number = 100) {
      this.auditLoading = true;
      this.auditError = null;
      try {
        const res = await fetch(`/api/v1/admin/audit?limit=${limit}`, { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const msg = j?.error || j?.message || 'Failed to load audit';
          this.auditError = msg;
          this.toast(msg, 'error');
          return;
        }
        this.auditItems = j?.items || [];
      } catch (e: any) {
        this.auditError = e?.message ?? 'Failed to load audit';
        this.toast(this.auditError, 'error');
      } finally {
        this.auditLoading = false;
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
    openReassign(fromId: string, autoDelete: boolean = true) {
      this.reassignFromId = fromId;
      this.reassignAutoDelete = autoDelete;

      // default target = first different plan
      const other = (this.plans || []).find((p: any) => p.id !== fromId);
      this.reassignToId = other ? other.id : '';
      this.reassignOpen = true;
      this.reassignLoading = false;
    },

    closeReassign() {
      this.reassignOpen = false;
      this.reassignLoading = false;
      this.reassignAutoDelete = false;
    },

    async confirmReassign() {
      const fromId = (this.reassignFromId || '').trim();
      const toId = (this.reassignToId || '').trim();
      if (!fromId || !toId) {
        this.toast('Select a target plan', 'error');
        return;
      }
      if (fromId === toId) {
        this.toast('Target plan must be different', 'error');
        return;
      }

      this.reassignLoading = true;
      try {
        const res = await fetch(`/api/v1/admin/plans/${encodeURIComponent(fromId)}/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ toPlanId: toId }),
        });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const msg = j?.error || j?.message || 'Reassign failed';
          this.toast(msg, 'error');
          return;
        }

        this.toast(`Reassigned ${j?.moved ?? 0} subscription(s) (logged to Audit)`, 'success');
        this.closeReassign();

        // refresh UI
        await this.refreshPlans();
        await this.refresh();
        this.computeStats();

        // auto-delete original plan (common desired flow)
        if (this.reassignAutoDelete) {
          await this.deletePlan(fromId);
        }
      } catch (e: any) {
        this.toast(e?.message ?? 'Reassign failed', 'error');
      } finally {
        this.reassignLoading = false;
      }
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
        this.toast('Plan saved (logged to Audit)', 'success');
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
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const msg = j?.error || j?.message || 'Delete failed';
          this.toast(msg, 'error');
          return;
        }

        // Optimistic UI update (so it disappears immediately)
        this.plans = (this.plans || []).filter((p: any) => p.id !== id);

        this.toast('Plan deleted (logged to Audit)', 'success');

        // Re-sync from DB (keeps ordering & confirms)
        await this.refreshPlans();
      } catch (e: any) {
        this.toast(e?.message ?? 'Delete failed', 'error');
      }
    },
  };
}
