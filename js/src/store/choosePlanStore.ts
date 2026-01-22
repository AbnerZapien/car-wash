type Plan = { id: string; name: string; priceCents: number; featuresJson: string; features?: string[] };

export function choosePlanStore() {
  return {
    loading: false,
    saving: false,
    error: null as string | null,

    plans: [] as Plan[],
    currentPlanId: '' as string,
    selectedPlanId: '' as string,

    async init() {
      this.loading = true;
      this.error = null;
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch('/api/v1/plans', { credentials: 'include' }),
          fetch('/api/v1/me/subscription', { credentials: 'include' }),
        ]);

        const plansJ = await plansRes.json().catch(() => ({} as any));
        const subJ = await subRes.json().catch(() => ({} as any));

        const rawPlans = (plansJ.plans || []) as any[];
        this.plans = rawPlans.map((p) => {
          let features: string[] = [];
          try { features = JSON.parse(p.featuresJson || '[]'); } catch {}
          return { ...p, features };
        });

        if (subJ?.active && subJ?.subscription?.planId) {
          this.currentPlanId = String(subJ.subscription.planId);
          this.selectedPlanId = this.currentPlanId;
        } else if (this.plans.length) {
          this.selectedPlanId = this.plans[0].id;
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load plans';
      } finally {
        this.loading = false;
      }
    },

    selectPlan(id: string) {
      this.selectedPlanId = id;
    },

    get selectedPlan(): Plan | null {
      return this.plans.find((p) => p.id === this.selectedPlanId) || null;
    },

    get priceLabel(): string {
      const p = this.selectedPlan;
      if (!p) return '';
      return `$${((p.priceCents || 0) / 100).toFixed(2)}/mo`;
    },

    async save() {
      if (!this.selectedPlanId) {
        this.error = 'Select a plan first';
        return;
      }
      this.saving = true;
      this.error = null;
      try {
        const res = await fetch('/api/v1/me/subscription', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: this.selectedPlanId }),
        });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || 'Failed to update subscription');

        window.location.assign('/account');
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to update subscription';
      } finally {
        this.saving = false;
      }
    },
  };
}
