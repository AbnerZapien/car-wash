import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';


function toTitleCaseSmart(s: string): string {
  const v = (s || '').trim();
  if (!v) return '';
  // Keep short acronyms (BMW, GMC, etc.)
  if (/^[A-Z0-9]{2,4}$/.test(v)) return v;
  // Title-case words and hyphen parts
  return v
    .toLowerCase()
    .split(' ')
    .map(w => w.split('-').map(p => p ? (p[0].toUpperCase() + p.slice(1)) : '').join('-'))
    .join(' ');
}

type Car = {
  id: string;
  userId: number;
  nickname: string;
  vin: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  color: string;
  plate: string;
  createdAt?: string;
  updatedAt?: string;
};

type CarsListResponse = { cars: Car[] | null };

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

// Lightweight fallback make list (used if API endpoints are not implemented yet)
const FALLBACK_MAKES = [
  'Acura','Audi','BMW','Chevrolet','Dodge','Ford','GMC','Honda','Hyundai','Jeep','Kia','Lexus','Mazda','Mercedes-Benz',
  'Nissan','Subaru','Tesla','Toyota','Volkswagen','Volvo'
];

export function myCarsStore() {
  return {

    // --- Typeahead + VIN UX state ---
    decodingVin: false,
    makeOpen: false,
    makeSuggestions: [] as string[],
    makeDebounceTimer: null as any,
    modelOpen: false,
    modelSuggestions: [] as string[],
    modelDebounceTimer: null as any,
    cars: [] as Car[],
    loading: false,
    error: null as string | null,

    modalOpen: false,
    editingId: null as string | null,
    saving: false,

    // Phase-2 required state (fixes your console errors)
    decodingVin: false,
    makeOpen: false,
    makeSuggestions: [] as string[],
    modelOpen: false,
    modelSuggestions: [] as string[],

    form: {
      nickname: '',
      vin: '',
      year: '' as any, // keep as string in form; convert on save
      make: '',
      model: '',
      trim: '',
      color: '',
      plate: '',
    },

    // --- lifecycle ---
    async init() {
      await this.refresh();
    },

    async refresh() {
      this.loading = true;
      this.error = null;
      try {
        const headers = authHeaders();
        const res = await fetch('/api/v1/me/cars', { headers, credentials: 'include' });
        if (res.status === 401) throw new Error('Please sign in again.');
        const j = (await res.json().catch(() => ({ cars: [] }))) as CarsListResponse;
        this.cars = (j?.cars || []) as Car[];
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load cars';
        this.cars = [];
      } finally {
        this.loading = false;
      }
    },

    carTitle(c: Car) {
      const n = (c.nickname || '').trim();
      if (n) return n;
      const y = c.year ? String(c.year) : '';
      return `${y} ${(c.make || '')} ${(c.model || '')}`.trim() || 'Car';
    },

    resetForm() {
      this.form = {
        nickname: '',
        vin: '',
        year: '' as any,
        make: '',
        model: '',
        trim: '',
        color: '',
        plate: '',
      };
      this.makeOpen = false;
      this.modelOpen = false;
      this.makeSuggestions = [];
      this.modelSuggestions = [];
      this.decodingVin = false;
      this.error = null;
    },

    openAdd() {
      this.editingId = null;
      this.resetForm();
      this.modalOpen = true;
    },

    openEdit(c: Car) {
      this.editingId = c.id;
      this.form = {
        nickname: c.nickname || '',
        vin: c.vin || '',
        year: (c.year ?? '') as any,
        make: c.make || '',
        model: c.model || '',
        trim: c.trim || '',
        color: c.color || '',
        plate: c.plate || '',
      };
      this.makeOpen = false;
      this.modelOpen = false;
      this.makeSuggestions = [];
      this.modelSuggestions = [];
      this.decodingVin = false;
      this.error = null;
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
      this.saving = false;
      this.decodingVin = false;
      this.makeOpen = false;
      this.modelOpen = false;
    },

    onYearInput(_v: string) {
      // When year changes, reset model suggestions (because model list depends on year/make)
      this.modelSuggestions = [];
      this.modelOpen = false;
    },

    // --- Make typeahead ---
    async onMakeFocus() {
      this.makeOpen = true;
      await this.onMakeInput(String(this.form?.make || ''));
    },
    async onMakeInput(q: string) {
      const query = String(q || '').trim();

      // Always show dropdown while typing/focusing
      this.makeOpen = true;

      // Debounce
      if (this.makeDebounceTimer) clearTimeout(this.makeDebounceTimer);

      this.makeDebounceTimer = setTimeout(async () => {
        try {
          const year = String(this.form?.year || '').trim();
          const res = await fetch(`/api/v1/cars/makes?year=${encodeURIComponent(year)}&q=${encodeURIComponent(query)}`, {
            credentials: 'include',
          });
          if (!res.ok) {
            // silent failure (don’t spam UI)
            this.makeSuggestions = [];
            return;
          }
          const j = await res.json().catch(() => ({} as any));
          const makes = (j?.makes || []) as string[];
          this.makeSuggestions = makes.map((m) => toTitleCaseSmart(m));
        } catch {
          this.makeSuggestions = [];
        }
      }, 300);
    },
    async selectMake(m: string) {
      const v = toTitleCaseSmart(String(m || '').trim());
      this.form.make = v;
      this.makeOpen = false;

      // When make changes, clear model/trim and repopulate model suggestions
      this.form.model = '';
      this.form.trim = '';

      await this.onModelInput('');
      this.modelOpen = true;
    },
    // --- Model typeahead (depends on make/year) ---
    async onModelFocus() {
      this.modelOpen = true;
      await this.onModelInput(String(this.form?.model || ''));
    },
    async onModelInput(q: string) {
      const query = String(q || '').trim();

      this.modelOpen = true;

      if (this.modelDebounceTimer) clearTimeout(this.modelDebounceTimer);

      this.modelDebounceTimer = setTimeout(async () => {
        try {
          const year = String(this.form?.year || '').trim();
          const make = String(this.form?.make || '').trim();
          if (!make) {
            this.modelSuggestions = [];
            return;
          }

          const res = await fetch(`/api/v1/cars/models?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&q=${encodeURIComponent(query)}`, {
            credentials: 'include',
          });
          if (!res.ok) {
            this.modelSuggestions = [];
            return;
          }
          const j = await res.json().catch(() => ({} as any));
          const models = (j?.models || []) as string[];
          this.modelSuggestions = models.map((m) => toTitleCaseSmart(m));
        } catch {
          this.modelSuggestions = [];
        }
      }, 300);
    },
    selectModel(m: string) {
      const v = toTitleCaseSmart(String(m || '').trim());
      this.form.model = v;
      this.modelOpen = false;
    },
    // --- VIN decode (optional convenience) ---
    async decodeVIN() {
      const vin = String(this.form?.vin || '').trim().toUpperCase();
      if (vin.length !== 17) {
        this.error = 'VIN must be 17 characters.';
        return;
      }

      this.decodingVin = true;
      this.error = null;

      try {
        const res = await fetch(`/api/v1/vin/decode?vin=${encodeURIComponent(vin)}`, {
          credentials: 'include',
        });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || 'VIN decode failed');

        // Fill form
        this.form.year = j.year || this.form.year || '';
        this.form.make = toTitleCaseSmart(j.make || this.form.make || '');
        this.form.model = toTitleCaseSmart(j.model || this.form.model || '');
        // Keep trim as returned (often has hyphens like EX-V6)
        this.form.trim = (j.trim || this.form.trim || '').trim();

        // Close make dropdown, then refresh model suggestions and open model dropdown for convenience
        this.makeOpen = false;

        // Kick model suggestions based on decoded make/year
        await this.onModelInput('');
        this.modelOpen = true;
      } catch (e: any) {
        this.error = e?.message ?? 'VIN decode failed. You can still enter details manually.';
      } finally {
        this.decodingVin = false;
      }
    },
    // --- CRUD ---
    async save() {
      this.saving = true;
      this.error = null;

      try {
        const headers = { 'Content-Type': 'application/json', ...authHeaders() };

        const payload = {
          nickname: (this.form.nickname || '').trim(),
          vin: (this.form.vin || '').trim(),
          year: this.form.year ? Number(this.form.year) : null,
          make: (this.form.make || '').trim(),
          model: (this.form.model || '').trim(),
          trim: (this.form.trim || '').trim(),
          color: (this.form.color || '').trim(),
          plate: (this.form.plate || '').trim(),
        };

        // Minimal validation
        if (payload.year !== null && (isNaN(payload.year) || payload.year < 1900 || payload.year > 2100)) {
          throw new Error('Year looks invalid.');
        }
        if (!payload.make || !payload.model) {
          throw new Error('Make and Model are required.');
        }

        let res: Response;
        if (this.editingId) {
          res = await fetch(`/api/v1/me/cars/${encodeURIComponent(this.editingId)}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        } else {
          res = await fetch('/api/v1/me/cars', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        }

        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || j?.message || 'Save failed');

        this.closeModal();
        await this.refresh();
      } catch (e: any) {
        this.error = e?.message ?? 'Save failed';
      } finally {
        this.saving = false;
      }
    },

    async remove(id: string) {
      if (!confirm('Delete this car?')) return;
      this.error = null;
      try {
        const headers = authHeaders();
        const res = await fetch(`/api/v1/me/cars/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
          credentials: 'include',
        });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(j?.error || j?.message || 'Delete failed');

        // optimistic update
        this.cars = (this.cars || []).filter((c) => c.id !== id);
      } catch (e: any) {
        this.error = e?.message ?? 'Delete failed';
      }
    },
  };
}
