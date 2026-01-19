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

export function scannerStore() {
  let qr: Html5Qrcode | null = null;
  let starting = false;
  let decodeFails = 0;
  let initialized = false;

  const ensure = () => {
    if (!qr) qr = new Html5Qrcode(READER_ID);
    return qr;
  };

  return {
    scanning: false,
    flashOn: false,
    showSuccessModal: false,
    scannedUser: null as ScannedUser | null,
    error: null as string | null,

    // NEW: used by the modal template
    scanAllowed: true as boolean | null,
    scanReason: '' as string,

    // Demo default
    locationId: 'loc-1',

    async init() {
      if (initialized) return;
      initialized = true;
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

      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minWidth = '100%';
      el.style.minHeight = '100%';

      if (this.scanning || starting) return;

      starting = true;
      decodeFails = 0;

      try {
        const inst = ensure();

        let cameraConfig: any = { facingMode: 'environment' };
        try {
          const cams = await Html5Qrcode.getCameras();
          if (cams?.length) cameraConfig = { deviceId: { exact: cams[0].id } };
        } catch {}

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

    async simulateScan() {
      const code = `CARWASH-4-${Date.now()}`;
      await this.handleScanResult(code);
    },
  };
}
