// In-memory cache cho danh sach lop hoc giup tai tuc thi (<1ms)
let cachedClasses: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 giay

export function getCachedClasses(): any[] | null {
  if (cachedClasses && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedClasses;
  }
  return null;
}

export function setCachedClasses(data: any[]) {
  cachedClasses = data;
  cacheTime = Date.now();
}

export function invalidateClassesCache() {
  cachedClasses = null;
  cacheTime = 0;
}
