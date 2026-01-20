export function choosePlanStore() {
  return {
    plans: [] as any[],
    loading: false,
    error: null as string | null,

    async init() {
      this.error = null;
      this.loading = true;

      try {
        // If already has active subscription, go to dashboard
        const subRes = await fetch('/api/v1/me/subscription', { credentials: 'include' });
        if (subRes.status === 401) throw new Error('Please sign in again.');
        const sub = await subRes.json();
        if (sub?.active) {
          window.location.href = '/dashboard';
          return;
        }

        const res = await fetch('/api/v1/plans', { credentials: 'include' });
        const data = await res.json();

        this.plans = (data.plans || []).map((p: any) => {
          let features: string[] = [];
          try { features = JSON.parse(p.featuresJson || '[]'); } catch {}
          return { ...p, features };
        });
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load plans';
      } finally {
        this.loading = false;
      }
    },

    formatPrice(priceCents: number) {
      const dollars = (priceCents || 0) / 100;
      return `$${dollars.toFixed(2)}/month`;
    },

    async selectPlan(planId: string) {
      this.loading = true;
      this.error = null;

      try {
        const res = await fetch('/api/v1/me/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planId }),
        });
        if (!res.ok) throw new Error('Failed to activate plan');
        window.location.href = '/dashboard';
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to activate plan';
        this.loading = false;
      }
    },
  };
}
