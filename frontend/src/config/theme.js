// Theme colors - World-class design system

export const darkTheme = {
  // Dark Theme - Deep purple-tinted blacks
  bg: {
    primary: 'bg-[#0f0f17]',
    secondary: 'bg-[#1a1a24]',
    tertiary: 'bg-[#25253a]',
    hover: 'bg-[#2a2a3f]',
    input: 'bg-[#1a1a24]',
    header: 'bg-[#0d0d14]',
    footer: 'bg-[#0d0d14]',
    tasks: 'bg-black/10'
  },
  text: {
    primary: 'text-gray-100',
    secondary: 'text-gray-200',
    tertiary: 'text-gray-300',
    muted: 'text-gray-400',
    inverse: 'text-gray-900',
    title: 'text-white',
    clock: 'text-gray-500'
  },
  border: 'border-[#2a2a3f]',
  shadow: 'shadow-lg shadow-black/20',
  status: {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    info: 'text-cyan-400'
  },
  progressBg: 'bg-gray-800',
  card: 'bg-[#1a1a24] border-[#2a2a3f]',
  cardHover: 'hover:bg-[#22222f]',
  // Buttons (header style)
  button: {
    base: 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20',
    text: 'text-gray-400 hover:text-gray-200'
  },
  // Status badge backgrounds
  badge: {
    normal: 'bg-green-500/15 text-green-400',
    warning: 'bg-yellow-500/15 text-yellow-400',
    danger: 'bg-red-500/15 text-red-400',
    neutral: 'bg-gray-500/15 text-gray-400'
  },
  // Session tags
  tag: {
    active: 'bg-blue-500 text-white',
    inactive: 'bg-[#25253a] text-gray-400 hover:bg-white/10'
  },
  // Section headers gradient
  sectionHeader: {
    token: 'bg-gradient-to-r from-emerald-500/[0.08] via-cyan-500/[0.05] to-transparent',
    agents: 'bg-gradient-to-r from-violet-500/[0.08] via-purple-500/[0.05] to-transparent',
    activity: 'bg-gradient-to-r from-blue-500/[0.08] via-sky-500/[0.05] to-transparent',
    detail: 'bg-gradient-to-r from-[#1a1a28] to-[#12121a]'
  },
  eventDetail: 'bg-gradient-to-r from-[#1a1a28] to-[#12121a]',
  // Accent text colors
  accent: {
    token: 'text-emerald-400/80',
    agents: 'text-violet-400/80',
    agentsCount: 'text-violet-300/70',
    activity: 'text-blue-400/80'
  }
};

export const lightTheme = {
  // Light Theme - Clean, modern, world-class
  bg: {
    primary: 'bg-[#f8fafc]',
    secondary: 'bg-white',
    tertiary: 'bg-slate-100',
    hover: 'bg-slate-200',
    input: 'bg-white',
    header: 'bg-white',
    footer: 'bg-white',
    tasks: 'bg-slate-50'
  },
  text: {
    primary: 'text-slate-900',
    secondary: 'text-slate-700',
    tertiary: 'text-slate-600',
    muted: 'text-slate-500',
    inverse: 'text-white',
    title: 'text-slate-800',
    clock: 'text-slate-400'
  },
  border: 'border-slate-200',
  shadow: 'shadow-sm shadow-slate-200/60',
  status: {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    info: 'text-cyan-600'
  },
  progressBg: 'bg-slate-200',
  card: 'bg-white border-slate-200',
  cardHover: 'hover:bg-slate-50',
  // Buttons (light style)
  button: {
    base: 'bg-slate-100 hover:bg-slate-200 border-slate-200 hover:border-slate-300',
    text: 'text-slate-600 hover:text-slate-900'
  },
  // Status badge backgrounds
  badge: {
    normal: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  },
  // Session tags
  tag: {
    active: 'bg-blue-500 text-white shadow-sm',
    inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  },
  // Section headers gradient (subtle for light mode)
  sectionHeader: {
    token: 'bg-gradient-to-r from-emerald-50 via-emerald-25 to-white',
    agents: 'bg-gradient-to-r from-violet-50 via-violet-25 to-white',
    activity: 'bg-gradient-to-r from-blue-50 via-blue-25 to-white',
    detail: 'bg-gradient-to-r from-slate-50 to-white'
  },
  eventDetail: 'bg-gradient-to-r from-slate-50 to-white',
  // Accent text colors
  accent: {
    token: 'text-emerald-600',
    agents: 'text-violet-600',
    agentsCount: 'text-violet-500',
    activity: 'text-blue-600'
  }
};

// Get colors based on theme name
export function getThemeColors(themeName) {
  return themeName === 'dark' ? darkTheme : lightTheme;
}
