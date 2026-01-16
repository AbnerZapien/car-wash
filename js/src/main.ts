import '../css/style.css';
import Alpine from 'alpinejs';
import 'htmx.org';

import { Store } from './store/example';
import { registerStores } from './store';
import { scannerStore } from './store/scannerStore';

declare global {
  interface Window {
    Alpine: typeof Alpine;
    htmx: any;
  }
}

window.Alpine = Alpine;

// Register all Alpine data stores BEFORE starting Alpine
Store();
registerStores();
window.Alpine.data('scannerStore', scannerStore);

window.addEventListener(
  'DOMContentLoaded',
  () => {
    Alpine.start();
  },
  false
);
