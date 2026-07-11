import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Inline script run before paint to avoid a flash of the wrong theme.
 * Must stay free of imports that rely on React hydration.
 */
export function ThemeScript(): React.JSX.Element {
  const code = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var r=document.documentElement;r.setAttribute('data-bs-theme',t);r.setAttribute('data-topbar-color',t);r.setAttribute('data-sidebar-color',t);r.style.colorScheme=t;}catch(e){}})();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: code }}
      suppressHydrationWarning
    />
  );
}
