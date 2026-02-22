// Theme colors - World-class design system

export const darkTheme = {
  name: 'dark',
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
  },
  // Agent status colors (for AgentTree getStatus)
  agentStatus: {
    active:  { dot: 'bg-emerald-500 animate-pulse', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    idle:    { dot: 'bg-yellow-400',                 bg: 'bg-yellow-500/15',  text: 'text-yellow-400' },
    stale:   { dot: 'bg-orange-400 animate-pulse',   bg: 'bg-orange-500/15',  text: 'text-orange-400' },
    timeout: { dot: 'bg-amber-500 animate-ping',     bg: 'bg-amber-500/15',   text: 'text-amber-400' },
    stopped: { dot: 'bg-gray-600',                   bg: 'bg-gray-500/15',    text: 'text-gray-500' },
    unknown: { dot: 'bg-gray-700',                   bg: 'bg-gray-500/15',    text: 'text-gray-600' },
  },
  // Model badge colors
  model: {
    opus:    { bg: 'bg-violet-500/15', text: 'text-violet-400' },
    sonnet:  { bg: 'bg-sky-500/15',    text: 'text-sky-400' },
    haiku:   { bg: 'bg-teal-500/15',   text: 'text-teal-400' },
    unknown: { bg: 'bg-gray-500/15',   text: 'text-gray-400' },
  },
  // Agent type colors
  agentType: {
    explore:  { bg: 'bg-sky-500/15',     text: 'text-sky-400' },
    plan:     { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
    bash:     { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
    code:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    research: { bg: 'bg-violet-500/15',  text: 'text-violet-400' },
    general:  { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
    fallback: { bg: 'bg-pink-500/15',    text: 'text-pink-400' },
  },
  // Tool style colors
  tool: {
    read:    { bg: 'bg-sky-500/15',    text: 'text-sky-500' },
    edit:    { bg: 'bg-orange-500/15', text: 'text-orange-500' },
    bash:    { bg: 'bg-amber-500/15',  text: 'text-amber-500' },
    task:    { bg: 'bg-violet-500/15', text: 'text-violet-500' },
    web:     { bg: 'bg-cyan-500/15',   text: 'text-cyan-500' },
    team:    { bg: 'bg-indigo-500/15', text: 'text-indigo-500' },
    teamDel: { bg: 'bg-gray-500/15',   text: 'text-gray-500' },
    mcp:     { bg: 'bg-pink-500/15',   text: 'text-pink-500' },
    default: { bg: 'bg-cyan-500/15',   text: 'text-cyan-500' },
  },
  // Event type colors (for activity feed)
  event: {
    sessionStart:  { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    sessionEnd:    { color: 'text-gray-400',    bg: 'bg-gray-400/10' },
    preTool:       { color: 'text-cyan-400',    bg: 'bg-cyan-400/10' },
    postTool:      { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    postToolFail:  { color: 'text-red-400',     bg: 'bg-red-400/10' },
    subagentStart: { color: 'text-violet-400',  bg: 'bg-violet-400/10' },
    subagentStop:  { color: 'text-violet-400',  bg: 'bg-violet-400/10' },
    userPrompt:    { color: 'text-amber-400',   bg: 'bg-amber-400/10' },
    stop:          { color: 'text-red-400',     bg: 'bg-red-400/10' },
    permission:    { color: 'text-orange-400',  bg: 'bg-orange-400/10' },
    compact:       { color: 'text-slate-400',   bg: 'bg-slate-400/10' },
    notification:  { color: 'text-sky-400',     bg: 'bg-sky-400/10' },
    unknown:       { color: 'text-gray-400',    bg: 'bg-gray-400/10' },
  },
  // Health indicator colors
  health: {
    red:    { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/20' },
    orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/20' },
    yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/20' },
    green:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  },
  // Semantic UI colors (for filter buttons, footer, team comms, etc.)
  semantic: {
    cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/20',    bgHover: 'hover:bg-cyan-500/10',    ring: 'ring-cyan-500/50' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', bgHover: 'hover:bg-emerald-500/10', ring: 'ring-emerald-500/50' },
    red:     { text: 'text-red-400',     bg: 'bg-red-500/20',     bgHover: 'hover:bg-red-500/10',     ring: 'ring-red-500/50' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/20',   bgHover: 'hover:bg-amber-500/10',   ring: 'ring-amber-500/50' },
    gray:    { text: 'text-gray-400',    bg: 'bg-gray-500/20',    bgHover: 'hover:bg-gray-500/10',    ring: 'ring-gray-500/50' },
    violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/20',  bgHover: 'hover:bg-violet-500/10',  ring: 'ring-violet-500/50' },
    blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/20',    bgHover: 'hover:bg-blue-500/10',    ring: 'ring-blue-500/50' },
    indigo:  { text: 'text-indigo-400',  bg: 'bg-indigo-500/20',  bgHover: 'hover:bg-indigo-500/10',  ring: 'ring-indigo-500/50' },
    orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/20',  bgHover: 'hover:bg-orange-500/10',  ring: 'ring-orange-500/50' },
    yellow:  { text: 'text-yellow-400',  bg: 'bg-yellow-500/20',  bgHover: 'hover:bg-yellow-500/10',  ring: 'ring-yellow-500/50' },
    sky:     { text: 'text-sky-400',     bg: 'bg-sky-500/20',     bgHover: 'hover:bg-sky-500/10',     ring: 'ring-sky-500/50' },
  },
  // Git diff colors
  git: {
    addBg: 'bg-green-500/8', addDot: 'bg-green-400', addText: 'text-green-400',
    delBg: 'bg-red-500/8',   delDot: 'bg-red-400',   delText: 'text-red-400',
    fileBorder: 'border-gray-700/40', fileText: 'text-gray-500',
  },
  // Team section
  team: {
    headerBg: 'bg-indigo-500/[0.05]',
    headerBorder: 'border-indigo-500/10',
    iconBg: 'bg-white/15',
    iconText: 'text-gray-100',
    nameText: 'text-gray-100',
    memberNameBg: 'bg-white/15',
    memberNameText: 'text-gray-100',
    nonTeamNameBg: 'bg-cyan-500/15',
    nonTeamNameText: 'text-cyan-400',
    badgeActive: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
    badgeInactive: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  },
  // Miscellaneous element colors
  misc: {
    sessionNum: 'text-white',
    duration: 'text-gray-400',
    durationFallback: 'text-gray-500',
    tokens: 'text-amber-500',
    sessionId: 'text-gray-600',
    projectName: 'text-cyan-400/70',
    description: 'text-gray-400',
    toolBadgeText: 'text-sky-400/80',
    toolBadgeBg: 'bg-sky-500/10',
    tokenBarTrack: 'bg-gray-700/30',
    tokenBarFill: 'bg-amber-500/50',
    tokenPct: 'text-amber-500/70',
    selectedBg: 'bg-blue-500/15',
    errorBg: 'bg-red-500/10',
    activeBg: 'bg-emerald-500/[0.03]',
    fileConflict: 'bg-red-500/15 text-red-400 border-red-500/20',
    separator: 'border-gray-800/20',
    footerDotActive: 'bg-emerald-400',
    footerDotInactive: 'bg-gray-600',
    footerActiveText: 'text-emerald-400',
    footerDoneText: 'text-gray-500',
  },
  // Team comms type colors
  commType: {
    message: 'text-cyan-400',
    broadcast: 'text-amber-400',
    shutdown_request: 'text-red-400',
    shutdown_response: 'text-orange-400',
    idle: 'text-yellow-400',
    task_completed: 'text-emerald-400',
    fallback: 'text-gray-400',
  },
};

export const lightTheme = {
  name: 'light',
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
  },
  // Agent status colors
  agentStatus: {
    active:  { dot: 'bg-emerald-500 animate-pulse', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
    idle:    { dot: 'bg-yellow-500',                 bg: 'bg-yellow-50',   text: 'text-yellow-700' },
    stale:   { dot: 'bg-orange-500 animate-pulse',   bg: 'bg-orange-50',   text: 'text-orange-700' },
    timeout: { dot: 'bg-amber-500 animate-ping',     bg: 'bg-amber-50',    text: 'text-amber-700' },
    stopped: { dot: 'bg-slate-400',                  bg: 'bg-slate-100',   text: 'text-slate-500' },
    unknown: { dot: 'bg-slate-300',                  bg: 'bg-slate-100',   text: 'text-slate-400' },
  },
  // Model badge colors
  model: {
    opus:    { bg: 'bg-violet-100', text: 'text-violet-700' },
    sonnet:  { bg: 'bg-sky-100',    text: 'text-sky-700' },
    haiku:   { bg: 'bg-teal-100',   text: 'text-teal-700' },
    unknown: { bg: 'bg-slate-100',  text: 'text-slate-500' },
  },
  // Agent type colors
  agentType: {
    explore:  { bg: 'bg-sky-50',     text: 'text-sky-700' },
    plan:     { bg: 'bg-amber-50',   text: 'text-amber-700' },
    bash:     { bg: 'bg-orange-50',  text: 'text-orange-700' },
    code:     { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    research: { bg: 'bg-violet-50',  text: 'text-violet-700' },
    general:  { bg: 'bg-blue-50',    text: 'text-blue-700' },
    fallback: { bg: 'bg-pink-50',    text: 'text-pink-700' },
  },
  // Tool style colors
  tool: {
    read:    { bg: 'bg-sky-50',    text: 'text-sky-700' },
    edit:    { bg: 'bg-orange-50', text: 'text-orange-700' },
    bash:    { bg: 'bg-amber-50',  text: 'text-amber-700' },
    task:    { bg: 'bg-violet-50', text: 'text-violet-700' },
    web:     { bg: 'bg-cyan-50',   text: 'text-cyan-700' },
    team:    { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    teamDel: { bg: 'bg-slate-100', text: 'text-slate-600' },
    mcp:     { bg: 'bg-pink-50',   text: 'text-pink-700' },
    default: { bg: 'bg-cyan-50',   text: 'text-cyan-700' },
  },
  // Event type colors (for activity feed)
  event: {
    sessionStart:  { color: 'text-emerald-700', bg: 'bg-emerald-50' },
    sessionEnd:    { color: 'text-slate-500',   bg: 'bg-slate-50' },
    preTool:       { color: 'text-cyan-700',    bg: 'bg-cyan-50' },
    postTool:      { color: 'text-emerald-700', bg: 'bg-emerald-50' },
    postToolFail:  { color: 'text-red-700',     bg: 'bg-red-50' },
    subagentStart: { color: 'text-violet-700',  bg: 'bg-violet-50' },
    subagentStop:  { color: 'text-violet-700',  bg: 'bg-violet-50' },
    userPrompt:    { color: 'text-amber-700',   bg: 'bg-amber-50' },
    stop:          { color: 'text-red-700',     bg: 'bg-red-50' },
    permission:    { color: 'text-orange-700',  bg: 'bg-orange-50' },
    compact:       { color: 'text-slate-600',   bg: 'bg-slate-50' },
    notification:  { color: 'text-sky-700',     bg: 'bg-sky-50' },
    unknown:       { color: 'text-slate-500',   bg: 'bg-slate-50' },
  },
  // Health indicator colors
  health: {
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    green:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  },
  // Semantic UI colors (for filter buttons, footer, team comms, etc.)
  semantic: {
    cyan:    { text: 'text-cyan-700',    bg: 'bg-cyan-100',    bgHover: 'hover:bg-cyan-50',    ring: 'ring-cyan-300' },
    emerald: { text: 'text-emerald-700', bg: 'bg-emerald-100', bgHover: 'hover:bg-emerald-50', ring: 'ring-emerald-300' },
    red:     { text: 'text-red-700',     bg: 'bg-red-100',     bgHover: 'hover:bg-red-50',     ring: 'ring-red-300' },
    amber:   { text: 'text-amber-700',   bg: 'bg-amber-100',   bgHover: 'hover:bg-amber-50',   ring: 'ring-amber-300' },
    gray:    { text: 'text-slate-600',   bg: 'bg-slate-200',   bgHover: 'hover:bg-slate-100',  ring: 'ring-slate-300' },
    violet:  { text: 'text-violet-700',  bg: 'bg-violet-100',  bgHover: 'hover:bg-violet-50',  ring: 'ring-violet-300' },
    blue:    { text: 'text-blue-700',    bg: 'bg-blue-100',    bgHover: 'hover:bg-blue-50',    ring: 'ring-blue-300' },
    indigo:  { text: 'text-indigo-700',  bg: 'bg-indigo-100',  bgHover: 'hover:bg-indigo-50',  ring: 'ring-indigo-300' },
    orange:  { text: 'text-orange-700',  bg: 'bg-orange-100',  bgHover: 'hover:bg-orange-50',  ring: 'ring-orange-300' },
    yellow:  { text: 'text-yellow-700',  bg: 'bg-yellow-100',  bgHover: 'hover:bg-yellow-50',  ring: 'ring-yellow-300' },
    sky:     { text: 'text-sky-700',     bg: 'bg-sky-100',     bgHover: 'hover:bg-sky-50',     ring: 'ring-sky-300' },
  },
  // Git diff colors
  git: {
    addBg: 'bg-green-50', addDot: 'bg-green-500', addText: 'text-green-700',
    delBg: 'bg-red-50',   delDot: 'bg-red-500',   delText: 'text-red-700',
    fileBorder: 'border-slate-200', fileText: 'text-slate-500',
  },
  // Team section
  team: {
    headerBg: 'bg-indigo-50',
    headerBorder: 'border-indigo-200',
    iconBg: 'bg-slate-200',
    iconText: 'text-slate-700',
    nameText: 'text-slate-800',
    memberNameBg: 'bg-slate-200',
    memberNameText: 'text-slate-700',
    nonTeamNameBg: 'bg-cyan-50',
    nonTeamNameText: 'text-cyan-700',
    badgeActive: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badgeInactive: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  // Miscellaneous element colors
  misc: {
    sessionNum: 'text-slate-900',
    duration: 'text-slate-500',
    durationFallback: 'text-slate-400',
    tokens: 'text-amber-700',
    sessionId: 'text-slate-400',
    projectName: 'text-cyan-700',
    description: 'text-slate-500',
    toolBadgeText: 'text-sky-700',
    toolBadgeBg: 'bg-sky-50',
    tokenBarTrack: 'bg-slate-200',
    tokenBarFill: 'bg-amber-500',
    tokenPct: 'text-amber-600',
    selectedBg: 'bg-blue-50',
    errorBg: 'bg-red-50',
    activeBg: 'bg-emerald-50/50',
    fileConflict: 'bg-red-50 text-red-700 border-red-200',
    separator: 'border-slate-100',
    footerDotActive: 'bg-emerald-500',
    footerDotInactive: 'bg-slate-300',
    footerActiveText: 'text-emerald-600',
    footerDoneText: 'text-slate-500',
  },
  // Team comms type colors
  commType: {
    message: 'text-cyan-700',
    broadcast: 'text-amber-700',
    shutdown_request: 'text-red-700',
    shutdown_response: 'text-orange-700',
    idle: 'text-yellow-600',
    task_completed: 'text-emerald-700',
    fallback: 'text-slate-500',
  },
};

// Get colors based on theme name
export function getThemeColors(themeName) {
  return themeName === 'dark' ? darkTheme : lightTheme;
}
