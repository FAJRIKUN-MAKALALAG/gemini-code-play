export const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return (
      e instanceof DOMException &&
      // everything except Firefox
      (e.code === 22 ||
        // Firefox
        e.code === 1014 ||
        // test name field too, because code might not be present
        // everything except Firefox
        e.name === 'QuotaExceededError' ||
        // Firefox
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
      // acknowledge QuotaExceededError only if there's something already stored
      window[type] &&
      window[type].length !== 0
    );
  }
};

class SafeStorage {
  private available: boolean;
  private type: 'localStorage' | 'sessionStorage';

  constructor(type: 'localStorage' | 'sessionStorage' = 'localStorage') {
    this.type = type;
    this.available = isStorageAvailable(type);
  }

  getItem(key: string): string | null {
    if (!this.available) return null;
    try {
      return window[this.type].getItem(key);
    } catch (e) {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.available) return;
    try {
      window[this.type].setItem(key, value);
    } catch (e) {
      console.warn(`SafeStorage: Failed to set item ${key}`, e);
    }
  }

  removeItem(key: string): void {
    if (!this.available) return;
    try {
      window[this.type].removeItem(key);
    } catch (e) {
      console.warn(`SafeStorage: Failed to remove item ${key}`, e);
    }
  }

  clear(): void {
    if (!this.available) return;
    try {
      window[this.type].clear();
    } catch (e) {
      console.warn('SafeStorage: Failed to clear storage', e);
    }
  }
}

export const safeLocalStorage = new SafeStorage('localStorage');
export const safeSessionStorage = new SafeStorage('sessionStorage');
