import { DevSettings, I18nManager, Platform } from 'react-native';

const OVERRIDE_STYLE_ID = 'rtl-text-align-override';

/**
 * React Native Paper hardcodes `textAlign: 'left'` on its base Text style, and
 * React Native Web's I18nManager is a no-op stub whose isRTL is permanently
 * false - so neither library will flip that for a Hebrew UI, and Paper's own
 * internals (List.Item, Card, Dialog…) render left-aligned text we cannot
 * reach from our own styles.
 *
 * A blanket `text-align: right` would also wreck genuinely centred text such
 * as button labels. Instead we find the exact atomic rule React Native Web
 * emitted for `text-align: left` and override only that one, at higher
 * specificity. Doing it by lookup rather than by hardcoded class name keeps it
 * working if the library changes how it names things.
 */
function flipDefaultTextAlign(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(OVERRIDE_STYLE_ID)) return;

  const selectors: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet; nothing of ours in there
    }
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule;
      if (styleRule.selectorText && styleRule.style?.textAlign === 'left') {
        selectors.push(styleRule.selectorText);
      }
    }
  }

  if (selectors.length === 0) return;

  const style = document.createElement('style');
  style.id = OVERRIDE_STYLE_ID;
  style.textContent = selectors
    .map((selector) => `html[dir="rtl"] ${selector} { text-align: right; }`)
    .join('\n');
  document.head.appendChild(style);
}

/**
 * Call once the first render has produced React Native Web's stylesheet.
 * Safe to call repeatedly - it installs the override at most once.
 */
export function applyWebTextAlignFix(): void {
  if (Platform.OS !== 'web') return;
  flipDefaultTextAlign();
}

/** Forces right-to-left layout for the Hebrew-only UI. */
export function ensureRTL(): void {
  I18nManager.allowRTL(true);

  if (Platform.OS === 'web') {
    // app/+html.tsx already ships dir="rtl"; this covers a document created
    // some other way (e.g. a static host serving its own shell).
    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
    }
    return;
  }

  if (I18nManager.isRTL) return;

  I18nManager.forceRTL(true);

  if (__DEV__ && DevSettings?.reload) {
    DevSettings.reload();
  }
  // In production builds the app already launches RTL from the second run
  // onward (the native module persists the flag); no user-facing action needed.
}
