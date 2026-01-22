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

interface AdminLocation {
  id: string;
  name: string;
  address: string;
}

export function adminStore() {
  return {
    // portal UI expects these
    sidebarOpen: false,
    activeNav: 'dashboard',
    searchQuery: '',
    locationName: 'All Locations',
    selectedLocationId: 'all' as string,
    locationMenuOpen: false,

    dateRangeLabel: 'Last 30 days',

    // Charts
    chartsLoading: false,
    chartsError: null as string | null,
    
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
    // Locations
    locations: [] as AdminLocation[],
    locationsLoading: false,
    locationsError: null as string | null,
    locationModalOpen: false,
    locationEditingId: null as string | null,
    locationSaving: false,
    locationForm: { id: '', name: '', address: '' } as any,

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
      await this.refreshLocations();
        
      this.computeStats();
      await this.refreshStats(30);
      await this.refreshCharts(30);
    },

    navigate(id: string) {
      this.activeNav = id;
      if (id === 'members') this.refresh();
      if (id === 'plans') this.refreshPlans();
      if (id === 'locations') this.refreshLocations();
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
        const res = await fetch(`/api/v1/admin/stats?days=${days}&locationId=${encodeURIComponent(this.selectedLocationId || 'all')}`, { credentials: 'include' });
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
    setLocation(id: string) {
      this.selectedLocationId = id || 'all';
      if (this.selectedLocationId === 'all') {
        this.locationName = 'All Locations';
      } else {
        const found = (this.locations || []).find((l: any) => l.id === this.selectedLocationId);
        this.locationName = found ? found.name : this.selectedLocationId;
      }
      this.locationMenuOpen = false;

      // refresh analytics for this location
      this.refreshStats(30);
      this.refreshCharts(30);
      if (this.activeNav === 'members') this.refresh();
    },



    formatPriceCents(priceCents: number) {
      return `$${((priceCents || 0) / 100).toFixed(2)}`;
    },

    async refresh() {
      this.loading = true;
      this.error = null;
      try {
        const res = await fetch(`/api/v1/admin/members?days=30&locationId=${encodeURIComponent(this.selectedLocationId || 'all')}`, { credentials: 'include' });
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
    async refreshCharts(days: number = 30) {
      this.chartsLoading = true;
      this.chartsError = null;
      try {
        const res = await fetch(`/api/v1/admin/charts?days=${days}&locationId=${encodeURIComponent(this.selectedLocationId || 'all')}`, { credentials: 'include' });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) throw new Error('Failed to load charts');

        // keep header stats aligned
        this.stats.activeMemberCount = Number(j.activeMemberCount || 0);
        this.stats.averageUsageRate = Number(j.averageUsageRate || 0);
        this.stats.monthlyProjection = Number(j.monthlyProjection || 0);
        this.dateRangeLabel = `Last ${Number(j.days || days)} days`;

        this.renderCharts(j);
      } catch (e: any) {
        this.chartsError = e?.message ?? 'Failed to load charts';
        this.toast(this.chartsError, 'error');
      } finally {
        this.chartsLoading = false;
      }
    },

    renderCharts(d: any) {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      const w: any = window as any;
      w.__adminCharts = w.__adminCharts || {};

      const colors = {
        indigo: '#4F46E5',
        violet: '#7C3AED',
        pink: '#EC4899',
        amber: '#F59E0B',
        emerald: '#10B981',
        sky: '#0EA5E9',
        slate: '#94A3B8',
        gray: '#E2E8F0',
      };
      const pieColors = [colors.indigo, colors.violet, colors.pink, colors.amber, colors.emerald, colors.sky, colors.slate];


      const labels7 = (d.labels || []).slice(-7);
      const scans7 = (d.scansPerDay || []).slice(-7);

      // 1) ActiveMembersChart -> scans/day (last 7)
      const c1 = document.getElementById('activeMembersChart') as HTMLCanvasElement | null;
      if (c1) {
        const cfg: any = {
          type: 'line',
          data: { labels: labels7, datasets: [{ label: 'Scans', data: scans7, tension: 0.4, fill: true, pointRadius: 0, borderColor: colors.indigo, backgroundColor: 'rgba(79,70,229,0.15)' }] },
          options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } } },
        };
        if (w.__adminCharts.activeMembers) { w.__adminCharts.activeMembers.data = cfg.data; w.__adminCharts.activeMembers.update(); }
        else { w.__adminCharts.activeMembers = new Chart(c1.getContext('2d'), cfg); }
      }

      // 2) UsageRateChart -> gauge from avg usage (0..5 mapped)
      const avg = Number(d.averageUsageRate || 0);
      const ratio = Math.max(0, Math.min(avg / 5.0, 1));
      const c2 = document.getElementById('usageRateChart') as HTMLCanvasElement | null;
      if (c2) {
        const cfg: any = {
          type: 'doughnut',
          data: { datasets: [{ data: [ratio, 1 - ratio], borderWidth: 0, backgroundColor: [colors.indigo, colors.gray] }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '70%', rotation: -1.25 * Math.PI, circumference: Math.PI, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
        };
        if (w.__adminCharts.usageRate) { w.__adminCharts.usageRate.data = cfg.data; w.__adminCharts.usageRate.update(); }
        else { w.__adminCharts.usageRate = new Chart(c2.getContext('2d'), cfg); }
      }

      // 3) ProjectionChart -> monthlyProjection split into 4 weeks
      const mp = Number(d.monthlyProjection || 0);
      const weeks = [mp/4, mp/4, mp/4, mp/4];
      const c3 = document.getElementById('projectionChart') as HTMLCanvasElement | null;
      if (c3) {
        const cfg: any = {
          type: 'bar',
          data: { labels: ['Week 1','Week 2','Week 3','Week 4'], datasets: [{ label: 'Projection ($)', data: weeks, borderRadius: 5, backgroundColor: colors.indigo }] },
          options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } } },
        };
        if (w.__adminCharts.projection) { w.__adminCharts.projection.data = cfg.data; w.__adminCharts.projection.update(); }
        else { w.__adminCharts.projection = new Chart(c3.getContext('2d'), cfg); }
      }

      // 4) memberDemographicsChart -> plan mix
      const c4 = document.getElementById('memberDemographicsChart') as HTMLCanvasElement | null;
      if (c4) {
        const cfg: any = {
          type: 'pie',
          data: { labels: d.planMixLabels || [], datasets: [{ data: d.planMixCounts || [], backgroundColor: (d.planMixLabels || []).map((_: any, i: number) => pieColors[i % pieColors.length]) }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } } },
        };
        if (w.__adminCharts.planMix) { w.__adminCharts.planMix.data = cfg.data; w.__adminCharts.planMix.update(); }
        else { w.__adminCharts.planMix = new Chart(c4.getContext('2d'), cfg); }
      }

      // 5) usageHeatmapChart -> stacked bars
      const c5 = document.getElementById('usageHeatmapChart') as HTMLCanvasElement | null;
      if (c5) {
        const cfg: any = {
          type: 'bar',
          data: {
            labels: d.heatmapLabels || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            datasets: [
              { label: 'Morning', data: d.heatmapMorning || [], stack: 'x', backgroundColor: '#C7D2FE' },
              { label: 'Afternoon', data: d.heatmapAfternoon || [], stack: 'x', backgroundColor: '#818CF8' },
              { label: 'Evening', data: d.heatmapEvening || [], stack: 'x', backgroundColor: '#4F46E5' },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, display: false } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
        };
        if (w.__adminCharts.heatmap) { w.__adminCharts.heatmap.data = cfg.data; w.__adminCharts.heatmap.update(); }
        else { w.__adminCharts.heatmap = new Chart(c5.getContext('2d'), cfg); }
      }

      // 6) retentionTrendChart -> retention % last 30
      const c6 = document.getElementById('retentionTrendChart') as HTMLCanvasElement | null;
      if (c6) {
        const lbl30 = (d.labels || []).slice(-30);
        const ret30 = (d.retentionPctPerDay || []).slice(-30);
        const cfg: any = {
          type: 'line',
          data: { labels: lbl30, datasets: [{ label: 'Unique users / active subs (%)', data: ret30, tension: 0.3, fill: true, pointRadius: 0, borderColor: colors.emerald, backgroundColor: 'rgba(16,185,129,0.15)' }] },
          options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } },
        };
        if (w.__adminCharts.retention) { w.__adminCharts.retention.data = cfg.data; w.__adminCharts.retention.update(); }
        else { w.__adminCharts.retention = new Chart(c6.getContext('2d'), cfg); }
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

    
    // --- Locations ---
    async refreshLocations() {
      this.locationsLoading = true;
      this.locationsError = null;
      try {
        const res = await fetch('/api/v1/admin/locations', { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || 'Failed to load locations');
        this.locations = j?.locations || [];
      } catch (e: any) {
        this.locationsError = e?.message ?? 'Failed to load locations';
        this.toast(this.locationsError, 'error');
      } finally {
        this.locationsLoading = false;
      }
    },

    openAddLocation() {
      this.locationEditingId = null;
      this.locationForm = { id: '', name: '', address: '' };
      this.locationModalOpen = true;
      this.locationsError = null;
    },

    openEditLocation(l: AdminLocation) {
      this.locationEditingId = l.id;
      this.locationForm = { id: l.id, name: l.name, address: l.address || '' };
      this.locationModalOpen = true;
      this.locationsError = null;
    },

    closeLocationModal() {
      this.locationModalOpen = false;
      this.locationSaving = false;
    },

    async saveLocation() {
      this.locationSaving = true;
      this.locationsError = null;
      try {
        const id = (this.locationForm.id || '').trim();
        const name = (this.locationForm.name || '').trim();
        const address = (this.locationForm.address || '').trim();
        if (!name) throw new Error('Name is required');
        if (!this.locationEditingId && !id) throw new Error('ID is required for new locations');

        const payload = { id, name, address };

        if (this.locationEditingId) {
          const res = await fetch(`/api/v1/admin/locations/${encodeURIComponent(this.locationEditingId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || 'Update failed');
        } else {
          const res = await fetch('/api/v1/admin/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || 'Create failed');
        }

        this.closeLocationModal();
        await this.refreshLocations();
        this.toast('Location saved (logged to Audit)', 'success');
      } catch (e: any) {
        this.locationsError = e?.message ?? 'Save failed';
        this.locationSaving = false;
        this.toast(this.locationsError, 'error');
      }
    },

    async deleteLocation(id: string) {
      if (!confirm('Delete this location?')) return;
      try {
        const res = await fetch(`/api/v1/admin/locations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          this.toast(j?.error || 'Delete failed', 'error');
          return;
        }
        this.locations = (this.locations || []).filter((l: any) => l.id !== id);
        this.toast('Location deleted (logged to Audit)', 'success');
        await this.refreshLocations();
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
      this.planModalOpen = false;

      // default target = first different plan
      const other = (this.plans || []).find((p: any) => p.id !== fromId);
      this.reassignToId = other ? other.id : '';
      this.reassignOpen = true;
      // Ensure the modal node is Alpine-bound immediately (prevents needing another click)
      try {
        const A: any = (window as any).Alpine;
        if (A?.initTree) A.initTree(document.body);
      } catch {}

      // Force Alpine to flush DOM updates immediately
      queueMicrotask(() => { this.reassignOpen = true; });
      requestAnimationFrame(() => { this.reassignOpen = true; });
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
          const msg = String(j?.error || j?.message || 'Delete failed');

          // Any 400 here is our "blocked delete" case (subscriptions exist)
          if (res.status === 400) {
            this.toast('Plan has subscribers. Reassign them before deleting.', 'info');

            // Open modal immediately (don’t wait on network)
            this.openReassign(id, true);

            // Refresh plans in background so dropdown is populated/updated
            this.refreshPlans().catch(() => {});

            return;
          }

          this.toast(msg, 'error');
          return;
        }

        // Optimistic UI update
        this.plans = (this.plans || []).filter((p: any) => p.id !== id);

        this.toast('Plan deleted (logged to Audit)', 'success');
        await this.refreshPlans();
      } catch (e: any) {
        this.toast(e?.message ?? 'Delete failed', 'error');
      }
    },
  };
}
