import { useState } from 'react';
import PropTypes from 'prop-types';

// Theme color mappings
const getThemeColors = (theme) => ({
  modal: {
    bg: theme === 'light' ? 'bg-white' : 'bg-[#12121a]',
    border: theme === 'light' ? 'border-slate-200' : 'border-[#2a2a3f]',
  },
  sidebar: {
    bg: theme === 'light' ? 'bg-slate-50' : 'bg-[#0d0d14]',
    border: theme === 'light' ? 'border-slate-200' : 'border-[#2a2a3f]',
  },
  card: {
    bg: theme === 'light' ? 'bg-slate-50' : 'bg-[#1a1a24]',
    bgAlt: theme === 'light' ? 'bg-slate-100' : 'bg-[#0d0d14]',
    border: theme === 'light' ? 'border-slate-200' : 'border-[#2a2a3f]',
  },
  code: {
    bg: theme === 'light' ? 'bg-slate-100' : 'bg-black/30',
  },
  text: {
    primary: theme === 'light' ? 'text-slate-900' : 'text-gray-100',
    secondary: theme === 'light' ? 'text-slate-700' : 'text-gray-200',
    tertiary: theme === 'light' ? 'text-slate-600' : 'text-gray-300',
    muted: theme === 'light' ? 'text-slate-500' : 'text-gray-400',
    dimmed: theme === 'light' ? 'text-slate-400' : 'text-gray-500',
    faint: theme === 'light' ? 'text-slate-400' : 'text-gray-600',
  },
  button: {
    bg: theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10',
    border: theme === 'light' ? 'border-slate-200 hover:border-slate-300' : 'border-white/10 hover:border-white/20',
    text: theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-gray-200',
  },
  nav: {
    active: theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400',
    inactive: theme === 'light' ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
  },
  backdrop: theme === 'light' ? 'bg-black/50' : 'bg-black/80',
});

/**
 * Help Guide Modal Component
 * Displays documentation about the dashboard with bilingual support (EN/TH)
 */
export function HelpGuide({ onClose, theme = 'dark', demoMode = false, onDemoToggle }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [lang, setLang] = useState(() => localStorage.getItem('guideLang') || 'en');
  const colors = getThemeColors(theme);

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'th' : 'en';
    setLang(newLang);
    localStorage.setItem('guideLang', newLang);
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'setup', label: 'Setup', icon: '⚙️' },
    { id: 'status', label: 'Status', icon: '🚦' },
    { id: 'tokens', label: 'Tokens', icon: '🎯' },
    { id: 'models', label: 'Models', icon: '🤖' },
    { id: 'agents', label: 'Agents', icon: '👥' },
    { id: 'mini', label: 'Mini Mode', icon: '🪟' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'events', label: 'Events', icon: '📡' },
    { id: 'footer', label: 'Footer', icon: '📈' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className={`absolute inset-0 ${colors.backdrop} backdrop-blur-sm`} onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full max-w-4xl max-h-[85vh] ${colors.modal.bg} border ${colors.modal.border} rounded-2xl shadow-2xl flex overflow-hidden`}>
        {/* Sidebar Navigation */}
        <nav className={`w-48 ${colors.sidebar.bg} border-r ${colors.sidebar.border} p-3 flex flex-col`}>
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">?</span>
            </div>
            <div>
              <div className={`text-[13px] font-bold ${colors.text.primary}`}>Dashboard</div>
              <div className={`text-[11px] ${colors.text.dimmed}`}>User Guide</div>
            </div>
          </div>

          <div className="space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-[13px] ${
                  activeSection === section.id
                    ? `${colors.nav.active} font-medium`
                    : colors.nav.inactive
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          <div className={`mt-auto pt-4 border-t ${colors.sidebar.border}`}>
            <div className={`text-[10px] ${colors.text.faint} px-2`}>
              Oh My Claude v2.0<br />
              Real-time Dashboard
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.modal.border}`}>
            <h2 className={`text-lg font-semibold ${colors.text.primary}`}>
              {sections.find(s => s.id === activeSection)?.icon} {sections.find(s => s.id === activeSection)?.label}
            </h2>
            <div className="flex items-center gap-2">
              {/* Demo Toggle */}
              {onDemoToggle && (
                <button
                  onClick={onDemoToggle}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${colors.button.bg} border ${colors.button.border} transition-all text-[11px] font-medium ${demoMode ? 'text-amber-400 ring-1 ring-amber-500/50' : colors.text.muted}`}
                  title="Toggle Demo Data"
                >
                  <span className="text-[13px]">🧪</span>
                  <span>Demo</span>
                </button>
              )}
              {/* Language Toggle */}
              <button
                onClick={toggleLang}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${colors.button.bg} border ${colors.button.border} transition-all text-[11px] font-medium`}
              >
                <span className={lang === 'en' ? 'text-blue-500' : colors.text.dimmed}>EN</span>
                <span className={colors.text.faint}>/</span>
                <span className={lang === 'th' ? 'text-blue-500' : colors.text.dimmed}>TH</span>
              </button>
              {/* Close Button */}
              <button
                onClick={onClose}
                className={`w-8 h-8 rounded-lg ${colors.button.bg} flex items-center justify-center ${colors.button.text} transition-all`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'overview' && <OverviewSection lang={lang} theme={theme} />}
            {activeSection === 'setup' && <SetupSection lang={lang} theme={theme} />}
            {activeSection === 'status' && <StatusSection lang={lang} theme={theme} />}
            {activeSection === 'tokens' && <TokensSection lang={lang} theme={theme} />}
            {activeSection === 'models' && <ModelsSection lang={lang} theme={theme} />}
            {activeSection === 'agents' && <AgentsSection lang={lang} theme={theme} />}
            {activeSection === 'mini' && <MiniModeSection lang={lang} theme={theme} />}
            {activeSection === 'notifications' && <NotificationsSection lang={lang} theme={theme} />}
            {activeSection === 'events' && <EventsSection lang={lang} theme={theme} />}
            {activeSection === 'footer' && <FooterSection lang={lang} theme={theme} />}
          </div>
        </div>
      </div>
    </div>
  );
}

HelpGuide.propTypes = {
  onClose: PropTypes.func.isRequired,
  theme: PropTypes.oneOf(['dark', 'light']),
  demoMode: PropTypes.bool,
  onDemoToggle: PropTypes.func
};

// Section Components
function OverviewSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      welcome: 'Welcome to Oh My Claude',
      desc: 'Real-time dashboard for monitoring Claude Code usage, token consumption, agent activity, and API costs. All data updates live via WebSocket.',
      tokenTitle: 'Token Tracking',
      tokenDesc: 'Session & Weekly usage with model breakdown',
      agentTitle: 'Agent Tracking',
      agentDesc: 'View Main & Subagent in real-time',
      eventsTitle: 'Live Events',
      eventsDesc: 'Tool calls, prompts, errors streamed live',
      architectureTitle: 'System Architecture',
      archDesc: 'How data flows through the system:',
      archClaudeCode: 'Claude Code',
      archClaudeCodeDesc: 'Terminal / IDE',
      archChromeExt: 'Chrome Extension',
      archChromeExtDesc: 'Scrapes claude.ai',
      archBackend: 'Backend Server',
      archBackendDesc: 'Express + WebSocket',
      archDashboard: 'Dashboard',
      archDashboardDesc: 'React UI',
      archFlow1: 'Hooks send events',
      archFlow2: 'Sync usage %',
      archFlow3: 'WebSocket live updates',
      archData: 'Data stored',
      archDataItems: ['Events', 'Agents', 'Sessions', 'Usage %'],
      layoutTitle: 'Screen Layout',
      header: 'Header',
      headerToolbarTitle: 'Header Toolbar',
      headerLeft: 'Left: App title, LIVE/OFF indicator, sync status',
      headerRight: 'Right: Toolbar buttons (icon-only for compact layout)',
      toolbarViewMode: 'Agent View Mode',
      toolbarViewModeDesc: 'Cycle: Full > Compact > Expanded > Hidden',
      toolbarViewModeNote: 'Only button with text label',
      toolbarTheme: 'Theme',
      toolbarThemeDesc: 'Toggle Dark / Light mode',
      toolbarMini: 'Mini Pop-out',
      toolbarMiniDesc: 'Open floating mini window (220x450px)',
      toolbarNotif: 'Notifications',
      toolbarNotifDesc: 'Toggle: Off / Bell',
      toolbarGuide: 'Guide',
      toolbarGuideDesc: 'Open this help guide (includes Demo toggle)',
      toolbarStatus: 'Status Badge',
      toolbarStatusLabel: 'Session usage status (5-hour window):',
      statusNormal: 'Normal',
      statusNormalRange: '< 60%',
      statusHigh: 'High',
      statusHighRange: '60-84%',
      statusNear: 'Near limit',
      statusNearRange: '85-99%',
      statusFull: 'Full',
      statusFullRange: '100%',
      leftPanel: 'Left Panel',
      leftContent: 'Token Usage (200px)',
      centerPanel: 'Center Panel',
      centerContent: 'Agents (340px)',
      rightPanel: 'Right Panel',
      rightContent: 'Activity Feed (210px, flex when agents hidden)',
      footer: 'Footer',
      footerContent: 'Event filters, monthly cost, clock'
    },
    th: {
      welcome: 'ยินดีต้อนรับสู่ Oh My Claude',
      desc: 'Dashboard แบบ real-time สำหรับติดตามการใช้งาน Claude Code, token, agent และค่าใช้จ่าย API ข้อมูลอัพเดทแบบ live ผ่าน WebSocket',
      tokenTitle: 'Token Tracking',
      tokenDesc: 'การใช้งาน Session & Weekly พร้อมแยกตาม model',
      agentTitle: 'Agent Tracking',
      agentDesc: 'ดู Main & Subagent แบบ real-time',
      eventsTitle: 'Live Events',
      eventsDesc: 'Tool calls, prompts, errors แบบ stream live',
      architectureTitle: 'System Architecture',
      archDesc: 'การไหลของข้อมูลในระบบ:',
      archClaudeCode: 'Claude Code',
      archClaudeCodeDesc: 'Terminal / IDE',
      archChromeExt: 'Chrome Extension',
      archChromeExtDesc: 'ดึงจาก claude.ai',
      archBackend: 'Backend Server',
      archBackendDesc: 'Express + WebSocket',
      archDashboard: 'Dashboard',
      archDashboardDesc: 'React UI',
      archFlow1: 'Hooks ส่ง events',
      archFlow2: 'Sync usage %',
      archFlow3: 'WebSocket live updates',
      archData: 'เก็บข้อมูล',
      archDataItems: ['Events', 'Agents', 'Sessions', 'Usage %'],
      layoutTitle: 'Screen Layout',
      header: 'Header',
      headerToolbarTitle: 'Header Toolbar',
      headerLeft: 'ซ้าย: ชื่อแอป, ไฟ LIVE/OFF, สถานะ sync',
      headerRight: 'ขวา: ปุ่ม Toolbar (แสดงแค่ icon เพื่อประหยัดเนื้อที่)',
      toolbarViewMode: 'Agent View Mode',
      toolbarViewModeDesc: 'สลับ: Full > Compact > Expanded > Hidden',
      toolbarViewModeNote: 'ปุ่มเดียวที่แสดงชื่อโหมด',
      toolbarTheme: 'Theme',
      toolbarThemeDesc: 'สลับ Dark / Light',
      toolbarMini: 'Mini Pop-out',
      toolbarMiniDesc: 'เปิดหน้าต่างลอย mini (220x450px)',
      toolbarNotif: 'Notifications',
      toolbarNotifDesc: 'สลับ: Off / Bell',
      toolbarGuide: 'Guide',
      toolbarGuideDesc: 'เปิดหน้า help นี้ (มีปุ่ม Demo toggle ด้านใน)',
      toolbarStatus: 'Status Badge',
      toolbarStatusLabel: 'สถานะ session usage (5-hour window):',
      statusNormal: 'Normal',
      statusNormalRange: '< 60%',
      statusHigh: 'High',
      statusHighRange: '60-84%',
      statusNear: 'Near limit',
      statusNearRange: '85-99%',
      statusFull: 'Full',
      statusFullRange: '100%',
      leftPanel: 'Left Panel',
      leftContent: 'Token Usage (200px)',
      centerPanel: 'Center Panel',
      centerContent: 'Agents (340px)',
      rightPanel: 'Right Panel',
      rightContent: 'Activity Feed (210px, flex เมื่อซ่อน agents)',
      footer: 'Footer',
      footerContent: 'Event filters, monthly cost, นาฬิกา'
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-gradient-to-r from-blue-500/10 to-violet-500/10 border-blue-500/20'} border`}>
        <h3 className={`text-base font-semibold ${colors.text.primary} mb-2`}>{txt.welcome}</h3>
        <p className={`text-[13px] ${colors.text.muted} leading-relaxed`}>{txt.desc}</p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <div className="text-2xl mb-2">🎯</div>
          <div className={`text-[13px] font-semibold ${colors.text.secondary} mb-1`}>{txt.tokenTitle}</div>
          <div className={`text-[12px] ${colors.text.dimmed}`}>{txt.tokenDesc}</div>
        </div>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <div className="text-2xl mb-2">🤖</div>
          <div className={`text-[13px] font-semibold ${colors.text.secondary} mb-1`}>{txt.agentTitle}</div>
          <div className={`text-[12px] ${colors.text.dimmed}`}>{txt.agentDesc}</div>
        </div>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <div className="text-2xl mb-2">📡</div>
          <div className={`text-[13px] font-semibold ${colors.text.secondary} mb-1`}>{txt.eventsTitle}</div>
          <div className={`text-[12px] ${colors.text.dimmed}`}>{txt.eventsDesc}</div>
        </div>
      </div>

      {/* System Architecture Flowchart */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.architectureTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.archDesc}</p>
        <div className={`p-4 rounded-xl ${colors.card.bgAlt} border ${colors.card.border}`}>
          {/* Data Sources Row */}
          <div className="flex justify-center gap-8 mb-4">
            {/* Claude Code */}
            <div className="text-center">
              <div className="w-20 h-16 rounded-lg bg-violet-500/20 border border-violet-500/30 flex flex-col items-center justify-center mb-1">
                <span className="text-lg">💻</span>
                <span className="text-[9px] text-violet-500 font-medium">{txt.archClaudeCode}</span>
              </div>
              <span className={`text-[8px] ${colors.text.faint}`}>{txt.archClaudeCodeDesc}</span>
            </div>
            {/* Chrome Extension */}
            <div className="text-center">
              <div className="w-20 h-16 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex flex-col items-center justify-center mb-1">
                <span className="text-lg">🌐</span>
                <span className="text-[9px] text-cyan-500 font-medium">{txt.archChromeExt}</span>
              </div>
              <span className={`text-[8px] ${colors.text.faint}`}>{txt.archChromeExtDesc}</span>
            </div>
          </div>

          {/* Arrows Down */}
          <div className="flex justify-center gap-8 mb-2">
            <div className="flex flex-col items-center">
              <span className={colors.text.faint}>↓</span>
              <span className="text-[8px] text-violet-500/70">{txt.archFlow1}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className={colors.text.faint}>↓</span>
              <span className="text-[8px] text-cyan-500/70">{txt.archFlow2}</span>
            </div>
          </div>

          {/* Backend Server */}
          <div className="flex justify-center mb-2">
            <div className="w-48 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">🖥️</span>
                <span className="text-[11px] text-emerald-500 font-semibold">{txt.archBackend}</span>
              </div>
              <span className={`text-[9px] ${colors.text.dimmed}`}>{txt.archBackendDesc} (port 4824)</span>
              <div className="flex justify-center gap-1 mt-2">
                {txt.archDataItems.map((item, i) => (
                  <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex flex-col items-center mb-2">
            <span className={colors.text.faint}>↓</span>
            <span className="text-[8px] text-blue-500/70">{txt.archFlow3}</span>
          </div>

          {/* Dashboard */}
          <div className="flex justify-center">
            <div className="w-48 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">📊</span>
                <span className="text-[11px] text-blue-500 font-semibold">{txt.archDashboard}</span>
              </div>
              <span className={`text-[9px] ${colors.text.dimmed}`}>{txt.archDashboardDesc} (port 4825)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header Toolbar Reference */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.headerToolbarTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.headerRight}</p>

        {/* Toolbar Buttons Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* View Mode */}
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-md ${colors.card.bgAlt} border ${colors.card.border} shrink-0 mt-0.5`}>
              <svg className={`w-3 h-3 ${colors.text.muted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className={`text-[9px] font-medium ${colors.text.muted}`}>Full</span>
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${colors.text.secondary}`}>{txt.toolbarViewMode}</div>
              <div className={`text-[10px] ${colors.text.dimmed} leading-snug`}>{txt.toolbarViewModeDesc}</div>
              <div className={`text-[9px] ${colors.text.faint} mt-0.5 italic`}>{txt.toolbarViewModeNote}</div>
            </div>
          </div>

          {/* Theme */}
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className={`p-1 rounded-md ${colors.card.bgAlt} border ${colors.card.border} shrink-0 mt-0.5`}>
              <svg className={`w-3.5 h-3.5 ${colors.text.muted}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${colors.text.secondary}`}>{txt.toolbarTheme}</div>
              <div className={`text-[10px] ${colors.text.dimmed} leading-snug`}>{txt.toolbarThemeDesc}</div>
            </div>
          </div>

          {/* Mini Pop-out */}
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className={`p-1 rounded-md ${colors.card.bgAlt} border ${colors.card.border} shrink-0 mt-0.5`}>
              <svg className={`w-3.5 h-3.5 ${colors.text.muted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${colors.text.secondary}`}>{txt.toolbarMini}</div>
              <div className={`text-[10px] ${colors.text.dimmed} leading-snug`}>{txt.toolbarMiniDesc}</div>
            </div>
          </div>

          {/* Notifications */}
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className={`p-1 rounded-md ${colors.card.bgAlt} border ${colors.card.border} shrink-0 mt-0.5`}>
              <svg className={`w-3.5 h-3.5 ${colors.text.muted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${colors.text.secondary}`}>{txt.toolbarNotif}</div>
              <div className={`text-[10px] ${colors.text.dimmed} leading-snug`}>{txt.toolbarNotifDesc}</div>
            </div>
          </div>

          {/* Guide */}
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${colors.card.bg} border ${colors.card.border} col-span-2`}>
            <div className={`p-1 rounded-md ${colors.card.bgAlt} border ${colors.card.border} shrink-0 mt-0.5`}>
              <svg className={`w-3.5 h-3.5 ${colors.text.muted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${colors.text.secondary}`}>{txt.toolbarGuide}</div>
              <div className={`text-[10px] ${colors.text.dimmed} leading-snug`}>{txt.toolbarGuideDesc}</div>
            </div>
          </div>
        </div>

        {/* Status Badge - Separate Card */}
        <div className={`rounded-xl border ${colors.card.border} overflow-hidden`}>
          <div className={`${colors.card.bgAlt} px-3 py-2 flex items-center gap-2`}>
            <span className={`text-[11px] font-semibold ${colors.text.secondary}`}>🚦 {txt.toolbarStatus}</span>
            <span className={`text-[10px] ${colors.text.dimmed}`}>— {txt.toolbarStatusLabel}</span>
          </div>
          <div className={`grid grid-cols-4 gap-0 border-t ${colors.card.border}`}>
            {/* Normal */}
            <div className={`p-2.5 text-center border-r ${colors.card.border} ${colors.card.bg}`}>
              <div className="text-lg mb-1">🪴</div>
              <div className="text-[10px] font-semibold text-emerald-500 mb-0.5">{txt.statusNormal}</div>
              <div className={`text-[9px] ${colors.text.dimmed}`}>{txt.statusNormalRange}</div>
            </div>
            {/* High */}
            <div className={`p-2.5 text-center border-r ${colors.card.border} ${colors.card.bg}`}>
              <div className="text-lg mb-1">⚡</div>
              <div className="text-[10px] font-semibold text-amber-500 mb-0.5">{txt.statusHigh}</div>
              <div className={`text-[9px] ${colors.text.dimmed}`}>{txt.statusHighRange}</div>
            </div>
            {/* Near limit */}
            <div className={`p-2.5 text-center border-r ${colors.card.border} ${colors.card.bg}`}>
              <div className="text-lg mb-1">🚨</div>
              <div className="text-[10px] font-semibold text-red-500 mb-0.5">{txt.statusNear}</div>
              <div className={`text-[9px] ${colors.text.dimmed}`}>{txt.statusNearRange}</div>
            </div>
            {/* Full */}
            <div className={`p-2.5 text-center ${colors.card.bg}`}>
              <div className="text-lg mb-1">🫗</div>
              <div className="text-[10px] font-semibold text-rose-500 mb-0.5">{txt.statusFull}</div>
              <div className={`text-[9px] ${colors.text.dimmed}`}>{txt.statusFullRange}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Layout */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.layoutTitle}</h4>
        <div className={`rounded-xl border ${colors.card.border} overflow-hidden`}>
          <div className={`${colors.card.bgAlt} px-4 py-2 text-[12px] ${colors.text.muted}`}>
            <span className="text-green-500">●</span> <strong>{txt.header}:</strong> {txt.headerLeft}
          </div>
          <div className={`flex border-t ${colors.card.border}`}>
            <div className={`w-1/4 p-3 border-r ${colors.card.border} ${colors.card.bg}`}>
              <div className={`text-[11px] ${colors.text.dimmed} uppercase mb-1`}>{txt.leftPanel}</div>
              <div className={`text-[12px] ${colors.text.tertiary}`}>{txt.leftContent}</div>
            </div>
            <div className={`w-1/4 p-3 border-r ${colors.card.border} ${colors.card.bg}`}>
              <div className={`text-[11px] ${colors.text.dimmed} uppercase mb-1`}>{txt.centerPanel}</div>
              <div className={`text-[12px] ${colors.text.tertiary}`}>{txt.centerContent}</div>
            </div>
            <div className={`flex-1 p-3 ${colors.card.bg}`}>
              <div className={`text-[11px] ${colors.text.dimmed} uppercase mb-1`}>{txt.rightPanel}</div>
              <div className={`text-[12px] ${colors.text.tertiary}`}>{txt.rightContent}</div>
            </div>
          </div>
          <div className={`${colors.card.bgAlt} px-4 py-2 text-[12px] ${colors.text.muted} border-t ${colors.card.border}`}>
            <strong>{txt.footer}:</strong> {txt.footerContent}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      title: 'Setting Up Oh My Claude',
      desc: 'The system consists of 4 main parts: Backend Server, Frontend Dashboard, Claude Code Hooks, and Chrome Extension (optional)',
      fileStructure: 'File Structure',
      installSteps: 'Installation Steps',
      step1: 'Install Dependencies',
      step1Desc: 'Run in oh-my-claude folder:',
      step2: 'Configure Claude Code Hooks',
      step2Desc: 'Add hooks to your global Claude settings file:',
      step2File: '~/.claude/settings.json',
      step2FileWin: 'C:\\Users\\<username>\\.claude\\settings.json',
      step2Note: 'Replace <PATH> with your oh-my-claude folder path',
      step2Hooks: ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop', 'PreCompact'],
      step3: 'Install Chrome Extension',
      step3For: 'Optional - for Sync Usage',
      step3Desc: 'Pull Session % and Weekly % directly from Claude.ai:',
      step3Steps: ['Open chrome://extensions/', 'Enable "Developer mode"', 'Click "Load unpacked"', 'Select extension/ folder'],
      step3Note: 'Extension syncs usage data every 1 minute → Shows',
      step3Badge: 'Sync',
      step3Badge2: 'badge in header',
      step4: 'Start the Dashboard',
      step4Desc: 'Run both backend and frontend:',
      step4Note: 'Dashboard opens at',
      step5: 'Install as App (PWA)',
      step5For: 'Optional',
      step5Desc: 'Install as a standalone desktop app for quick access:',
      step5Steps: ['Open http://localhost:4825 in Chrome', 'Click the install icon (⊕) in the address bar', 'Click "Install" in the popup dialog', 'App opens in its own window — pin to taskbar!'],
      step5Note: 'Supports mini mode (280×400) and full dashboard (765×870)',
      ports: 'Ports Used',
      hookExample: 'Hook Configuration Example',
      important: 'Important',
      restartNote: 'Restart Claude Code terminal after adding hooks',
    },
    th: {
      title: 'การติดตั้ง Oh My Claude',
      desc: 'ระบบประกอบด้วย 4 ส่วนหลัก: Backend Server, Frontend Dashboard, Claude Code Hooks และ Chrome Extension (optional)',
      fileStructure: 'File Structure',
      installSteps: 'ขั้นตอนการติดตั้ง',
      step1: 'ติดตั้ง Dependencies',
      step1Desc: 'รันใน folder oh-my-claude:',
      step2: 'ตั้งค่า Claude Code Hooks',
      step2Desc: 'เพิ่ม hooks ในไฟล์ global Claude settings:',
      step2File: '~/.claude/settings.json',
      step2FileWin: 'C:\\Users\\<username>\\.claude\\settings.json',
      step2Note: 'แทนที่ <PATH> ด้วย path ไปยัง folder oh-my-claude ของคุณ',
      step2Hooks: ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop', 'PreCompact'],
      step3: 'ติดตั้ง Chrome Extension',
      step3For: 'Optional - สำหรับ Sync Usage',
      step3Desc: 'ดึง Session % และ Weekly % จาก Claude.ai โดยตรง:',
      step3Steps: ['เปิด chrome://extensions/', 'เปิด "Developer mode"', 'คลิก "Load unpacked"', 'เลือก folder extension/'],
      step3Note: 'Extension sync ข้อมูลทุก 1 นาที → แสดง',
      step3Badge: 'Sync',
      step3Badge2: 'badge ที่ header',
      step4: 'เริ่มใช้งาน Dashboard',
      step4Desc: 'รัน backend และ frontend:',
      step4Note: 'Dashboard เปิดที่',
      step5: 'ติดตั้งเป็น App (PWA)',
      step5For: 'Optional',
      step5Desc: 'ติดตั้งเป็น desktop app เพื่อเข้าถึงได้ง่าย:',
      step5Steps: ['เปิด http://localhost:4825 ใน Chrome', 'คลิก icon ติดตั้ง (⊕) ที่ address bar', 'คลิก "Install" ในหน้าต่าง popup', 'App เปิดในหน้าต่างแยก — ปักหมุดที่ taskbar ได้เลย!'],
      step5Note: 'รองรับ mini mode (280×400) และ full dashboard (765×870)',
      ports: 'Ports ที่ใช้',
      hookExample: 'ตัวอย่าง Hook Configuration',
      important: 'สำคัญ',
      restartNote: 'Restart Claude Code terminal หลังเพิ่ม hooks',
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20'} border`}>
        <h3 className={`text-base font-semibold ${colors.text.primary} mb-2`}>{txt.title}</h3>
        <p className={`text-[13px] ${colors.text.muted} leading-relaxed`}>{txt.desc}</p>
      </div>

      {/* File Structure */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.fileStructure}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bgAlt} border ${colors.card.border} font-mono text-[11px]`}>
          <div className={colors.text.muted}>oh-my-claude/</div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-blue-500">backend/</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>├── <span className="text-emerald-500">server.js</span> <span className={colors.text.faint}>← Express + WebSocket (port 4824)</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>├── <span className="text-emerald-500">statsReader.js</span> <span className={colors.text.faint}>← Read transcript data</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-amber-500">events.json</span> <span className={colors.text.faint}>← Event storage (auto)</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-blue-500">frontend/</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>├── <span className="text-emerald-500">src/App.jsx</span> <span className={colors.text.faint}>← React dashboard</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-amber-500">vite.config.js</span> <span className={colors.text.faint}>← port 4825</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-violet-500">hooks/</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-emerald-500">send_event.js</span> <span className={colors.text.faint}>← Hook script (sends to backend)</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-cyan-500">extension/</span> <span className={colors.text.faint}>← Chrome Extension (optional)</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>└── <span className="text-amber-500">start.bat</span> <span className={colors.text.faint}>← Quick start (Windows)</span></div>
        </div>
      </div>

      {/* Installation Steps */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.installSteps}</h4>
        <div className="space-y-3">
          {/* Step 1: Install Dependencies */}
          <div className={`p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 text-[11px] flex items-center justify-center font-bold">1</span>
              <span className={`text-[13px] font-semibold ${colors.text.secondary}`}>{txt.step1}</span>
            </div>
            <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{txt.step1Desc}</p>
            <div className={`font-mono text-[11px] ${colors.text.muted} ${colors.code.bg} p-2 rounded space-y-1`}>
              <div><span className={colors.text.faint}># Backend</span></div>
              <div>cd backend && npm install</div>
              <div className="pt-1"><span className={colors.text.faint}># Frontend</span></div>
              <div>cd ../frontend && npm install</div>
            </div>
          </div>

          {/* Step 2: Configure Hooks */}
          <div className={`p-3 rounded-lg ${colors.card.bg} border border-amber-500/30`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-[11px] flex items-center justify-center font-bold">2</span>
              <span className={`text-[13px] font-semibold ${colors.text.secondary}`}>{txt.step2}</span>
              <span className="text-[9px] text-amber-500 bg-amber-500/20 px-1.5 py-0.5 rounded">{txt.important}</span>
            </div>
            <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{txt.step2Desc}</p>
            <div className="flex items-center gap-2 mb-2 text-[10px]">
              <code className="text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">{txt.step2File}</code>
              <span className={colors.text.faint}>or</span>
              <code className="text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">{txt.step2FileWin}</code>
            </div>
            <div className={`font-mono text-[10px] ${colors.text.muted} ${colors.code.bg} p-2 rounded mb-2 overflow-x-auto`}>
              <div className={colors.text.dimmed}>{'{'}</div>
              <div className={`pl-2 ${colors.text.dimmed}`}>{'"hooks": {'}</div>
              <div className="pl-4 text-cyan-500">{'"PreToolUse": [{ "matcher": "", "hooks": [{'}</div>
              <div className="pl-6 text-emerald-500">{'"type": "command",'}</div>
              <div className="pl-6 text-amber-500">{'"command": "node \\"<PATH>/hooks/send_event.js\\" --event-type PreToolUse"'}</div>
              <div className="pl-4 text-cyan-500">{'  }]}],'}</div>
              <div className={`pl-4 ${colors.text.faint}`}>{'// ... same for PostToolUse, SubagentStart, SubagentStop, UserPromptSubmit, Stop, PreCompact'}</div>
              <div className={`pl-2 ${colors.text.dimmed}`}>{'}'}</div>
              <div className={colors.text.dimmed}>{'}'}</div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-amber-500">⚠️</span>
              <span className="text-amber-500/80">{txt.step2Note}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] mt-1">
              <span className="text-blue-500">ℹ️</span>
              <span className="text-blue-500/80">{txt.restartNote}</span>
            </div>
          </div>

          {/* Step 3: Chrome Extension */}
          <div className={`p-3 rounded-lg ${colors.card.bg} border border-cyan-500/30`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-500 text-[11px] flex items-center justify-center font-bold">3</span>
              <span className={`text-[13px] font-semibold ${colors.text.secondary}`}>{txt.step3}</span>
              <span className="text-[9px] text-cyan-500 bg-cyan-500/20 px-1.5 py-0.5 rounded">{txt.step3For}</span>
            </div>
            <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{txt.step3Desc}</p>
            <div className="space-y-1 mb-2">
              {txt.step3Steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-cyan-500/60">{i + 1}.</span>
                  <span className={colors.text.muted}>{step}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-cyan-500/80">
              ✓ {txt.step3Note} <span className="bg-cyan-500/20 px-1 rounded">{txt.step3Badge}</span> {txt.step3Badge2}
            </div>
          </div>

          {/* Step 4: Start Dashboard */}
          <div className={`p-3 rounded-lg ${colors.card.bg} border border-emerald-500/30`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 text-[11px] flex items-center justify-center font-bold">4</span>
              <span className={`text-[13px] font-semibold ${colors.text.secondary}`}>{txt.step4}</span>
            </div>
            <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{txt.step4Desc}</p>
            <div className={`font-mono text-[11px] ${colors.text.muted} ${colors.code.bg} p-2 rounded space-y-1`}>
              <div><span className={colors.text.faint}># Option 1: start.bat (Windows)</span></div>
              <div>start.bat</div>
              <div className="pt-1"><span className={colors.text.faint}># Option 2: Manual</span></div>
              <div>cd backend && node server.js</div>
              <div>cd frontend && npm run dev</div>
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-2">
              ✓ {txt.step4Note} <code className="bg-emerald-500/20 px-1 rounded">http://localhost:4825</code>
            </div>
          </div>

          {/* Step 5: Install as App */}
          <div className={`p-3 rounded-lg ${colors.card.bg} border border-violet-500/30`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-500 text-[11px] flex items-center justify-center font-bold">5</span>
              <span className={`text-[13px] font-semibold ${colors.text.secondary}`}>{txt.step5}</span>
              <span className="text-[9px] text-violet-500 bg-violet-500/20 px-1.5 py-0.5 rounded">{txt.step5For}</span>
            </div>
            <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{txt.step5Desc}</p>
            <div className="space-y-1 mb-2">
              {txt.step5Steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-violet-500/60">{i + 1}.</span>
                  <span className={colors.text.muted}>{step}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-violet-500/80">
              ✓ {txt.step5Note}
            </div>
          </div>
        </div>
      </div>

      {/* Ports */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.ports}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className="text-[12px] font-semibold text-emerald-500 mb-1">Backend: 4824</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>HTTP API + WebSocket</div>
            <div className={`text-[10px] ${colors.text.faint} mt-1`}>POST /events, GET /stats</div>
          </div>
          <div className={`p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className="text-[12px] font-semibold text-blue-500 mb-1">Frontend: 4825</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>Vite dev server</div>
            <div className={`text-[10px] ${colors.text.faint} mt-1`}>React dashboard UI</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      connTitle: 'Connection Status',
      liveDesc: 'Connected to backend server via WebSocket',
      offDesc: 'Disconnected, reconnecting every 2 seconds',
      syncDesc: 'Receiving usage data from Claude.ai via Chrome Extension',
      usageTitle: 'Usage Status',
      usageDesc: 'Based on Session usage percentage (5-hour window):',
      normal: 'Normal',
      high: 'High Usage',
      near: 'Near Limit',
      full: 'Full',
      ofLimit: 'of session limit',
    },
    th: {
      connTitle: 'Connection Status',
      liveDesc: 'เชื่อมต่อ backend server ผ่าน WebSocket',
      offDesc: 'ไม่ได้เชื่อมต่อ, reconnect ทุก 2 วินาที',
      syncDesc: 'รับข้อมูล usage จาก Claude.ai ผ่าน Chrome Extension',
      usageTitle: 'Usage Status',
      usageDesc: 'คำนวณจาก Session usage percentage (5-hour window):',
      normal: 'Normal',
      high: 'High Usage',
      near: 'Near Limit',
      full: 'Full',
      ofLimit: 'ของ session limit',
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.connTitle}</h4>
        <div className="space-y-2">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${colors.card.bg}`}>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-[13px] font-semibold text-green-500">LIVE</span>
            <span className={`text-[12px] ${colors.text.dimmed}`}>— {txt.liveDesc}</span>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-lg ${colors.card.bg}`}>
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <span className="text-[13px] font-semibold text-red-500">OFF</span>
            <span className={`text-[12px] ${colors.text.dimmed}`}>— {txt.offDesc}</span>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-lg ${colors.card.bg} border border-cyan-500/20`}>
            <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-[13px] font-semibold text-cyan-500">Sync</span>
            <span className={`text-[12px] ${colors.text.dimmed}`}>— {txt.syncDesc}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.usageTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.usageDesc}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🪴</span>
              <span className="text-[13px] font-semibold text-green-500">{txt.normal}</span>
            </div>
            <div className={`text-[12px] ${colors.text.muted}`}>
              <span className="font-mono text-green-500">&lt; 60%</span> {txt.ofLimit}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span className="text-[13px] font-semibold text-yellow-500">{txt.high}</span>
            </div>
            <div className={`text-[12px] ${colors.text.muted}`}>
              <span className="font-mono text-yellow-500">60% - 84%</span> {txt.ofLimit}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚨</span>
              <span className="text-[13px] font-semibold text-red-500">{txt.near}</span>
            </div>
            <div className={`text-[12px] ${colors.text.muted}`}>
              <span className="font-mono text-red-500">85% - 99%</span> {txt.ofLimit}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🫗</span>
              <span className="text-[13px] font-semibold text-red-400">{txt.full}</span>
            </div>
            <div className={`text-[12px] ${colors.text.muted}`}>
              <span className="font-mono text-red-400">100%</span> {txt.ofLimit}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TokensSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      dataSourceTitle: 'Data Sources',
      dataSourceDesc: 'Token data comes from two sources:',
      sourceLocal: 'Local Transcripts',
      sourceLocalDesc: 'Read from ~/.claude/projects/ - tokens per session, model breakdown',
      sourceExternal: 'Chrome Extension',
      sourceExternalDesc: 'Scrapes Claude.ai every 1 min - Session % and Weekly %',
      sourceExternalNote: 'Required for accurate usage percentages',
      syncBadge: 'Shows "Sync" badge when active',
      sessionTitle: 'Session Gauge (5-Hour Window)',
      sessionDesc: 'Measures your usage within a rolling 5-hour window. This is the primary rate limit for Claude Code.',
      rolling: 'Rolling Window',
      resets5h: 'Resets continuously',
      limit5h: '~20,000 tokens per 5 hours',
      howSessionWorks: 'How it works',
      sessionExplain: 'As old usage expires (older than 5h), your percentage decreases. New usage increases it.',
      weeklyTitle: 'Weekly Gauge (All Models)',
      weeklyDesc: 'Total usage across all Claude models (Opus, Sonnet, Haiku) for the billing week.',
      fridayCycle: 'Friday to Friday cycle',
      resetsFri: 'Resets every Friday 11:00 UTC',
      limitWeekly: '~1.82M tokens per week (all models combined)',
      modelBreakdown: 'Model Breakdown',
      modelBreakdownDesc: 'Weekly gauge includes all models. Some plans have separate limits per model.',
      colorLegend: 'Status Colors',
      normal: 'Normal',
      normalDesc: 'Safe to continue working',
      high: 'High Usage',
      highDesc: 'Consider pausing complex tasks',
      near: 'Near Limit',
      nearDesc: 'Risk of hitting rate limit soon',
      full: 'Full',
      fullDesc: 'Rate limited, wait for reset',
      tipsTitle: 'Tips',
      tips: [
        'Use Haiku for simple tasks to save quota',
        'Check Weekly gauge before starting large projects',
        'Install Chrome Extension for real-time %'
      ]
    },
    th: {
      dataSourceTitle: 'แหล่งข้อมูล',
      dataSourceDesc: 'ข้อมูล Token มาจาก 2 แหล่ง:',
      sourceLocal: 'Local Transcripts',
      sourceLocalDesc: 'อ่านจาก ~/.claude/projects/ - tokens ต่อ session, แยกตาม model',
      sourceExternal: 'Chrome Extension',
      sourceExternalDesc: 'ดึงจาก Claude.ai ทุก 1 นาที - Session % และ Weekly %',
      sourceExternalNote: 'จำเป็นสำหรับ % ที่แม่นยำ',
      syncBadge: 'แสดง "Sync" badge เมื่อทำงาน',
      sessionTitle: 'Session Gauge (5-Hour Window)',
      sessionDesc: 'วัดการใช้งานในช่วง rolling 5 ชั่วโมง นี่คือ rate limit หลักของ Claude Code',
      rolling: 'Rolling Window',
      resets5h: 'Reset ต่อเนื่อง',
      limit5h: '~20,000 tokens ต่อ 5 ชั่วโมง',
      howSessionWorks: 'ทำงานอย่างไร',
      sessionExplain: 'เมื่อ usage เก่าหมดอายุ (เกิน 5h) % จะลดลง การใช้งานใหม่จะเพิ่ม %',
      weeklyTitle: 'Weekly Gauge (All Models)',
      weeklyDesc: 'การใช้งานรวมทุก Claude model (Opus, Sonnet, Haiku) ในสัปดาห์',
      fridayCycle: 'รอบ Friday ถึง Friday',
      resetsFri: 'Reset ทุกวันศุกร์ 11:00 UTC',
      limitWeekly: '~1.82M tokens ต่อสัปดาห์ (รวมทุก model)',
      modelBreakdown: 'แยกตาม Model',
      modelBreakdownDesc: 'Weekly gauge รวมทุก model บาง plan มี limit แยกต่อ model',
      colorLegend: 'สีสถานะ',
      normal: 'ปกติ',
      normalDesc: 'ทำงานต่อได้',
      high: 'ใช้งานสูง',
      highDesc: 'พิจารณาหยุดงานใหญ่',
      near: 'ใกล้ Limit',
      nearDesc: 'เสี่ยงโดน rate limit เร็วๆ นี้',
      full: 'เต็ม',
      fullDesc: 'โดน rate limit แล้ว รอ reset',
      tipsTitle: 'Tips',
      tips: [
        'ใช้ Haiku สำหรับงานง่ายเพื่อประหยัด quota',
        'เช็ค Weekly gauge ก่อนเริ่ม project ใหญ่',
        'ติดตั้ง Chrome Extension เพื่อดู % แบบ real-time'
      ]
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      {/* Data Sources */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.dataSourceTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.dataSourceDesc}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📁</span>
              <span className={`text-[12px] font-semibold ${colors.text.secondary}`}>{txt.sourceLocal}</span>
            </div>
            <p className={`text-[10px] ${colors.text.dimmed}`}>{txt.sourceLocalDesc}</p>
          </div>
          <div className={`p-3 rounded-lg ${colors.card.bg} border border-cyan-500/30`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🌐</span>
              <span className="text-[12px] font-semibold text-cyan-500">{txt.sourceExternal}</span>
            </div>
            <p className={`text-[10px] ${colors.text.dimmed} mb-1`}>{txt.sourceExternalDesc}</p>
            <p className="text-[9px] text-cyan-500/70">⚠️ {txt.sourceExternalNote}</p>
            <p className={`text-[9px] ${colors.text.faint} mt-1`}>✓ {txt.syncBadge}</p>
          </div>
        </div>
      </div>

      {/* Session Gauge */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.sessionTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border} space-y-3`}>
          <p className={`text-[11px] ${colors.text.muted}`}>{txt.sessionDesc}</p>
          <div className="flex items-center justify-between">
            <span className={`text-[12px] ${colors.text.muted}`}>{txt.rolling}</span>
            <span className={`text-[12px] ${colors.text.dimmed}`}>{txt.resets5h}</span>
          </div>
          <div className={`w-full h-2 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-800'} rounded-full overflow-hidden`}>
            <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-3/4" />
          </div>
          <div className={`grid grid-cols-3 gap-2 text-[10px] ${colors.text.muted}`}>
            <div><span className="text-green-500">●</span> 0-59%: {txt.normal}</div>
            <div><span className="text-yellow-500">●</span> 60-84%: {txt.high}</div>
            <div><span className="text-red-500">●</span> 85%+: {txt.near}</div>
          </div>
          <div className={`text-[11px] ${colors.text.dimmed}`}>
            <strong>Limit:</strong> {txt.limit5h}
          </div>
          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <div className="text-[10px] text-blue-500 font-medium mb-1">💡 {txt.howSessionWorks}</div>
            <div className={`text-[10px] ${colors.text.dimmed}`}>{txt.sessionExplain}</div>
          </div>
        </div>
      </div>

      {/* Weekly Gauge */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.weeklyTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border} space-y-3`}>
          <p className={`text-[11px] ${colors.text.muted}`}>{txt.weeklyDesc}</p>
          <div className="flex items-center justify-between">
            <span className={`text-[12px] ${colors.text.muted}`}>{txt.fridayCycle}</span>
            <span className={`text-[12px] ${colors.text.dimmed}`}>{txt.resetsFri}</span>
          </div>
          <div className={`w-full h-2 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-800'} rounded-full overflow-hidden`}>
            <div className="h-full bg-slate-400 w-1/3" />
          </div>
          <div className={`text-[11px] ${colors.text.dimmed}`}>
            <strong>Limit:</strong> {txt.limitWeekly}
          </div>
          <div className="p-2 rounded bg-violet-500/10 border border-violet-500/20">
            <div className="text-[10px] text-violet-500 font-medium mb-1">📊 {txt.modelBreakdown}</div>
            <div className={`text-[10px] ${colors.text.dimmed}`}>{txt.modelBreakdownDesc}</div>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.colorLegend}</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🪴</span>
              <span className="text-[12px] font-medium text-green-500">{txt.normal}</span>
            </div>
            <span className={`text-[10px] ${colors.text.dimmed}`}>{txt.normalDesc}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span className="text-[12px] font-medium text-yellow-500">{txt.high}</span>
            </div>
            <span className={`text-[10px] ${colors.text.dimmed}`}>{txt.highDesc}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚨</span>
              <span className="text-[12px] font-medium text-red-500">{txt.near}</span>
            </div>
            <span className={`text-[10px] ${colors.text.dimmed}`}>{txt.nearDesc}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2">
              <span className="text-sm">🫗</span>
              <span className="text-[12px] font-medium text-red-400">{txt.full}</span>
            </div>
            <span className={`text-[10px] ${colors.text.dimmed}`}>{txt.fullDesc}</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.tipsTitle}</h4>
        <div className={`p-3 rounded-xl ${colors.card.bgAlt} border ${colors.card.border} space-y-2`}>
          {txt.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="text-emerald-500">💡</span>
              <span className={colors.text.muted}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelsSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      compareTitle: 'Model Comparison',
      compareDesc: 'Choose the right model for your task to optimize speed, cost, and quality:',
      whenToUse: 'When to Use',
      speedCost: 'Speed & Cost',
      useCases: 'Use Cases',
      opusName: 'Opus',
      opusWhen: 'Complex reasoning, architecture decisions, multi-file refactoring',
      opusSpeed: 'Slowest but highest quality • Most expensive',
      opusUseCases: ['System design', 'Complex debugging', 'Code review', 'Writing plans'],
      sonnetName: 'Sonnet',
      sonnetWhen: 'General coding, everyday tasks, good balance of speed and quality',
      sonnetSpeed: 'Fast with great quality • Moderate cost',
      sonnetUseCases: ['Feature implementation', 'Bug fixes', 'Tests', 'Documentation'],
      haikuName: 'Haiku',
      haikuWhen: 'Quick lookups, simple edits, bulk operations, subagent tasks',
      haikuSpeed: 'Fastest response • Most economical',
      haikuUseCases: ['File searches', 'Simple edits', 'Format conversion', 'Exploration'],
      tipsTitle: 'Tips for Choosing',
      tips: [
        'Start with Sonnet for most tasks - switch to Opus only if quality is insufficient',
        'Use Haiku for subagents (Task tool) to save quota on parallel work',
        'Complex multi-step tasks benefit from Opus thinking capability',
        'Check your Weekly gauge before starting large Opus sessions'
      ],
      quotaTitle: 'Quota Impact',
      quotaDesc: 'Each model consumes quota differently:',
      quotaOpus: 'Opus uses the most quota per request',
      quotaSonnet: 'Sonnet is the default balance',
      quotaHaiku: 'Haiku uses minimal quota - great for bulk tasks'
    },
    th: {
      compareTitle: 'เปรียบเทียบ Model',
      compareDesc: 'เลือก model ที่เหมาะสมกับงานเพื่อ optimize ความเร็ว ค่าใช้จ่าย และคุณภาพ:',
      whenToUse: 'ใช้เมื่อไหร่',
      speedCost: 'ความเร็ว & ค่าใช้จ่าย',
      useCases: 'ตัวอย่างการใช้งาน',
      opusName: 'Opus',
      opusWhen: 'งาน reasoning ซับซ้อน, ตัดสินใจ architecture, refactor หลายไฟล์',
      opusSpeed: 'ช้าสุดแต่คุณภาพสูงสุด • แพงสุด',
      opusUseCases: ['System design', 'Debug ซับซ้อน', 'Code review', 'เขียน plan'],
      sonnetName: 'Sonnet',
      sonnetWhen: 'Coding ทั่วไป, งานประจำวัน, สมดุลระหว่างความเร็วและคุณภาพ',
      sonnetSpeed: 'เร็วและคุณภาพดี • ค่าใช้จ่ายปานกลาง',
      sonnetUseCases: ['สร้าง feature', 'แก้ bug', 'เขียน test', 'Documentation'],
      haikuName: 'Haiku',
      haikuWhen: 'Lookup เร็วๆ, แก้ไขง่ายๆ, งาน bulk, subagent tasks',
      haikuSpeed: 'ตอบเร็วที่สุด • ประหยัดที่สุด',
      haikuUseCases: ['ค้นหาไฟล์', 'แก้ไขง่ายๆ', 'แปลง format', 'สำรวจ code'],
      tipsTitle: 'Tips การเลือก Model',
      tips: [
        'เริ่มด้วย Sonnet สำหรับงานส่วนใหญ่ - สลับไป Opus เมื่อคุณภาพไม่พอ',
        'ใช้ Haiku สำหรับ subagents (Task tool) เพื่อประหยัด quota งาน parallel',
        'งาน multi-step ซับซ้อนได้ประโยชน์จาก Opus thinking capability',
        'เช็ค Weekly gauge ก่อนเริ่ม session ใหญ่ๆ กับ Opus'
      ],
      quotaTitle: 'ผลกระทบต่อ Quota',
      quotaDesc: 'แต่ละ model ใช้ quota ต่างกัน:',
      quotaOpus: 'Opus ใช้ quota มากสุดต่อ request',
      quotaSonnet: 'Sonnet เป็นค่า default ที่สมดุล',
      quotaHaiku: 'Haiku ใช้ quota น้อยมาก - เหมาะกับงาน bulk'
    }
  };
  const txt = t[lang] || t.en;

  const models = [
    {
      name: txt.opusName,
      color: 'violet',
      icon: '◆',
      when: txt.opusWhen,
      speed: txt.opusSpeed,
      useCases: txt.opusUseCases
    },
    {
      name: txt.sonnetName,
      color: 'blue',
      icon: '●',
      when: txt.sonnetWhen,
      speed: txt.sonnetSpeed,
      useCases: txt.sonnetUseCases
    },
    {
      name: txt.haikuName,
      color: 'emerald',
      icon: '▪',
      when: txt.haikuWhen,
      speed: txt.haikuSpeed,
      useCases: txt.haikuUseCases
    }
  ];

  return (
    <div className="space-y-6">
      {/* Model Comparison */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.compareTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-4`}>{txt.compareDesc}</p>
        <div className="space-y-3">
          {models.map((model) => (
            <div key={model.name} className={`p-4 rounded-xl bg-${model.color}-500/10 border border-${model.color}-500/20`}
                 style={{ backgroundColor: `rgb(var(--${model.color}-500) / 0.1)` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xl text-${model.color}-500`}>{model.icon}</span>
                <span className={`text-[14px] font-bold text-${model.color}-500`}>{model.name}</span>
              </div>

              {/* When to Use */}
              <div className="mb-2">
                <span className={`text-[10px] ${colors.text.dimmed} uppercase`}>{txt.whenToUse}</span>
                <div className={`text-[12px] ${colors.text.tertiary} mt-0.5`}>{model.when}</div>
              </div>

              {/* Speed & Cost */}
              <div className="mb-2">
                <span className={`text-[10px] ${colors.text.dimmed} uppercase`}>{txt.speedCost}</span>
                <div className={`text-[11px] ${colors.text.muted} mt-0.5`}>{model.speed}</div>
              </div>

              {/* Use Cases */}
              <div>
                <span className={`text-[10px] ${colors.text.dimmed} uppercase`}>{txt.useCases}</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {model.useCases.map((useCase, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded bg-${model.color}-500/10 text-${model.color}-600`}>
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quota Impact */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.quotaTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.quotaDesc}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-full ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-800'} rounded-full h-2`}>
                <div className="bg-violet-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] text-violet-500 w-12">Opus</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-full ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-800'} rounded-full h-2`}>
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '50%' }} />
              </div>
              <span className="text-[10px] text-blue-500 w-12">Sonnet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-full ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-800'} rounded-full h-2`}>
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '20%' }} />
              </div>
              <span className="text-[10px] text-emerald-500 w-12">Haiku</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.tipsTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bgAlt} border ${colors.card.border} space-y-2`}>
          {txt.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="text-amber-500">💡</span>
              <span className={colors.text.muted}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentsSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      whatTitle: 'What are Agents?',
      whatDesc: 'Claude Code uses agents to manage tasks. Main is the primary agent. Task tool creates Subagents for parallel work.',
      typesTitle: 'Agent Types',
      mainType: 'Primary conversation agent',
      exploreType: 'Codebase exploration',
      planType: 'Architecture planning',
      bashType: 'Command execution',
      lifecycleTitle: 'Agent Lifecycle (5-Level)',
      lifecycleDesc: 'Status is shown as a colored dot + label (e.g. "● Active") on the first line of each agent card. Agents transition through 5 levels based on inactivity:',
      statusActive: 'Active',
      statusActiveDesc: 'Receiving events, green pulse',
      statusIdle: 'Idle',
      statusIdleDesc: 'No activity for 5 min, yellow',
      statusStale: 'Stale',
      statusStaleDesc: 'No activity for 10 min, orange',
      statusTimeout: 'Timeout',
      statusTimeoutDesc: 'No activity for 30 min, amber pulse',
      statusRemoved: 'Removed',
      statusRemovedDesc: 'No activity for 60 min, deleted',
      autoCleanup: 'Agents automatically return to Active when new events arrive.',
      smartStatusTitle: 'Smart Status Detection',
      smartStatusDesc: 'When an agent is active, the dashboard derives a real-time granular status from the event stream — showing exactly what Claude is doing right now.',
      smartThinking: 'After user prompt or tool completion — Claude is reasoning',
      smartReading: 'Read / Glob / Grep in progress — scanning files',
      smartWriting: 'Edit / Write in progress — modifying code',
      smartExecuting: 'Bash command running — executing in terminal',
      smartSpawning: 'Task tool called — creating a subagent',
      smartSearching: 'WebSearch / WebFetch — browsing the web',
      smartWaiting: 'Permission requested — waiting for user approval',
      smartCompacting: 'Context compaction — freeing up context window',
      smartProcessing: 'Other tool in progress',
      cardLayoutTitle: 'Card Layout (Full Mode)',
      cardLayoutDesc: 'Each main agent displays up to 3 lines. Subagents show up to 3 lines indented below. Stopped sessions/subagents are dimmed (opacity 50%).',
      cardLine1: 'Line 1: Model badge, Smart Status (icon + label, no bg) or Status badge (with colored bg), Duration, Tokens',
      cardLine2: 'Line 2: Last activity (tool icon + name), Session ID — hidden if no activity',
      cardLine3: 'Line 3: Task count badge, Git diff chip (+adds -dels files)',
      cardSubLine1: 'Subagent Line 1: └ Model + Type + Status badge (with colored bg), Duration, Tokens',
      cardSubLine2: 'Subagent Line 2: Tools used (if any)',
      cardSubLine3: 'Subagent Line 3: Description (truncated), Agent ID',
      gitDiffTitle: 'Git Diff Stats',
      gitDiffDesc: 'Shows uncommitted changes per agent working directory as a segmented chip with color-coded sections.',
      gitDiffAdd: 'Lines added (insertions) — green',
      gitDiffDel: 'Lines deleted (removals) — red',
      gitDiffFiles: 'Number of changed files — gray',
      stableOrderTitle: 'Stable Ordering',
      stableOrderDesc: 'Agent cards maintain their position. Re-sorting only happens when sessions are added/removed or active status changes. No jumping on data-only updates.',
      subagentCountTitle: 'Subagent Count',
      subagentCountDesc: 'Shows active/total running subagents as a badge (e.g. "2/5 running").',
      expandedTitle: 'Expanded View',
      expandedDesc: 'Expanded mode shows session cards with rounded borders and larger font/spacing. The whole panel scrolls vertically. Tools can wrap to multiple lines. Descriptions are single-line truncated.'
    },
    th: {
      whatTitle: 'Agents คืออะไร?',
      whatDesc: 'Claude Code ใช้ agents ในการจัดการงาน Main คือ agent หลัก Task tool สร้าง Subagents สำหรับทำงานแบบ parallel',
      typesTitle: 'Agent Types',
      mainType: 'Agent หลักที่สนทนา',
      exploreType: 'สำรวจ codebase',
      planType: 'วางแผน architecture',
      bashType: 'รัน commands',
      lifecycleTitle: 'Agent Lifecycle (5 ระดับ)',
      lifecycleDesc: 'สถานะแสดงเป็นจุดสี + label (เช่น "● Active") บนบรรทัดแรกของแต่ละ agent card เปลี่ยนสถานะตาม 5 ระดับเมื่อไม่มี activity:',
      statusActive: 'Active',
      statusActiveDesc: 'มี events เข้ามา, เขียว กะพริบ',
      statusIdle: 'Idle',
      statusIdleDesc: 'ไม่มี activity 5 นาที, เหลือง',
      statusStale: 'Stale',
      statusStaleDesc: 'ไม่มี activity 10 นาที, ส้ม',
      statusTimeout: 'Timeout',
      statusTimeoutDesc: 'ไม่มี activity 30 นาที, อำพัน กะพริบ',
      statusRemoved: 'Removed',
      statusRemovedDesc: 'ไม่มี activity 60 นาที, ลบออก',
      autoCleanup: 'Agent จะกลับเป็น Active อัตโนมัติเมื่อมี event ใหม่เข้ามา',
      smartStatusTitle: 'Smart Status Detection',
      smartStatusDesc: 'เมื่อ agent กำลังทำงาน dashboard จะวิเคราะห์ event stream แบบ real-time แสดงสถานะละเอียดว่า Claude กำลังทำอะไรอยู่ตอนนี้',
      smartThinking: 'หลัง user prompt หรือ tool เสร็จ — Claude กำลังคิด',
      smartReading: 'Read / Glob / Grep กำลังทำงาน — สแกนไฟล์',
      smartWriting: 'Edit / Write กำลังทำงาน — แก้ไขโค้ด',
      smartExecuting: 'Bash command กำลังรัน — ทำงานใน terminal',
      smartSpawning: 'Task tool ถูกเรียก — สร้าง subagent',
      smartSearching: 'WebSearch / WebFetch — ค้นหาเว็บ',
      smartWaiting: 'Permission requested — รอ user อนุมัติ',
      smartCompacting: 'Context compaction — เคลียร์ context window',
      smartProcessing: 'Tool อื่นกำลังทำงาน',
      cardLayoutTitle: 'Card Layout (Full Mode)',
      cardLayoutDesc: 'Main agent แสดงสูงสุด 3 บรรทัด, Subagent แสดงสูงสุด 3 บรรทัดย่อยด้านล่าง Session/subagent ที่ stopped จะจางลง (opacity 50%)',
      cardLine1: 'บรรทัด 1: Model badge, Smart Status (icon + label ไม่มี bg) หรือ Status badge (มี bg สี), Duration, Tokens',
      cardLine2: 'บรรทัด 2: Activity ล่าสุด (ไอคอน + ชื่อ tool), Session ID — ซ่อนถ้าไม่มี activity',
      cardLine3: 'บรรทัด 3: Task count badge, Git diff chip (+เพิ่ม -ลบ ไฟล์)',
      cardSubLine1: 'Subagent บรรทัด 1: └ Model + Type + Status badge (มี bg สี), Duration, Tokens',
      cardSubLine2: 'Subagent บรรทัด 2: Tools ที่ใช้ (ถ้ามี)',
      cardSubLine3: 'Subagent บรรทัด 3: Description (ตัดถ้ายาว), Agent ID',
      gitDiffTitle: 'Git Diff Stats',
      gitDiffDesc: 'แสดง uncommitted changes ต่อ working directory เป็น segmented chip แยกสีตามประเภท',
      gitDiffAdd: 'บรรทัดที่เพิ่ม (insertions) — เขียว',
      gitDiffDel: 'บรรทัดที่ลบ (removals) — แดง',
      gitDiffFiles: 'จำนวนไฟล์ที่เปลี่ยนแปลง — เทา',
      stableOrderTitle: 'Stable Ordering',
      stableOrderDesc: 'การ์ด agent จะอยู่ตำแหน่งเดิม จัดเรียงใหม่เฉพาะเมื่อ session เพิ่ม/ลบ หรือ active status เปลี่ยน ไม่กระโดดเมื่อข้อมูลอัปเดต',
      subagentCountTitle: 'Subagent Count',
      subagentCountDesc: 'แสดง active/total subagents เป็น badge (เช่น "2/5 running")',
      expandedTitle: 'Expanded View',
      expandedDesc: 'Expanded mode แสดง session card มีขอบมน ตัวอักษรและ spacing ใหญ่ขึ้น panel ทั้งหมด scroll แนวตั้งได้ tools ขึ้นบรรทัดใหม่ได้ Description แสดง 1 บรรทัดตัดถ้ายาว'
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.whatTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.whatDesc}</p>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.typesTitle}</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-gray-500/10">
            <div className={`text-[12px] font-semibold ${colors.text.secondary}`}>Main</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.mainType}</div>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10">
            <div className="text-[12px] font-semibold text-violet-500">Explore</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.exploreType}</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10">
            <div className="text-[12px] font-semibold text-blue-500">Plan</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.planType}</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10">
            <div className="text-[12px] font-semibold text-emerald-500">Bash</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.bashType}</div>
          </div>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.lifecycleTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.lifecycleDesc}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[13px] font-semibold text-emerald-500">{txt.statusActive}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.statusActiveDesc}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-[13px] font-semibold text-yellow-400">{txt.statusIdle}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.statusIdleDesc}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-[13px] font-semibold text-orange-400">{txt.statusStale}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.statusStaleDesc}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[13px] font-semibold text-amber-400">{txt.statusTimeout}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.statusTimeoutDesc}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <span className="text-[13px] font-semibold text-red-500/70">{txt.statusRemoved}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.statusRemovedDesc}</div>
          </div>
        </div>
        <p className={`text-[11px] ${colors.text.faint} mt-3`}>{txt.autoCleanup}</p>
      </div>

      {/* Smart Status Detection */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>
          <span className="mr-1.5">✨</span>{txt.smartStatusTitle}
        </h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.smartStatusDesc}</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">🧠</span>
            <span className="text-[12px] font-semibold text-violet-400 w-20">Thinking</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartThinking}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">👁</span>
            <span className="text-[12px] font-semibold text-sky-400 w-20">Reading</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartReading}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">✍️</span>
            <span className="text-[12px] font-semibold text-orange-400 w-20">Writing</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartWriting}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-[14px] w-6 text-center animate-bounce">⚡</span>
            <span className="text-[12px] font-semibold text-amber-400 w-20">Executing</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartExecuting}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <span className="text-[14px] w-6 text-center animate-spin">🔀</span>
            <span className="text-[12px] font-semibold text-violet-400 w-20">Spawning</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartSpawning}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">🌐</span>
            <span className="text-[12px] font-semibold text-cyan-400 w-20">Searching</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartSearching}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">⏳</span>
            <span className="text-[12px] font-semibold text-orange-400 w-20">Waiting</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartWaiting}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">📦</span>
            <span className="text-[12px] font-semibold text-slate-400 w-20">Compacting</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartCompacting}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-[14px] w-6 text-center animate-pulse">⚙️</span>
            <span className="text-[12px] font-semibold text-blue-400 w-20">Processing</span>
            <span className={`text-[11px] ${colors.text.dimmed} flex-1`}>{txt.smartProcessing}</span>
          </div>
        </div>
      </div>

      {/* Card Layout Example */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.cardLayoutTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.cardLayoutDesc}</p>
        {/* Visual mock of agent card */}
        <div className={`rounded-xl ${colors.card.bg} border ${colors.card.border} overflow-hidden`}>
          {/* Main agent - Line 1 */}
          <div className="px-3 pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">Opus</span>
              <span className="text-[10px] animate-pulse">🧠</span>
              <span className="text-[9px] font-medium text-violet-400">Thinking</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className={colors.text.dimmed}>2h 41m</span>
              <span className="text-amber-500">372.4k</span>
            </div>
          </div>
          {/* Main agent - Line 2 */}
          <div className="px-3 pt-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-cyan-500">📝</span>
              <span className={colors.text.dimmed}>Edit</span>
              <span className={colors.text.faint}>HelpGuide.jsx</span>
            </div>
            <code className={`text-[8px] font-mono ${colors.text.faint}`}>91188c6</code>
          </div>
          {/* Main agent - Line 3 */}
          <div className="px-3 pt-1 pb-2 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">2 done</span>
            <div className="inline-flex items-center gap-0 rounded-md border border-gray-700/40 overflow-hidden text-[10px] font-mono">
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10">
                <span className="w-1 h-1 rounded-full bg-green-400" />
                <span className="text-green-400">+1,372</span>
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border-l border-gray-700/40">
                <span className="w-1 h-1 rounded-full bg-red-400" />
                <span className="text-red-400">-668</span>
              </span>
              <span className="px-1.5 py-0.5 text-gray-500 border-l border-gray-700/40">17 files</span>
            </div>
          </div>
          {/* Subagent 1 - stopped (dimmed) */}
          <div className={`border-t ${colors.card.border} opacity-50`}>
            <div className="px-3 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px]">
                <span className={colors.text.faint}>└</span>
                <span className="font-medium px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">Opus</span>
                <span className={`px-1 py-0.5 rounded ${colors.card.bgAlt} text-pink-400`}>Subagent</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-500/15">
                  <span className="text-gray-500">○</span>
                  <span className="text-[8px] text-gray-500">Stopped</span>
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={colors.text.dimmed}>3m 18s</span>
                <span className="text-amber-500">166.8k</span>
              </div>
            </div>
            <div className="px-3 pt-0.5 pb-1 flex items-center justify-between">
              <span className={`text-[9px] ${colors.text.faint} truncate max-w-[220px]`}>💬 Research pre-existing errors</span>
              <code className={`text-[8px] font-mono ${colors.text.faint}`}>ad37b4e</code>
            </div>
          </div>
          {/* Subagent 2 - stopped (dimmed) */}
          <div className={`border-t ${colors.card.border} opacity-50`}>
            <div className="px-3 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px]">
                <span className={colors.text.faint}>└</span>
                <span className="font-medium px-1 py-0.5 rounded bg-sky-500/15 text-sky-400">Sonnet</span>
                <span className={`px-1 py-0.5 rounded ${colors.card.bgAlt} text-pink-400`}>General-Purpose</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-500/15">
                  <span className="text-gray-500">○</span>
                  <span className="text-[8px] text-gray-500">Stopped</span>
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={colors.text.dimmed}>1m 6s</span>
                <span className="text-amber-500">23.7k</span>
              </div>
            </div>
            <div className="px-3 pt-0.5 pb-1 flex items-center justify-between">
              <span className={`text-[9px] ${colors.text.faint} truncate max-w-[220px]`}>💬 Design extended testing plan</span>
              <code className={`text-[8px] font-mono ${colors.text.faint}`}>ae9647e</code>
            </div>
          </div>
        </div>
        {/* Line descriptions */}
        <div className="mt-3 space-y-1">
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-emerald-400 font-mono">1</span> {txt.cardLine1}</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-cyan-400 font-mono">2</span> {txt.cardLine2}</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-amber-400 font-mono">3</span> {txt.cardLine3}</div>
          <div className={`text-[11px] ${colors.text.faint} mt-1`}><span className="text-gray-500 font-mono">└</span> {txt.cardSubLine1}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardSubLine2}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardSubLine3}</div>
        </div>
      </div>

      {/* Git Diff Stats */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.gitDiffTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed mb-3`}>{txt.gitDiffDesc}</p>
          <div className="inline-flex items-center gap-0 rounded-md border border-gray-700/40 overflow-hidden text-[11px] font-mono">
            <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-green-400">+1,372</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border-l border-gray-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-red-400">-668</span>
            </span>
            <span className="px-2 py-1 text-gray-500 border-l border-gray-700/40">17 files</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <span className="font-mono text-green-400">+N</span>
              <span className={colors.text.dimmed}>{txt.gitDiffAdd}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="font-mono text-red-400">-N</span>
              <span className={colors.text.dimmed}>{txt.gitDiffDel}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
              <span className="font-mono text-gray-500">N files</span>
              <span className={colors.text.dimmed}>{txt.gitDiffFiles}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stable Ordering */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.stableOrderTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.stableOrderDesc}</p>
        </div>
      </div>

      {/* Subagent Count */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.subagentCountTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed mb-3`}>{txt.subagentCountDesc}</p>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-400">2/5 running</span>
        </div>
      </div>

      {/* Expanded View */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.expandedTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.expandedDesc}</p>
        </div>
      </div>
    </div>
  );
}

function MiniModeSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      whatTitle: 'What is Mini Mode?',
      whatDesc: 'A compact floating popup window (~220x450px) that shows key metrics at a glance. Perfect for keeping on screen while working.',
      howTitle: 'How to Open',
      howDesc: 'Click the Mini button in the header bar. A popup window opens with its own WebSocket connection.',
      howStep1: 'Click "Mini" button in header',
      howStep2: 'Popup window opens (220x450px)',
      howStep3: 'Window stays on top while you work',
      featuresTitle: 'What it Shows',
      feat1: 'Session gauge (5h usage %)',
      feat2: 'Weekly gauge (7-day usage %)',
      feat3: 'Agent list grouped by session',
      feat4: 'Model badges (Op/So/Ha) with status dots',
      feat5: 'Token usage per session',
      feat6: 'Active session/task count',
      feat7: 'Monthly cost in footer',
      themeTitle: 'Theme Sync',
      themeDesc: 'Mini Mode automatically follows the theme of the main dashboard. Change theme in main app and the popup updates instantly.',
    },
    th: {
      whatTitle: 'Mini Mode คืออะไร?',
      whatDesc: 'หน้าต่าง popup ขนาดกะทัดรัด (~220x450px) แสดงข้อมูลสำคัญแบบรวดเร็ว เหมาะสำหรับเปิดค้างไว้ขณะทำงาน',
      howTitle: 'วิธีเปิด',
      howDesc: 'คลิกปุ่ม Mini ที่ header bar หน้าต่าง popup จะเปิดพร้อม WebSocket connection ของตัวเอง',
      howStep1: 'คลิกปุ่ม "Mini" ที่ header',
      howStep2: 'หน้าต่าง popup เปิดขึ้น (220x450px)',
      howStep3: 'หน้าต่างลอยอยู่ด้านบนขณะทำงาน',
      featuresTitle: 'แสดงอะไรบ้าง',
      feat1: 'Session gauge (% การใช้งาน 5 ชม.)',
      feat2: 'Weekly gauge (% การใช้งาน 7 วัน)',
      feat3: 'รายการ agent จัดกลุ่มตาม session',
      feat4: 'Model badges (Op/So/Ha) พร้อม status dots',
      feat5: 'Token ที่ใช้ต่อ session',
      feat6: 'จำนวน session/task ที่ active',
      feat7: 'ค่าใช้จ่ายรายเดือนที่ footer',
      themeTitle: 'Theme Sync',
      themeDesc: 'Mini Mode ซิงค์ theme กับ dashboard หลักอัตโนมัติ เปลี่ยน theme ที่ main app แล้ว popup อัปเดตทันที',
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.whatTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.whatDesc}</p>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.howTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.howDesc}</p>
        <div className="space-y-2">
          {[txt.howStep1, txt.howStep2, txt.howStep3].map((step, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
              <span className="text-[12px] font-bold text-blue-400">{i + 1}</span>
              <span className={`text-[12px] ${colors.text.muted}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.featuresTitle}</h4>
        <div className="space-y-1.5">
          {[txt.feat1, txt.feat2, txt.feat3, txt.feat4, txt.feat5, txt.feat6, txt.feat7].map((feat, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.card.bg}`}>
              <span className="text-emerald-400 text-[10px]">&#9679;</span>
              <span className={`text-[12px] ${colors.text.muted}`}>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.themeTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.themeDesc}</p>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      whatTitle: 'Notification System',
      whatDesc: 'Audio notifications when agents complete their tasks. Two modes toggle with a single click.',
      modesTitle: 'Notification Modes',
      modeOff: 'Off',
      modeOffDesc: 'No notifications (default) — bell icon gray',
      modeBell: 'Bell',
      modeBellDesc: 'Short dual-tone beep via Web Audio API (880Hz→660Hz sine wave) — bell icon amber',
      howTitle: 'How to Use',
      howDesc: 'Click the bell icon in the header to toggle: Off ↔ Bell. A preview sound plays when enabled.',
      triggerTitle: 'What Triggers Notifications?',
      triggerDesc: 'When an agent changes status from active/idle/stale to stopped (task completed), a bell sound plays.',
      noteTitle: 'Browser Requirement',
      noteDesc: 'Uses Web Audio API with shared AudioContext. First click unlocks audio (Chrome autoplay policy). Sound works even when tab is in background.',
    },
    th: {
      whatTitle: 'ระบบแจ้งเตือน',
      whatDesc: 'แจ้งเตือนเสียงเมื่อ agent ทำงานเสร็จ สองโหมดสลับได้ด้วยการคลิกเดียว',
      modesTitle: 'โหมดแจ้งเตือน',
      modeOff: 'Off',
      modeOffDesc: 'ไม่แจ้งเตือน (ค่าเริ่มต้น) — ไอคอนกระดิ่งสีเทา',
      modeBell: 'Bell',
      modeBellDesc: 'เสียง beep สองเสียงผ่าน Web Audio API (880Hz→660Hz sine wave) — ไอคอนกระดิ่งสีเหลือง',
      howTitle: 'วิธีใช้',
      howDesc: 'คลิกไอคอนกระดิ่งที่ header เพื่อสลับ: Off ↔ Bell เสียงตัวอย่างจะเล่นเมื่อเปิด',
      triggerTitle: 'อะไรทำให้แจ้งเตือน?',
      triggerDesc: 'เมื่อ agent เปลี่ยนสถานะจาก active/idle/stale เป็น stopped (งานเสร็จ) จะเล่นเสียงกระดิ่ง',
      noteTitle: 'ข้อกำหนด Browser',
      noteDesc: 'ใช้ Web Audio API กับ shared AudioContext คลิกครั้งแรกจะปลดล็อกเสียง (Chrome autoplay policy) เสียงทำงานได้แม้ tab อยู่ background',
    }
  };
  const txt = t[lang] || t.en;

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.whatTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.whatDesc}</p>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.modesTitle}</h4>
        <div className="space-y-2">
          {/* Off */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${colors.card.bgAlt}`}>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-gray-400">{txt.modeOff}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed} max-w-[55%] text-right`}>{txt.modeOffDesc}</div>
          </div>
          {/* Bell */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/15">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-amber-400">{txt.modeBell}</span>
            </div>
            <div className={`text-[11px] ${colors.text.dimmed} max-w-[55%] text-right`}>{txt.modeBellDesc}</div>
          </div>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.howTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.howDesc}</p>
        </div>
      </div>

      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.triggerTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.triggerDesc}</p>
        </div>
      </div>

      <div className={`p-4 rounded-xl bg-blue-500/5 border border-blue-500/20`}>
        <div className="flex items-start gap-2">
          <span className="text-blue-400 text-[12px] mt-0.5">&#9432;</span>
          <div>
            <div className={`text-[12px] font-semibold text-blue-400 mb-1`}>{txt.noteTitle}</div>
            <p className={`text-[11px] ${colors.text.dimmed} leading-relaxed`}>{txt.noteDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventsSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      typesTitle: 'Event Types',
      filterTitle: 'Event Filtering',
      filterDesc: 'Click the event type icons in footer to filter Activity Feed:',
      hookSourceTitle: 'Hook Sources',
      hookSourceDesc: 'Events are captured from Claude Code hooks in ~/.claude/settings.json:',
      dataTitle: 'Data Captured',
    },
    th: {
      typesTitle: 'Event Types',
      filterTitle: 'Event Filtering',
      filterDesc: 'คลิกที่ icon ประเภท event ใน footer เพื่อ filter Activity Feed:',
      hookSourceTitle: 'Hook Sources',
      hookSourceDesc: 'Events ถูกจับจาก Claude Code hooks ใน ~/.claude/settings.json:',
      dataTitle: 'ข้อมูลที่จับได้',
    }
  };
  const txt = t[lang] || t.en;

  const eventTypes = [
    {
      icon: '🔧',
      name: 'PreToolUse',
      color: 'text-cyan-400',
      hook: 'PreToolUse',
      desc: lang === 'th' ? 'ก่อน tool ทำงาน - จับชื่อ tool และ input' : 'Before tool executes - captures tool name and input',
      data: ['toolName', 'toolInput', 'sessionId']
    },
    {
      icon: '✅',
      name: 'PostToolUse',
      color: 'text-emerald-400',
      hook: 'PostToolUse',
      desc: lang === 'th' ? 'หลัง tool ทำงานเสร็จ - จับ output และ success/fail' : 'After tool completes - captures output and success/fail',
      data: ['toolName', 'toolOutput', 'success']
    },
    {
      icon: '❌',
      name: 'Tool Failed',
      color: 'text-red-400',
      hook: 'PostToolUse (error)',
      desc: lang === 'th' ? 'เมื่อ tool ทำงานล้มเหลว - จับ error message' : 'When tool fails - captures error message',
      data: ['toolName', 'error', 'errorType']
    },
    {
      icon: '💬',
      name: 'UserPromptSubmit',
      color: 'text-amber-400',
      hook: 'UserPromptSubmit',
      desc: lang === 'th' ? 'เมื่อ user ส่งข้อความ - จับ session และ timestamp' : 'When user sends message - captures session and timestamp',
      data: ['sessionId', 'timestamp']
    },
    {
      icon: '🤖',
      name: 'SubagentStart',
      color: 'text-violet-400',
      hook: 'SubagentStart',
      desc: lang === 'th' ? 'เมื่อ subagent ถูกสร้าง - จับ agent ID, type, model' : 'When subagent spawns - captures agent ID, type, model',
      data: ['agentId', 'agentType', 'model', 'parentId']
    },
    {
      icon: '👥',
      name: 'SubagentStop',
      color: 'text-violet-400',
      hook: 'SubagentStop',
      desc: lang === 'th' ? 'เมื่อ subagent จบงาน - จับ tokens, duration, tools used' : 'When subagent finishes - captures tokens, duration, tools used',
      data: ['agentId', 'tokens', 'duration', 'toolsUsed']
    },
    {
      icon: '📦',
      name: 'PreCompact',
      color: 'text-slate-400',
      hook: 'PreCompact',
      desc: lang === 'th' ? 'ก่อน context compaction - บันทึก conversation ก่อนถูกย่อ' : 'Before context compaction - saves conversation before trimming',
      data: ['sessionId', 'trigger', 'timestamp']
    },
    {
      icon: '🛑',
      name: 'Stop',
      color: 'text-red-400',
      hook: 'Stop',
      desc: lang === 'th' ? 'เมื่อ Claude หยุดตอบ - จับ session ID' : 'When Claude stops responding - captures session ID',
      data: ['sessionId', 'timestamp']
    },
  ];

  const hookList = [
    { hook: 'PreToolUse', desc: lang === 'th' ? 'ก่อน tool ทำงาน' : 'Before tool runs' },
    { hook: 'PostToolUse', desc: lang === 'th' ? 'หลัง tool เสร็จ' : 'After tool completes' },
    { hook: 'SubagentStart', desc: lang === 'th' ? 'Subagent ถูกสร้าง' : 'Subagent spawned' },
    { hook: 'SubagentStop', desc: lang === 'th' ? 'Subagent จบงาน' : 'Subagent finished' },
    { hook: 'UserPromptSubmit', desc: lang === 'th' ? 'User ส่งข้อความ' : 'User sends message' },
    { hook: 'Stop', desc: lang === 'th' ? 'Claude หยุดตอบ' : 'Claude stops' },
    { hook: 'PreCompact', desc: lang === 'th' ? 'ก่อน compact context' : 'Before context compaction' },
  ];

  return (
    <div className="space-y-6">
      {/* Event Filtering */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.filterTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border} space-y-3`}>
          <p className={`text-[12px] ${colors.text.muted}`}>{txt.filterDesc}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded bg-cyan-500/10 text-[11px] text-cyan-500">🔧 Tools</span>
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-[11px] text-emerald-500">✅ Success</span>
            <span className="px-2 py-1 rounded bg-red-500/10 text-[11px] text-red-500">❌ Errors</span>
            <span className="px-2 py-1 rounded bg-amber-500/10 text-[11px] text-amber-500">💬 Prompts</span>
          </div>
        </div>
      </div>

      {/* Hook Sources */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.hookSourceTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bgAlt} border ${colors.card.border}`}>
          <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.hookSourceDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            {hookList.map((h) => (
              <div key={h.hook} className="flex items-center gap-2 text-[11px]">
                <code className="text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">{h.hook}</code>
                <span className={colors.text.dimmed}>→</span>
                <span className={colors.text.muted}>{h.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Types with Details */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.typesTitle}</h4>
        <div className="space-y-2">
          {eventTypes.map((event) => (
            <div key={event.name} className={`p-3 rounded-lg ${colors.card.bg} border ${colors.card.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{event.icon}</span>
                <span className={`text-[13px] font-semibold ${event.color.replace('-400', '-500')}`}>{event.name}</span>
                <code className={`text-[9px] ${colors.text.faint} ${colors.code.bg} px-1.5 py-0.5 rounded ml-auto`}>
                  {event.hook}
                </code>
              </div>
              <p className={`text-[11px] ${colors.text.dimmed} mb-2`}>{event.desc}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`text-[9px] ${colors.text.faint}`}>{txt.dataTitle}:</span>
                {event.data.map((d, i) => (
                  <code key={i} className="text-[9px] text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded">
                    {d}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      layoutTitle: 'Footer Layout',
      layoutDesc: 'The footer has 2 rows: Event Detail Panel and Status Bar',
      row1Title: 'Row 1: Event Detail Panel',
      row1Desc: 'Shows detailed information about the selected event from Activity Feed',
      row1Usage: 'How to use',
      row1UsageSteps: [
        'Click any event in Activity Feed to select it',
        'Event details appear in the panel',
        'Click the panel header to collapse/expand'
      ],
      row1Shows: 'Information shown',
      row1ShowsItems: [
        { label: 'Event Type', desc: 'PreToolUse, PostToolUse, UserPromptSubmit, etc.' },
        { label: 'Tool Name', desc: 'The tool being called (Read, Write, Bash, etc.)' },
        { label: 'Session ID', desc: 'Which session this event belongs to' },
        { label: 'Input/Output', desc: 'Tool input parameters and response' },
        { label: 'Error', desc: 'Error message if the tool failed' }
      ],
      row2Title: 'Row 2: Status Bar',
      row2Desc: 'Quick filters and summary statistics',
      filtersTitle: 'Event Filters (Left)',
      filtersDesc: 'Click to filter Activity Feed by event type:',
      filtersTip: 'Number shows count. Click to filter, click again to show all.',
      costTitle: 'Monthly Cost (Right)',
      costDesc: 'Total estimated API cost this month with per-model breakdown:',
      costFormat: 'Month $XX.XX  ◆$X ●$X ▪$X',
      costOpus: '◆ Opus cost',
      costSonnet: '● Sonnet cost',
      costHaiku: '▪ Haiku cost',
      costNote: 'Based on actual token usage × model pricing',
      clockTitle: 'Live Clock',
      clockDesc: '24-hour real-time clock (HH:MM:SS) — updates every second'
    },
    th: {
      layoutTitle: 'Footer Layout',
      layoutDesc: 'Footer มี 2 แถว: Event Detail Panel และ Status Bar',
      row1Title: 'แถว 1: Event Detail Panel',
      row1Desc: 'แสดงรายละเอียด event ที่เลือกจาก Activity Feed',
      row1Usage: 'วิธีใช้งาน',
      row1UsageSteps: [
        'คลิก event ใน Activity Feed เพื่อเลือก',
        'รายละเอียด event จะแสดงในแผง',
        'คลิกที่ header เพื่อ collapse/expand'
      ],
      row1Shows: 'ข้อมูลที่แสดง',
      row1ShowsItems: [
        { label: 'Event Type', desc: 'PreToolUse, PostToolUse, UserPromptSubmit ฯลฯ' },
        { label: 'Tool Name', desc: 'Tool ที่ถูกเรียก (Read, Write, Bash ฯลฯ)' },
        { label: 'Session ID', desc: 'Event นี้อยู่ใน session ไหน' },
        { label: 'Input/Output', desc: 'Parameters และ response ของ tool' },
        { label: 'Error', desc: 'ข้อความ error ถ้า tool ล้มเหลว' }
      ],
      row2Title: 'แถว 2: Status Bar',
      row2Desc: 'Quick filters และสถิติสรุป',
      filtersTitle: 'Event Filters (ซ้าย)',
      filtersDesc: 'คลิกเพื่อ filter Activity Feed ตามประเภท:',
      filtersTip: 'ตัวเลขคือจำนวน คลิกเพื่อ filter, คลิกอีกครั้งเพื่อแสดงทั้งหมด',
      costTitle: 'ค่าใช้จ่ายรายเดือน (ขวา)',
      costDesc: 'ประมาณค่า API รวมเดือนนี้ พร้อมแยกตาม model:',
      costFormat: 'Month $XX.XX  ◆$X ●$X ▪$X',
      costOpus: '◆ ค่า Opus',
      costSonnet: '● ค่า Sonnet',
      costHaiku: '▪ ค่า Haiku',
      costNote: 'คำนวณจาก tokens จริง × ราคา model',
      clockTitle: 'นาฬิกา',
      clockDesc: 'นาฬิกา real-time แบบ 24 ชั่วโมง (HH:MM:SS) — อัปเดตทุกวินาที'
    }
  };
  const txt = t[lang] || t.en;

  const filters = [
    { icon: '🔧', name: 'Tools', color: 'cyan', count: '42',
      desc: lang === 'th' ? 'Tool calls ก่อนทำงาน (PreToolUse)' : 'Tool calls before execution (PreToolUse)' },
    { icon: '✅', name: 'Success', color: 'emerald', count: '38',
      desc: lang === 'th' ? 'Tool ทำงานสำเร็จ (PostToolUse)' : 'Tool completed successfully (PostToolUse)' },
    { icon: '❌', name: 'Errors', color: 'red', count: '3',
      desc: lang === 'th' ? 'Tool ล้มเหลว/error' : 'Tool failed or error occurred' },
    { icon: '💬', name: 'Prompts', color: 'amber', count: '12',
      desc: lang === 'th' ? 'ข้อความจาก user (UserPromptSubmit)' : 'User messages (UserPromptSubmit)' },
  ];

  return (
    <div className="space-y-6">
      {/* Footer Layout Overview */}
      <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 border-gray-500/20'} border`}>
        <h3 className={`text-base font-semibold ${colors.text.primary} mb-2`}>{txt.layoutTitle}</h3>
        <p className={`text-[13px] ${colors.text.muted} leading-relaxed mb-3`}>{txt.layoutDesc}</p>
        {/* Visual representation */}
        <div className={`rounded-lg overflow-hidden border ${colors.card.border}`}>
          {/* Row 1: Event Detail */}
          <div className={`bg-gradient-to-r from-cyan-500/10 to-transparent p-2 border-b ${colors.card.border}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-500">◈ PreToolUse</span>
              <span className={`text-[10px] ${colors.text.muted}`}>Read</span>
              <span className={`text-[9px] ${colors.text.faint}`}>Session: abc1234</span>
              <div className="flex-1" />
              <span className={`text-[9px] ${colors.text.dimmed}`}>▲ collapse</span>
            </div>
          </div>
          {/* Row 2: Status Bar */}
          <div className={`${colors.card.bgAlt} px-2 py-1.5 flex items-center`}>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[9px] ${colors.text.dimmed}`}>Events <span className="font-mono">95</span></span>
              <div className="flex items-center gap-px text-[8px]">
                <span className="px-0.5 py-0.5 rounded"><span className="text-[7px]">🔧</span><span className="font-mono text-cyan-400">42</span></span>
                <span className="px-0.5 py-0.5 rounded"><span className="text-[7px]">✅</span><span className="font-mono text-emerald-400">38</span></span>
                <span className="px-0.5 py-0.5 rounded"><span className="text-[7px]">❌</span><span className="font-mono text-red-400">3</span></span>
                <span className="px-0.5 py-0.5 rounded"><span className="text-[7px]">💬</span><span className="font-mono text-amber-400">12</span></span>
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[9px] ${colors.text.muted}`}>Month</span>
              <span className="text-[9px] text-emerald-400 font-mono font-bold">$12.50</span>
              <span className="text-[8px] text-violet-500 font-mono">◆$8</span>
              <span className="text-[8px] text-blue-500 font-mono">●$4</span>
              <span className="text-[8px] text-emerald-500 font-mono">▪$0</span>
              <span className={`text-[9px] ${colors.text.muted}`}>|</span>
              <span className={`text-[9px] ${colors.text.secondary} font-mono tabular-nums`}>23:02:15</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Event Detail Panel */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.row1Title}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.row1Desc}</p>

          {/* Usage */}
          <div className="mb-3">
            <div className={`text-[10px] ${colors.text.muted} uppercase mb-2`}>{txt.row1Usage}</div>
            <div className="space-y-1">
              {txt.row1UsageSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 text-[9px] flex items-center justify-center">{i + 1}</span>
                  <span className={colors.text.muted}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Information shown */}
          <div>
            <div className={`text-[10px] ${colors.text.muted} uppercase mb-2`}>{txt.row1Shows}</div>
            <div className="space-y-1.5">
              {txt.row1ShowsItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className="text-cyan-500 font-medium shrink-0">{item.label}</span>
                  <span className={colors.text.faint}>→</span>
                  <span className={colors.text.dimmed}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Status Bar */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.row2Title}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[11px] ${colors.text.dimmed} mb-4`}>{txt.row2Desc}</p>

          {/* Filters */}
          <div className="mb-4">
            <div className={`text-[10px] ${colors.text.muted} uppercase mb-2`}>{txt.filtersTitle}</div>
            <p className={`text-[10px] ${colors.text.dimmed} mb-2`}>{txt.filtersDesc}</p>
            <div className="space-y-2">
              {filters.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                  <div className={`flex items-center gap-0 px-0.5 py-0.5 rounded bg-${f.color}-500/10 shrink-0`}>
                    <span className="text-[7px]">{f.icon}</span>
                    <span className={`text-[9px] font-mono text-${f.color}-400`}>{f.count}</span>
                  </div>
                  <span className={`text-[11px] font-medium text-${f.color}-400`}>{f.name}</span>
                  <span className={`text-[10px] ${colors.text.faint}`}>→</span>
                  <span className={`text-[10px] ${colors.text.dimmed}`}>{f.desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-blue-500">💡 {txt.filtersTip}</div>
          </div>

          {/* Monthly Cost */}
          <div>
            <div className={`text-[10px] ${colors.text.muted} uppercase mb-2`}>{txt.costTitle}</div>
            <p className={`text-[10px] ${colors.text.dimmed} mb-2`}>{txt.costDesc}</p>
            <div className={`flex items-center gap-3 p-2 rounded ${colors.code.bg}`}>
              <span className={`text-[10px] ${colors.text.muted}`}>Month</span>
              <span className="text-[11px] font-mono font-bold text-emerald-500">$12.50</span>
              <div className={`h-3 w-px ${theme === 'light' ? 'bg-slate-300' : 'bg-gray-700'}`} />
              <div className="flex items-center gap-2 text-[10px]">
                <span><span className="text-violet-500">◆</span> <span className="font-mono text-violet-500">$8</span></span>
                <span><span className="text-blue-500">●</span> <span className="font-mono text-blue-500">$4</span></span>
                <span><span className="text-emerald-500">▪</span> <span className="font-mono text-emerald-500">$0</span></span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
              <div className="flex items-center gap-1"><span className="text-violet-500">◆</span><span className={colors.text.dimmed}>{txt.costOpus}</span></div>
              <div className="flex items-center gap-1"><span className="text-blue-500">●</span><span className={colors.text.dimmed}>{txt.costSonnet}</span></div>
              <div className="flex items-center gap-1"><span className="text-emerald-500">▪</span><span className={colors.text.dimmed}>{txt.costHaiku}</span></div>
            </div>
            <div className={`mt-2 text-[10px] ${colors.text.faint}`}>ℹ️ {txt.costNote}</div>
          </div>
        </div>
      </div>

      {/* Clock */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.clockTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.clockDesc}</p>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${colors.card.bgAlt}`}>
            <span className={`text-[9px] ${colors.text.muted}`}>|</span>
            <span className={`text-[13px] ${colors.text.secondary} font-mono tabular-nums`}>23:02:15</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpGuide;
