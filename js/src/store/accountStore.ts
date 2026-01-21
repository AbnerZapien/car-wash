type MeResponse = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
};

type SubResponse = {
  active: boolean;
  subscription: null | {
    planId: string;
    planName: string;
    priceCents: number;
    featuresJson: string;
    status: string;
    nextBillingDate: string;
  };
};

export function accountStore() {
  return {
    loading: false,
    saving: false,
    error: null as string | null,
    saved: false,

    user: null as any,
    subscription: null as any,

    avatarPreview: '' as string,
    firstName: '',
    lastName: '',
    email: '',

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      this.saved = false;

      try {
        const [meRes, subRes] = await Promise.all([
          fetch('/api/v1/me', { credentials: 'include' }),
          fetch('/api/v1/me/subscription', { credentials: 'include' }),
        ]);

        if (meRes.status === 401) throw new Error('Please sign in again.');
        if (!meRes.ok) throw new Error('Failed to load profile');

        const me = (await meRes.json()) as MeResponse;

        this.user = me;
        this.firstName = me.firstName || '';
        this.lastName = me.lastName || '';
        this.email = me.email || '';

        const subJson = (await subRes.json().catch(() => null)) as SubResponse | null;

        const sub = subJson?.subscription || null;
        if (sub) {
          let features: string[] = [];
          try { features = JSON.parse(sub.featuresJson || '[]'); } catch {}
          const price = ((sub.priceCents || 0) / 100).toFixed(2);

          this.subscription = {
            ...sub,
            plan: {
              id: sub.planId,
              name: sub.planName,
              price,
              features,
            },
          };
        } else {
          this.subscription = null;
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load account';
      } finally {
        this.loading = false;
      }
    },

    onAvatarChange(e: Event) {
      this.saved = false;
      this.error = null;

      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    },

    resetForm() {
      this.saved = false;
      this.error = null;
      this.avatarPreview = '';

      if (!this.user) return;
      this.firstName = this.user.firstName || '';
      this.lastName = this.user.lastName || '';
      this.email = this.user.email || '';
    },

    async saveProfile() {
      this.saving = true;
      this.error = null;
      this.saved = false;

      try {
        const res = await fetch('/api/v1/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            // avatarPreview is a data URL; not writing to DB yet.
          }),
        });

        if (res.status === 401) throw new Error('Please sign in again.');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Update failed');

        this.user = data;
        this.firstName = data.firstName || '';
        this.lastName = data.lastName || '';
        this.email = data.email || '';

        this.saved = true;
        setTimeout(() => { this.saved = false; }, 2500);
      } catch (e: any) {
        this.error = e?.message ?? 'Update failed';
      } finally {
        this.saving = false;
      }
    },
  };
}
