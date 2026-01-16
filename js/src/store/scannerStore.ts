import { Html5Qrcode } from 'html5-qrcode';
import { SEED_USERS, SEED_SUBSCRIPTIONS } from '../adapters/mockData';

interface ScannedUser {
  name: string;
  plan: string;
}

const READER_ID = 'qr-reader';

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

    async init() {
      if (initialized) return;
      initialized = true;

      console.log('[QR] init() called');
      await this.startScan();
    },

    async startScan() {
      console.log('[QR] startScan() called');

      this.error = null;
      this.scannedUser = null;
      this.showSuccessModal = false;

      const el = document.getElementById(READER_ID) as HTMLElement | null;
      if (!el) {
        this.error = 'Scanner element not found (#qr-reader).';
        console.error('[QR] missing #qr-reader element');
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

        // Prefer explicit camera id when possible (more reliable on desktop)
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
            this.handleScanResult(decodedText);
            await this.stopScan();
          },
          () => {
            decodeFails++;
            if (decodeFails % 60 === 0) console.debug('[QR] scanning... no decode yet');
          }
        );

        console.log('[QR] camera started OK');
        this.scanning = true;
      } catch (e: any) {
        this.scanning = false;
        this.error =
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and try again.'
            : (e?.message ?? String(e));
        console.error('[QR] startScan error:', e);
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
        if (wasScanning) {
          // REQUIRED: html5-qrcode cannot scanFile while camera is running
          await this.stopScan();
        }

        try {
          const inst = ensure();
          const decodedText = await inst.scanFile(file, true);
          console.log('[QR] decodedText (file):', decodedText);
          this.handleScanResult(decodedText);
        } catch (e: any) {
          this.error = e?.message ?? 'Failed to read QR from image.';
          console.error('[QR] scanFile error:', e);
        } finally {
          // If user was scanning and we didn't show a success modal, resume camera.
          if (wasScanning && !this.showSuccessModal) {
            await this.startScan();
          }
        }
      };
      input.click();
    },

    handleScanResult(code: string) {
      console.log('[QR] handleScanResult:', code);

      const parts = code.split('-');
      if (parts.length >= 2 && parts[0] === 'CARWASH') {
        const userId = parts[1];
        const user = SEED_USERS.find((u) => u.id === userId);
        const sub = SEED_SUBSCRIPTIONS.find((s) => s.userId === userId);

        if (user && sub) {
          this.scannedUser = {
            name: `${user.firstName} ${user.lastName}`,
            plan: sub.plan.name,
          };
          this.showSuccessModal = true;
          this.error = null;
        } else {
          this.error = 'Invalid or expired access code';
        }
      } else {
        this.error = 'Invalid QR code format';
      }
    },

    closeModal() {
      this.showSuccessModal = false;
      this.scannedUser = null;
      this.startScan();
    },

    simulateScan() {
      const user = SEED_USERS[0];
      const code = `CARWASH-${user.id}-${Date.now()}`;
      console.log('[QR] decodedText (simulate):', code);
      this.handleScanResult(code);
    },
  };
}
