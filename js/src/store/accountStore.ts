export function accountStore() {
  return {
    loading: false,
    saving: false,
    error: null as string | null,
    success: null as string | null,
    saved: false,

    user: null as any,
    subscription: null as any,
    avatarPreview: '' as string,

    firstName: '',
    lastName: '',
    email: '',
    avatarUrl: '',

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      this.success = null;
      this.saved = false;
      this.saved = false;
      this.saved = false;

      try {
        const [meRes, subRes] = await Promise.all([
          fetch('/api/v1/me', { credentials: 'include' }),
          fetch('/api/v1/me/subscription', { credentials: 'include' }),
        ]);

        if (meRes.status === 401) throw new Error('Please sign in again.');

        const me = await meRes.json();
        this.user = me;

        this.firstName = me.firstName || '';
        this.lastName = me.lastName || '';
        this.email = me.email || '';
        this.avatarUrl = me.avatarUrl || '';

        const subJson = await subRes.json().catch(() => null);
        this.subscription = subJson?.subscription
          ? {
              ...subJson.subscription,
              plan: { price: ((subJson.subscription.priceCents || 0) / 100).toFixed(2) },
            }
          : null;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load account';
      } finally {
        this.loading = false;
      }
    },

    // File input handler (stores locally as preview for now)
    onAvatarSelected(ev: Event) {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    },

    reset() {
      if (!this.user) return;
      this.firstName = this.user.firstName || '';
      this.lastName = this.user.lastName || '';
      this.email = this.user.email || '';
      this.avatarUrl = this.user.avatarUrl || '';
      this.avatarPreview = '';
      this.error = null;
      this.success = null;
      this.saved = false;
      this.saved = false;
    },

    async saveChanges() {
      await this.saveProfile();
    },

    async saveProfile() {
      this.saving = true;
      this.error = null;
      this.success = null;
      this.saved = false;

      try {
        const payload = {
          firstName: this.firstName,
          lastName: this.lastName,
          email: this.email,
          // if you later implement avatar uploads, switch this to a real URL
          avatarUrl: this.avatarUrl,
        };

        const res = await fetch('/api/v1/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (res.status === 401) throw new Error('Please sign in again.');
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || 'Update failed');
        }

        const updated = await res.json();
        this.user = updated;

        // refresh fields from DB response
        this.firstName = updated.firstName || '';
        this.lastName = updated.lastName || '';
        this.email = updated.email || '';
        this.avatarUrl = updated.avatarUrl || '';

        this.success = 'Saved.';
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
