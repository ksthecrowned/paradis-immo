'use client';

import { useEffect } from 'react';

/**
 * Mounts the Preline UI runtime in the browser. The package is
 * imported lazily on the client because it touches `document` at
 * import time (registering `data-hs-*` behaviours).
 */
export function PrelineBoot(): null {
  useEffect(() => {
    // Dynamic import so the bundle is excluded from the server
    // pass and only loaded after hydration.
    void import('preline').then(() => {
      // Preline attaches its initialisers on `window.HSStaticMethods`
      // when imported; no extra call is needed for the default
      // auto-initialisation mode. If you later switch to non-auto,
      // call `window.HSStaticMethods.autoInit()` here.
    });
  }, []);
  return null;
}