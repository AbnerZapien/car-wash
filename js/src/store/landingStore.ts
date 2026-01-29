type Plan = {
  id: string;
  name: string;
  priceCents: number;
  featuresJson: string;
  features: string[];
};

type Location = {
  id: string;
  name: string;
  address: string;
};

function parseFeatures(featuresJson: string): string[] {
  try {
    const v = JSON.parse(featuresJson || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function formatPriceCents(cents: number): string {
  const n = Number(cents || 0) / 100;
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

export function landingStore() {
  return {
    plans: [] as Plan[],
    locations: [] as Location[],

    loadingPlans: false,
    loadingLocations: false,
    errorPlans: null as string | null,
    errorLocations: null as string | null,

    async init() {
      await Promise.all([this.loadPlans(), this.loadLocations()]);
    },

    get featuredPlanId(): string {
      // Prefer premium as the highlighted plan (matches your design)
      if (this.plans.find((p) => p.id === 'premium')) return 'premium';
      // otherwise highlight the middle plan if possible
      if (this.plans.length >= 2) return this.plans[1].id;
      return this.plans[0]?.id || '';
    },

    async loadPlans() {
      this.loadingPlans = true;
      this.errorPlans = null;
      try {
        const res = await fetch('/api/v1/plans', { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || 'Failed to load plans');

        const plans = (j?.plans || []) as any[];
        this.plans = plans
          .map((p) => ({
            id: String(p.id || ''),
            name: String(p.name || ''),
            priceCents: Number(p.priceCents || 0),
            featuresJson: String(p.featuresJson || '[]'),
            features: parseFeatures(String(p.featuresJson || '[]')),
          }))
          // stable ordering for UI
          .sort((a, b) => a.priceCents - b.priceCents);
      } catch (e: any) {
        this.errorPlans = e?.message ?? 'Failed to load plans';
        this.plans = [];
      } finally {
        this.loadingPlans = false;
      }
    },

    async loadLocations() {
      this.loadingLocations = true;
      this.errorLocations = null;
      try {
        const res = await fetch('/api/v1/locations', { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || 'Failed to load locations');

        const locs = (j?.locations || []) as any[];
        this.locations = locs.map((l) => ({
          id: String(l.id || ''),
          name: String(l.name || ''),
          address: String(l.address || ''),
        }));
      } catch (e: any) {
        this.errorLocations = e?.message ?? 'Failed to load locations';
        this.locations = [];
      } finally {
        this.loadingLocations = false;
      }
    },

    priceLabel(cents: number) {
      return formatPriceCents(cents);
    },

    goToPricing() {
      const el = document.getElementById('pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    goToLocations() {
      const el = document.getElementById('locations');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // For now, selecting a plan routes user to login (then they can Choose Plan)
    selectPlan(_planId: string) {
      window.location.href = '/login';
    },
  };
}
