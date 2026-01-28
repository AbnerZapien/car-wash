import Alpine from 'alpinejs';
import { authStore } from './authStore';
import { dashboardStore } from './dashboardStore';
import { qrCodeStore } from './qrCodeStore';
import { scannerStore } from './scannerStore';
import { historyStore } from './historyStore';
import { accountStore } from './accountStore';
import { adminStore } from './adminStore';
import { myCarsStore } from './myCarsStore';
import { choosePlanStore } from './choosePlanStore';

export function registerStores() {
  console.log('Registering Alpine stores...');
  Alpine.data('authStore', authStore);
  // Global auth store so any page can call $store.auth.logout()
  const auth = authStore();
  Alpine.store('auth', auth as any);
  if (typeof (auth as any).init === 'function') (auth as any).init();

  Alpine.data('dashboardStore', dashboardStore);
  Alpine.data('qrCodeStore', qrCodeStore);
  Alpine.data('scannerStore', scannerStore);
  Alpine.data('historyStore', historyStore);
  Alpine.data('accountStore', accountStore);
  Alpine.data('adminStore', adminStore);
  Alpine.data('myCarsStore', myCarsStore);
  Alpine.data('choosePlanStore', choosePlanStore);
  console.log('Alpine stores registered');
}

export { authStore, dashboardStore, qrCodeStore, scannerStore, adminStore, myCarsStore };
