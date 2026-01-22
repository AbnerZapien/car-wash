import { Html5Qrcode } from 'html5-qrcode';

interface ScannedUser {
  name: string;
  plan: string;
}

const READER_ID = 'qr-reader';

type ScanAPIResponse = {
  allowed: boolean;
  reason?: string;
  userId?: number;
  planId?: string;
  planName?: string;
  locationId?: string;
};

type CameraInfo = { id: string; label: string };

type LocationInfo = { id: string; name: string; address?: string };

export function scannerStore() {
  let qr: Html5Qrcode | null = null;
  let starting = false;
  let decodeFails = 0;
  let initialized = false;

  const ensure = () => {
    if (!qr) qr = new Html5Qrcode(READER_ID);
    return qr;
  };

  const preferBackCameraId = (cams: CameraInfo[]) => {
    // Labels can be empty until permission granted.
    const byLabel = cams.find((c) => /back|rear|environment/i.test(c.label));
    if (byLabel) return byLabel.id;

    // Heuristic: many devices list front first, back later.
    if (cams.length >= 2) return cams[cams.length - 1].id;

    return cams[0]?.id ?? '';
  };

  return {
    scanning: false,
    flashOn: false,
    showSuccessModal: false,
    scannedUser: null as ScannedUser | null,
    error: null as string | null,

    scanAllowed: true as boolean | null,
    scanReason: '' as string,

    locationId: '',

    // Locations
    locations: [] as LocationInfo[],
    locationLoading: false,


    // NEW: camera switching
    cameras: [] as CameraInfo[],
    activeCameraId: '' as string,

    async init() {
      if (initialized) return;
      initialized = true;

      // Preload cameras list (labels may be empty until permission)
      try {
        if (!this.locationId) {
          this.scanAllowed = false;
          this.scanReason = 'Please select a location before scanning.';
          this.showSuccessModal = true;
          return;
        }

        const cams = await Html5Qrcode.getCameras();
        this.cameras = (cams || []).map((c) => ({ id: c.id, label: c.label || '' }));
        if (!this.activeCameraId && this.cameras.length) {
          this.activeCameraId = preferBackCameraId(this.cameras);
        }
      } catch {
        // ignore
      }

      await this.loadLocations();

      await this.loadLocations();

      await this.startScan();
    },

    
    async loadLocations() {
      this.locationLoading = true;
      try {
        const res = await fetch('/api/v1/locations', { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        const locs = (j.locations || []) as LocationInfo[];
        this.locations = locs;

        // Default to first location if none selected
        if (!this.locationId && locs.length) {
          this.locationId = locs[0].id;
        }
      } catch {
        // ignore (UI will show empty list)
      } finally {
        this.locationLoading = false;
      }
    },

async refreshCameras() {
      try {
        const cams = await Html5Qrcode.getCameras();
        this.cameras = (cams || []).map((c) => ({ id: c.id, label: c.label || '' }));

        // If we don't have an active camera yet, pick back/default.
        if (!this.activeCameraId && this.cameras.length) {
          this.activeCameraId = preferBackCameraId(this.cameras);
        }
      } catch {
        // ignore
      }
    },

    async cycleCamera() {
      // Only if we have multiple cameras
      await this.refreshCameras();
      if (!this.cameras || this.cameras.length < 2) return;

      const currentIdx = this.cameras.findIndex((c) => c.id === this.activeCameraId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % this.cameras.length : 0;
      this.activeCameraId = this.cameras[nextIdx].id;

      // Restart scan on next camera
      const wasScanning = this.scanning;
      if (wasScanning) await this.stopScan();
      await this.startScan();
    },

    async startScan() {
      this.error = null;
      this.scannedUser = null;
      this.showSuccessModal = false;
      this.scanAllowed = null;
      this.scanReason = '';

      const el = document.getElementById(READER_ID) as HTMLElement | null;
      if (!el) {
        this.error = 'Scanner element not found (#qr-reader).';
        return;
      }

      // Force size before start (prevents 0-width container issues)
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minWidth = '100%';
      el.style.minHeight = '100%';

      if (this.scanning || starting) return;
      starting = true;
      decodeFails = 0;

      try {
        const inst = ensure();

        // Prefer explicit cameraId if known; otherwise prefer back camera via facingMode=environment
        let cameraConfig: any;
        if (this.activeCameraId) {
          cameraConfig = { deviceId: { exact: this.activeCameraId } };
        } else {
          cameraConfig = { facingMode: { ideal: 'environment' } };
        }

        await inst.start(
          cameraConfig,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            console.log('[QR] decodedText:', decodedText);
            await this.handleScanResult(decodedText);
            await this.stopScan();
          },
          () => {
            decodeFails++;
            if (decodeFails % 60 === 0) console.debug('[QR] scanning... no decode yet');
          }
        );

        // After permission is granted, camera labels usually become available. Refresh + choose best back camera once.
        await this.refreshCameras();
        if (!this.activeCameraId && this.cameras.length) {
          this.activeCameraId = preferBackCameraId(this.cameras);
        }

        this.scanning = true;
      } catch (e: any) {
        this.scanning = false;
        this.error =
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and try again.'
            : (e?.message ?? String(e));
      } finally {
        starting = false;
      }
    },

    async stopScan() {
      const inst = qr;
      try {
        if (inst && this.scanning) await inst.stop();
      } catch {}
      try {
        if (inst) await inst.clear();
      } catch {}
      this.scanning = false;
      this.flashOn = false;
    },

    async toggleFlash() {
      const inst = qr;
      if (!inst || !this.scanning) {
        this.error = 'Start scanning before using flashlight.';
        return;
      }
      const next = !this.flashOn;
      try {
        await inst.applyVideoConstraints({
          advanced: [{ torch: next }],
          torch: next,
        } as any);
        this.flashOn = next;
      } catch {
        this.error = 'Torch/flashlight is not supported on this device/browser.';
      }
    },

    uploadQRCode() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const wasScanning = this.scanning;
        if (wasScanning) await this.stopScan();

        try {
          const inst = ensure();
          const decodedText = await inst.scanFile(file, true);
          console.log('[QR] decodedText (file):', decodedText);
          await this.handleScanResult(decodedText);
        } catch (e: any) {
          this.error = e?.message ?? 'Failed to read QR from image.';
        } finally {
          if (wasScanning && !this.showSuccessModal) await this.startScan();
        }
      };
      input.click();
    },

    async handleScanResult(code: string) {
      this.error = null;
      this.scanAllowed = null;
      this.scanReason = '';

      try {
        const res = await fetch('/api/v1/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ qr: code, locationId: this.locationId }),
        });

        const data = (await res.json()) as ScanAPIResponse;

        if (data.allowed) {
          this.scanAllowed = true;
          this.scannedUser = {
            name: data.userId ? `Member #${data.userId}` : 'Member',
            plan: data.planName || data.planId || 'Active Plan',
          };
        } else {
          this.scanAllowed = false;
          this.scanReason = data.reason || 'Denied';
          this.scannedUser = null;
        }

        this.showSuccessModal = true;
      } catch {
        this.error = 'Scan service unavailable. Try again.';
      }
    },

    closeModal() {
      this.showSuccessModal = false;
      this.scannedUser = null;
      this.scanAllowed = null;
      this.scanReason = '';
      this.startScan();
    },
  };
}
