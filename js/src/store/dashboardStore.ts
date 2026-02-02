import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import type { User } from '../core/models/user';
import type { WashHistory } from '../core/models/wash';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: any | null;
  token: string | null;
}

function authHeaders() {
  const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
  const token = auth?.token;
  return token ? { 'X-Session-Token': token } : {};
}


// ---- QR helpers (easy to change later) ----
const QR_SIZE = 240;

// Central place to swap QR provider, size, etc.
function qrUrlFromData(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(data)}`;
}

// Central place to decide what the QR "means".
// Today: use latest rawQr from history if present; else fall back to "<userId>-demo".
function deriveAccessCode(userId: number, items: any[]): string {
  const latest = (items.find((i: any) => (i?.rawQr || "").trim())?.rawQr || "").trim();
  if (latest) return latest;
  // Fallback keeps UI working + matches scan parser expectations: "<id>-..."
  return `${userId}-demo`;
}

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

type HistoryItem = {
  id: string;
  userId: number;
  locationId: string;
  locationName: string;
  locationAddress: string;
  scannedAt: string;
  result: string; // allowed|denied
  reason: string;
  rawQr: string;
};

export function dashboardStore() {
  return {
    accessCode: '' as string,
    accessQrUrl: '' as string,

    user: null as User | null,
    subscription: null as any, // keep template getters working
    washHistory: [] as WashHistory[],
    loading: true,
    error: null as string | null,
    async init() {
      this.loading = true;
      this.error = null;
      try {
        const headers = authHeaders();

        // Load user
        const meRes = await fetch("/api/v1/me", { headers, credentials: "include" });
        if (meRes.status === 401) throw new Error("Unauthorized");
        const me = (await meRes.json()) as MeResponse;

        this.user = {
          id: String(me.id),
          username: me.username,
          email: me.email,
          firstName: me.firstName,
          lastName: me.lastName,
          avatarUrl: me.avatarUrl,
        } as any;

        // Load subscription
        const subRes = await fetch("/api/v1/me/subscription", { headers, credentials: "include" });
        const sub = (await subRes.json().catch(() => null)) as SubResponse | null;
        if (sub?.subscription) {
          this.subscription = {
            status: sub.subscription.status,
            nextBillingDate: sub.subscription.nextBillingDate,
            plan: { name: sub.subscription.planName },
          };
        } else {
          this.subscription = null;
        }

        
        // Load history
        const histRes = await fetch("/api/v1/me/history", { headers, credentials: "include" });
        const hist = (await histRes.json().catch(() => ({ items: [] }))) as any;
        const items: HistoryItem[] = hist?.items || hist?.history || [];

        // Use latest rawQr as the user's access code (for the QR card)
        const code = deriveAccessCode(me.id, items as any);
        this.accessCode = code;
        this.accessQrUrl = qrUrlFromData(code);

        // Normalize backend history items into the shape the dashboard template expects
        this.washHistory = items.map((w: any) => {
          const d = new Date(w.scannedAt);
          const time = isNaN(d.getTime())
            ? ""
            : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          return {
            id: w.id,
            result: w.result, // allowed|denied
            washType: w.result === "allowed" ? "Car Wash" : "Wash Attempt",
            date: w.scannedAt,
            time,
            location: { name: w.locationName, address: w.locationAddress },
            reason: w.reason,
            rawQr: w.rawQr,
          };
        }) as any;

      } catch (e: any) {

        this.error = e?.message ?? "Failed to load dashboard";
      } finally {
        this.loading = false;
      }
    },

    get welcomeMessage(): string {
      const name = (this.user as any)?.firstName || (this.user as any)?.username;
      return name ? `Welcome back, ${name}!` : "Welcome back!";
    },


    get planName(): string {
      return this.subscription?.plan?.name || 'No Plan';
    },

    get isActive(): boolean {
      return this.subscription?.status === 'active';
    },

    get recentWashes(): WashHistory[] {
      return this.washHistory.slice(0, 3);
    },

    get nextBillingFormatted(): string {
      if (!this.subscription?.nextBillingDate) return '';
      const date = new Date(this.subscription.nextBillingDate);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },

    // ----- UI helpers for the "Current Plan" card -----
    get planStatusLabel(): string {
      return this.isActive ? "Active" : "Inactive";
    },

    // Matches: "Renews on March 15, 2026"
    get planRenewsLabel(): string {
      const d = this.nextBillingFormatted;
      return d ? `Renews on ${d}` : "";
    },

    // Placeholder until plans support monthly limits (admin + API)
    get monthlyWashesLabel(): string {
      return "Unlimited";
    },

    // Placeholder until /me returns createdAt (or we store it)
    get memberSinceLabel(): string {
      return "—";
    },

    // Real now: compute number of washes in current month from washHistory
    get thisMonthWashCount(): number {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      return (this.washHistory || []).filter((w: any) => {
        const d = new Date(w.date);
        return d.getFullYear() === y && d.getMonth() === m;
      }).length;
    },


    formatWashDate(date: Date): string {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
  };
}
