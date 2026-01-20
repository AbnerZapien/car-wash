export function qrCodeStore() {
  return {
    user: null as any,
    userName: 'Loading...',
    planName: 'Loading...',

    code: '',
    qrCodeUrl: '',

    timer: { total: 300, expired: false, intervalId: null as any },

    get formattedMinutes() {
      const m = Math.floor(this.timer.total / 60);
      return String(m).padStart(2, '0');
    },

    get formattedSeconds() {
      const s = this.timer.total % 60;
      return String(s).padStart(2, '0');
    },

    async init() {
      await this.refreshCode();
    },

    destroy() {
      if (this.timer.intervalId) clearInterval(this.timer.intervalId);
      this.timer.intervalId = null;
    },

    startTimer() {
      this.destroy();
      this.timer.total = 300;
      this.timer.expired = false;

      this.timer.intervalId = setInterval(() => {
        this.timer.total -= 1;
        if (this.timer.total <= 0) {
          this.timer.total = 0;
          this.timer.expired = true;
          this.destroy();
        }
      }, 1000);
    },

    async refreshCode() {
      try {
        const meRes = await fetch('/api/v1/me', { credentials: 'include' });
        if (meRes.status === 401) throw new Error('Please sign in again.');
        if (!meRes.ok) throw new Error('Failed to load profile');

        const me = await meRes.json();
        this.user = me;

        const fullName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
        this.userName = fullName || me.username || 'Member';

        const subRes = await fetch('/api/v1/me/subscription', { credentials: 'include' });
        if (subRes.ok) {
          const sub = await subRes.json();
          this.planName = sub?.subscription?.planName || 'Active Plan';
        } else {
          this.planName = 'Active Plan';
        }

        // IMPORTANT: Backend expects CARWASH-<numericId>-<timestamp>
        this.code = `CARWASH-${me.id}-${Date.now()}`;
        this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.code)}`;

        this.startTimer();
      } catch (e: any) {
        this.userName = '—';
        this.planName = '—';
        this.code = '';
        this.qrCodeUrl = '';
        console.error(e);
      }
    },
  };
}
