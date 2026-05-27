/**
 * Per-event theme color → Tailwind class names mapping.
 * Used on EventPublicView to swap accent gradients/pills based on
 * the premium themeColor field.
 */

export type ThemeColor = 'rose' | 'violet' | 'emerald' | 'amber' | 'sky' | 'slate'

export interface ThemeStyles {
  /** Full-bleed page background — soft tint */
  pageBg: string
  /** Hero cover fallback gradient (when no coverPreset image) */
  coverGradient: string
  /** Primary CTA button gradient */
  primaryGradient: string
  /** Accent pill / chip background */
  accentBg: string
  /** Accent text colour */
  accentText: string
}

const THEMES: Record<ThemeColor, ThemeStyles> = {
  rose: {
    pageBg: 'bg-gradient-to-b from-rose-50 via-amber-50/40 to-white',
    coverGradient: 'from-rose-300 to-amber-200',
    primaryGradient: 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400',
    accentBg: 'bg-rose-100',
    accentText: 'text-rose-700',
  },
  violet: {
    pageBg: 'bg-gradient-to-b from-violet-50 via-fuchsia-50/40 to-white',
    coverGradient: 'from-violet-400 to-fuchsia-300',
    primaryGradient: 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-400',
    accentBg: 'bg-violet-100',
    accentText: 'text-violet-700',
  },
  emerald: {
    pageBg: 'bg-gradient-to-b from-emerald-50 via-lime-50/40 to-white',
    coverGradient: 'from-emerald-300 to-lime-200',
    primaryGradient: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-lime-400',
    accentBg: 'bg-emerald-100',
    accentText: 'text-emerald-700',
  },
  amber: {
    pageBg: 'bg-gradient-to-b from-amber-50 via-orange-50/40 to-white',
    coverGradient: 'from-amber-300 to-orange-400',
    primaryGradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-400',
    accentBg: 'bg-amber-100',
    accentText: 'text-amber-700',
  },
  sky: {
    pageBg: 'bg-gradient-to-b from-sky-50 via-indigo-50/40 to-white',
    coverGradient: 'from-sky-300 to-indigo-300',
    primaryGradient: 'bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500',
    accentBg: 'bg-sky-100',
    accentText: 'text-sky-700',
  },
  slate: {
    pageBg: 'bg-gradient-to-b from-slate-50 to-white',
    coverGradient: 'from-slate-700 to-slate-400',
    primaryGradient: 'bg-gradient-to-r from-slate-800 to-slate-500',
    accentBg: 'bg-slate-200',
    accentText: 'text-slate-800',
  },
}

const DEFAULT_THEME: ThemeStyles = {
  pageBg: '',
  coverGradient: 'from-rose-200 to-amber-100',
  primaryGradient: 'bg-gradient-celebratory',
  accentBg: 'bg-brand-50',
  accentText: 'text-brand-700',
}

export function themeStyles(themeColor: ThemeColor | null | undefined): ThemeStyles {
  if (!themeColor) return DEFAULT_THEME
  return THEMES[themeColor] ?? DEFAULT_THEME
}
