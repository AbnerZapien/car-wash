import Alpine from 'alpinejs';
import { authStore } from './authStore';
import { dashboardStore } from './dashboardStore';
import { qrCodeStore } from './qrCodeStore';
import { scannerStore } from './scannerStore';
import { historyStore } from './historyStore';
import { accountStore } from './accountStore';
import { adminStore } from './adminStore';

export function registerStores() {
  console.log('Registering Alpine stores...');
  Alpine.data('authStore', authStore);
  Alpine.data('dashboardStore', dashboardStore);
  Alpine.data('qrCodeStore', qrCodeStore);
  Alpine.data('scannerStore', scannerStore);
  Alpine.data('historyStore', historyStore);
  Alpine.data('accountStore', accountStore);
  Alpine.data('adminStore', adminStore);
  console.log('Alpine stores registered');
}

export { authStore, dashboardStore, qrCodeStore, scannerStore, adminStore };
