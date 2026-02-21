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
    { id: 'demo', label: 'Demo Mode', icon: '🧪' },
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
              Oh My Claude v2.2<br />
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
            {activeSection === 'demo' && <DemoSection lang={lang} theme={theme} />}
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
      toolbarViewModeDesc: 'Cycle: Full > Compact > Focus > Expanded > Hidden',
      toolbarViewModeNote: 'Only button with text label',
      toolbarTheme: 'Theme',
      toolbarThemeDesc: 'Toggle Dark / Light mode',
      toolbarMini: 'Mini Pop-out',
      toolbarMiniDesc: 'Open floating mini window (280x400px)',
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
      centerContent: 'Agents (500px)',
      rightPanel: 'Right Panel',
      rightContent: 'Activity Feed (250px, flex when agents hidden)',
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
      toolbarViewModeDesc: 'สลับ: Full > Compact > Focus > Expanded > Hidden',
      toolbarViewModeNote: 'ปุ่มเดียวที่แสดงชื่อโหมด',
      toolbarTheme: 'Theme',
      toolbarThemeDesc: 'สลับ Dark / Light',
      toolbarMini: 'Mini Pop-out',
      toolbarMiniDesc: 'เปิดหน้าต่างลอย mini (280x400px)',
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
      centerContent: 'Agents (500px)',
      rightPanel: 'Right Panel',
      rightContent: 'Activity Feed (250px, flex เมื่อซ่อน agents)',
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
      desc: 'The system consists of 4 main parts: Backend Server, Frontend Dashboard, Claude Code Hooks, and Chrome Extension (strongly recommended)',
      fileStructure: 'File Structure',
      installSteps: 'Installation Steps',
      step1: 'Install Dependencies',
      step1Desc: 'Run in oh-my-claude folder:',
      step2: 'Configure Claude Code Hooks',
      step2Desc: 'Add hooks to your global Claude settings file:',
      step2File: '~/.claude/settings.json',
      step2FileWin: 'C:\\Users\\<username>\\.claude\\settings.json',
      step2Note: 'Replace <PATH> with your oh-my-claude folder path',
      step2Hooks: ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'PermissionRequest', 'Stop', 'PreCompact', 'Notification', 'TeammateIdle', 'TaskCompleted'],
      step3: 'Install Chrome Extension',
      step3For: 'Strongly Recommended - for Token Usage tracking',
      step3Desc: 'Pull Session % and Weekly % directly from Claude.ai:',
      step3Steps: ['Open chrome://extensions/', 'Enable "Developer mode"', 'Click "Load unpacked"', 'Select extension/ folder', 'Open claude.ai once to login (grabs your session)'],
      step3Note: 'Extension syncs usage data every 1 minute → Shows',
      step3Badge: 'Sync',
      step3Badge2: 'badge in header',
      step3Warn: 'First login to claude.ai is required so the extension can grab your session cookie. After that, sync works in the background — no need to keep the tab open.',
      step4: 'Start the Dashboard',
      step4Desc: 'Run both backend and frontend:',
      step4Note: 'Dashboard opens at',
      step5: 'Install as App (PWA)',
      step5For: 'Optional',
      step5Desc: 'Install as a standalone desktop app for quick access:',
      step5Steps: ['Open http://localhost:4825 in Chrome', 'Click the Install app icon (monitor with ↓ arrow) in the address bar', 'Click "Install" in the popup dialog', 'App opens in its own window — pin to taskbar!'],
      step5Note: 'Supports mini mode (280×400) and full dashboard (765×870)',
      ports: 'Ports Used',
      hookExample: 'Hook Configuration Example',
      important: 'Important',
      restartNote: 'Restart Claude Code terminal after adding hooks',
    },
    th: {
      title: 'การติดตั้ง Oh My Claude',
      desc: 'ระบบประกอบด้วย 4 ส่วนหลัก: Backend Server, Frontend Dashboard, Claude Code Hooks และ Chrome Extension (แนะนำอย่างยิ่ง)',
      fileStructure: 'File Structure',
      installSteps: 'ขั้นตอนการติดตั้ง',
      step1: 'ติดตั้ง Dependencies',
      step1Desc: 'รันใน folder oh-my-claude:',
      step2: 'ตั้งค่า Claude Code Hooks',
      step2Desc: 'เพิ่ม hooks ในไฟล์ global Claude settings:',
      step2File: '~/.claude/settings.json',
      step2FileWin: 'C:\\Users\\<username>\\.claude\\settings.json',
      step2Note: 'แทนที่ <PATH> ด้วย path ไปยัง folder oh-my-claude ของคุณ',
      step2Hooks: ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'PermissionRequest', 'Stop', 'PreCompact', 'Notification', 'TeammateIdle', 'TaskCompleted'],
      step3: 'ติดตั้ง Chrome Extension',
      step3For: 'แนะนำอย่างยิ่ง - สำหรับดู Token Usage',
      step3Desc: 'ดึง Session % และ Weekly % จาก Claude.ai โดยตรง:',
      step3Steps: ['เปิด chrome://extensions/', 'เปิด "Developer mode"', 'คลิก "Load unpacked"', 'เลือก folder extension/', 'เปิด claude.ai สักครั้งเพื่อ login (extension จะจับ session ไว้)'],
      step3Note: 'Extension sync ข้อมูลทุก 1 นาที → แสดง',
      step3Badge: 'Sync',
      step3Badge2: 'badge ที่ header',
      step3Warn: 'ต้อง login เข้า claude.ai ครั้งแรกเพื่อให้ extension จับ session cookie ได้ หลังจากนั้น sync ทำงานใน background ได้เลย — ไม่ต้องเปิด tab ค้างไว้',
      step4: 'เริ่มใช้งาน Dashboard',
      step4Desc: 'รัน backend และ frontend:',
      step4Note: 'Dashboard เปิดที่',
      step5: 'ติดตั้งเป็น App (PWA)',
      step5For: 'Optional',
      step5Desc: 'ติดตั้งเป็น desktop app เพื่อเข้าถึงได้ง่าย:',
      step5Steps: ['เปิด http://localhost:4825 ใน Chrome', 'คลิก icon Install app (รูปจอมีลูกศร ↓) ที่ address bar', 'คลิก "Install" ในหน้าต่าง popup', 'App เปิดในหน้าต่างแยก — ปักหมุดที่ taskbar ได้เลย!'],
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
          <div className={`pl-8 ${colors.text.dimmed}`}>├── <span className="text-amber-500">events.json</span> <span className={colors.text.faint}>← Event storage (auto)</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-amber-500">agents.json</span> <span className={colors.text.faint}>← Agent storage (auto)</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-blue-500">frontend/</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>├── <span className="text-emerald-500">src/App.jsx</span> <span className={colors.text.faint}>← React dashboard</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-amber-500">vite.config.js</span> <span className={colors.text.faint}>← port 4825</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-violet-500">hooks/</span></div>
          <div className={`pl-8 ${colors.text.dimmed}`}>└── <span className="text-emerald-500">send_event.js</span> <span className={colors.text.faint}>← Hook script (sends to backend)</span></div>
          <div className={`pl-4 ${colors.text.dimmed}`}>├── <span className="text-cyan-500">extension/</span> <span className={colors.text.faint}>← Chrome Extension (recommended)</span></div>
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
            {(() => {
              const withMatcher = ['PreToolUse', 'PostToolUse'];
              const allHooks = txt.step2Hooks;
              // Build full JSON for copy
              const hookCmd = (name) => `node "<PATH>/hooks/send_event.js" --event-type ${name}`;
              const fullJson = JSON.stringify({
                hooks: Object.fromEntries(allHooks.map(name => [
                  name,
                  [{ ...(withMatcher.includes(name) ? { matcher: '' } : {}), hooks: [{ type: 'command', command: hookCmd(name) }] }]
                ]))
              }, null, 2);
              return (
                <div className={`relative font-mono text-[9px] ${colors.code.bg} rounded-lg mb-2 border ${colors.card.border} overflow-hidden`}>
                  <button
                    onClick={(e) => {
                      navigator.clipboard.writeText(fullJson);
                      const btn = e.currentTarget;
                      btn.textContent = '✓ Copied!';
                      setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
                    }}
                    className={`absolute top-1.5 right-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded ${theme === 'light' ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} transition-all`}
                    title="Copy full hooks JSON"
                  >📋 Copy</button>

                  <div className="p-2.5 overflow-x-auto max-h-[360px] overflow-y-auto">
                    {/* Structure */}
                    <div className={colors.text.dimmed}>{'{'}</div>
                    <div className="text-cyan-500 pl-2">{'"hooks": {'}</div>

                    {allHooks.map((name, i) => {
                      const hasMatcher = withMatcher.includes(name);
                      const isLast = i === allHooks.length - 1;
                      return (
                        <div key={name} className="pl-4 leading-snug">
                          <div>
                            <span className="text-sky-400">{`"${name}"`}</span>
                            <span className={colors.text.dimmed}>{': [{'}</span>
                            {hasMatcher && <>
                              <span className="text-violet-400">{' "matcher"'}</span>
                              <span className={colors.text.dimmed}>{': "",'}</span>
                            </>}
                          </div>
                          <div className="pl-4">
                            <span className={colors.text.dimmed}>{'"hooks"'}: [{'{'} </span>
                            <span className="text-emerald-500">{'"type"'}</span>
                            <span className={colors.text.dimmed}>: "command",</span>
                          </div>
                          <div className="pl-6 break-all">
                            <span className="text-amber-500">{'"command"'}</span>
                            <span className={colors.text.dimmed}>{': '}</span>
                            <span className="text-amber-400/70">{`"node \\"<PATH>/hooks/send_event.js\\"`}</span>
                          </div>
                          <div className="pl-8 break-all">
                            <span className="text-amber-400/70">{`--event-type `}</span>
                            <span className="text-amber-300 font-semibold">{name}</span>
                            <span className="text-amber-400/70">{'"'}</span>
                          </div>
                          <div className="pl-4">
                            <span className={colors.text.dimmed}>{`}] }]${isLast ? '' : ','}`}</span>
                          </div>
                        </div>
                      );
                    })}

                    <div className="text-cyan-500 pl-2">{'}'}</div>
                    <div className={colors.text.dimmed}>{'}'}</div>
                  </div>
                </div>
              );
            })()}
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
            <div className="flex items-start gap-2 text-[10px] mt-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-400 shrink-0">ℹ️</span>
              <span className="text-blue-400/90">{txt.step3Warn}</span>
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
      generalPurposeType: 'Full-capability agent (read, write, bash)',
      exploreType: 'Codebase exploration (read-only)',
      planType: 'Architecture planning (read-only)',
      bashType: 'Command execution specialist',
      lifecycleTitle: 'Agent Lifecycle (5-Level)',
      lifecycleDesc: 'Status is shown as a colored dot + label (e.g. "● Active") on the first line of each agent card. Agents transition through 5 levels based on inactivity:',
      statusActive: 'Active',
      statusActiveDesc: 'Receiving events, green pulse',
      statusIdle: 'Idle',
      statusIdleDesc: 'No activity for 3 min, yellow',
      statusStale: 'Stale',
      statusStaleDesc: 'No activity for 8 min, orange',
      statusTimeout: 'Timeout',
      statusTimeoutDesc: 'No activity for 20 min, amber pulse',
      statusRemoved: 'Removed',
      statusRemovedDesc: 'No activity for 30 min, deleted',
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
      cardLayoutDesc: 'Each main agent displays up to 4 lines. Team members show 3 lines indented. Non-team subagents show 3 lines. Stopped sessions/subagents are dimmed (opacity 50%).',
      cardLine1: 'Main Line 1: Session number + Model badge (with version) + Smart Status (icon + label) or Status badge + Duration + Tokens',
      cardLine2: 'Main Line 2: Project name (monospace cyan uppercase) + Team badge (👥 team-name, if team lead)',
      cardLine3: 'Main Line 3: Last activity (tool icon + tool name + file path) + Session ID',
      cardLine4: 'Main Line 4: Task count badge (active/total running) + Git diff chip (+adds -dels files)',
      teamHeaderTitle: 'Team Header',
      teamHeaderDesc: 'Users SVG icon (2-person stroke) + Team name + Member count + Health badge (🟢 Healthy / 🟡 idle / 🟠 high-token / 🔴 conflict) + Total team tokens',
      cardSubLine1: 'Team Member Line 1: └ + Person icon + Agent name badge + Model + Type + Health warnings (🔥 high tokens / 💤 idle >5m / ⚠ file conflict) + Status + Duration + Tokens',
      cardSubLine2: 'Team Member Line 2: 🔧 Tools used (left) + Token bar with % of team total (right-aligned)',
      cardSubLine3: 'Team Member Line 3: 💬 Description + Agent ID',
      cardNonTeamLine1: 'Non-team Subagent Line 1: └ + Model + Type + Status + Duration + Tokens',
      cardNonTeamLine2: 'Non-team Subagent Line 2: 🔧 Tools used',
      cardNonTeamLine3: 'Non-team Subagent Line 3: 💬 Description + Agent ID',
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
      generalPurposeType: 'Agent แบบเต็ม (อ่าน, เขียน, bash)',
      exploreType: 'สำรวจ codebase (อ่านอย่างเดียว)',
      planType: 'วางแผน architecture (อ่านอย่างเดียว)',
      bashType: 'รัน commands เฉพาะทาง',
      lifecycleTitle: 'Agent Lifecycle (5 ระดับ)',
      lifecycleDesc: 'สถานะแสดงเป็นจุดสี + label (เช่น "● Active") บนบรรทัดแรกของแต่ละ agent card เปลี่ยนสถานะตาม 5 ระดับเมื่อไม่มี activity:',
      statusActive: 'Active',
      statusActiveDesc: 'มี events เข้ามา, เขียว กะพริบ',
      statusIdle: 'Idle',
      statusIdleDesc: 'ไม่มี activity 3 นาที, เหลือง',
      statusStale: 'Stale',
      statusStaleDesc: 'ไม่มี activity 8 นาที, ส้ม',
      statusTimeout: 'Timeout',
      statusTimeoutDesc: 'ไม่มี activity 20 นาที, อำพัน กะพริบ',
      statusRemoved: 'Removed',
      statusRemovedDesc: 'ไม่มี activity 30 นาที, ลบออก',
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
      cardLayoutDesc: 'Main agent แสดง 4 บรรทัด, Team member แสดง 3 บรรทัดย่อย, Non-team subagent แสดง 3 บรรทัด Session/subagent ที่ stopped จะจางลง (opacity 50%)',
      cardLine1: 'Main บรรทัด 1: ลำดับ session + Model badge (พร้อมเวอร์ชัน) + Smart Status (icon + label) หรือ Status badge + Duration + Tokens',
      cardLine2: 'Main บรรทัด 2: ชื่อ project (monospace สีฟ้า ตัวพิมพ์ใหญ่) + Team badge (👥 ชื่อทีม, ถ้าเป็น team lead)',
      cardLine3: 'Main บรรทัด 3: Activity ล่าสุด (ไอคอน tool + ชื่อ + path ไฟล์) + Session ID',
      cardLine4: 'Main บรรทัด 4: Task count badge (active/total running) + Git diff chip (+เพิ่ม -ลบ ไฟล์)',
      teamHeaderTitle: 'Team Header',
      teamHeaderDesc: 'SVG ไอคอน Users (2 คน stroke) + ชื่อทีม + จำนวน members + Health badge (🟢 Healthy / 🟡 idle / 🟠 high-token / 🔴 conflict) + Total tokens ของทีม',
      cardSubLine1: 'Team Member บรรทัด 1: └ + ไอคอนคน + ชื่อ Agent badge + Model + Type + Health warnings (🔥 tokens สูง / 💤 idle >5m / ⚠ file conflict) + Status + Duration + Tokens',
      cardSubLine2: 'Team Member บรรทัด 2: 🔧 Tools ที่ใช้ (ซ้าย) + Token bar พร้อม % ของทีม (ชิดขวา)',
      cardSubLine3: 'Team Member บรรทัด 3: 💬 Description + Agent ID',
      cardNonTeamLine1: 'Non-team Subagent บรรทัด 1: └ + Model + Type + Status + Duration + Tokens',
      cardNonTeamLine2: 'Non-team Subagent บรรทัด 2: 🔧 Tools ที่ใช้',
      cardNonTeamLine3: 'Non-team Subagent บรรทัด 3: 💬 Description + Agent ID',
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
          <div className="p-3 rounded-lg bg-pink-500/10">
            <div className="text-[12px] font-semibold text-pink-400">General-Purpose</div>
            <div className={`text-[11px] ${colors.text.dimmed}`}>{txt.generalPurposeType}</div>
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

      {/* Card Layout Example — Full Demo */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.cardLayoutTitle}</h4>
        <p className={`text-[12px] ${colors.text.dimmed} mb-3`}>{txt.cardLayoutDesc}</p>

        {/* ═══ FULL DASHBOARD MOCKUP ═══ */}
        <div className={`rounded-xl border ${colors.card.border} overflow-hidden`}>

          {/* ── Session 1: Active Opus with Team + Subagents ── */}
          <div className={`${colors.card.bg} bg-emerald-500/[0.02]`}>
            {/* Main agent - Line 1: Number + Model + Smart Status + Duration + Tokens */}
            <div className="px-3 pt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-white w-[16px] text-right">1.</span>
                <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">Opus 4.6</span>
                <span className="text-[10px] animate-pulse">✍️</span>
                <span className="text-[9px] font-medium text-orange-400">Writing</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={colors.text.dimmed}>2h 41m</span>
                <span className="text-amber-500">753.7k</span>
              </div>
            </div>
            {/* Main agent - Line 2: Project name + Team badge */}
            <div className="px-3 pt-1 pl-[28px] flex items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/70">OH-MY-CLAUDE</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">👥 refactor-crew</span>
            </div>
            {/* Main agent - Line 3: Last activity + Session ID */}
            <div className="px-3 pt-1 pl-[20px] flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-orange-500">✏️</span>
                <span className="font-medium text-orange-500">Edit</span>
                <span className={colors.text.dimmed}>frontend/src/App.jsx</span>
              </div>
              <code className={`text-[8px] font-mono ${colors.text.faint}`}>sess-00</code>
            </div>
            {/* Main agent - Line 4: Task count + Git diff */}
            <div className="px-3 pt-1 pb-2 pl-[20px] flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">2/4 running</span>
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

            {/* ── Team Section ── */}
            <div className={`border-t ${colors.card.border}`}>
              {/* Team header: Users icon + name + members + health + tokens */}
              <div className="pl-5 pr-2 py-1 bg-indigo-500/[0.05] border-b border-indigo-500/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-100">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </span>
                  <span className="text-[10px] font-semibold text-gray-100">refactor-crew</span>
                  <span className={`text-[9px] ${colors.text.muted}`}>3 members</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/20">🟡 1 idle · 2 high-token</span>
                </div>
                <span className="font-mono text-[9px] tabular-nums text-amber-500">214.5k</span>
              </div>
              {/* Team member 1 - Backend-Staff: Active Sonnet */}
              <div className={`${colors.card.bgAlt} pb-2`}>
                {/* Line 1: └ + person icon + name + model + type + health + status + duration + tokens */}
                <div className="px-3 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className={colors.text.faint}>└</span>
                    <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-gray-100">
                        <circle cx="8" cy="4.5" r="3" fill="currentColor"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" fill="currentColor" opacity="0.7"/>
                      </svg>
                    </span>
                    <span className="font-medium px-1.5 py-0.5 rounded bg-white/15 text-gray-100">Backend-Staff</span>
                    <span className="font-medium px-1 py-0.5 rounded bg-sky-500/15 text-sky-400">Sonnet 4.5</span>
                    <span className={`px-1 py-0.5 rounded bg-pink-500/15 text-pink-400`}>General-Purpose</span>
                    <span className="text-[8px] px-1 py-0.5 rounded-full bg-orange-500/15 text-orange-400">🔥</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15">
                      <span className="text-emerald-400 animate-pulse">●</span>
                      <span className="text-[8px] text-emerald-400">Active</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className={colors.text.dimmed}>12m 4s</span>
                    <span className="text-amber-500">89.2k</span>
                  </div>
                </div>
                {/* Line 2: Tools (left) + Token bar (right) */}
                <div className="px-3 pt-1 pl-8 flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">🔧</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Read</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Grep</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Glob</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-[50px] h-1 rounded-full bg-gray-700/30 overflow-hidden">
                      <div className="h-full bg-amber-500/50 rounded-full" style={{ width: '42%' }} />
                    </div>
                    <span className="text-[8px] font-mono text-amber-500/70">42%</span>
                  </div>
                </div>
                {/* Line 3: Description + Agent ID */}
                <div className="px-3 pt-0.5 pl-8 flex items-center justify-between">
                  <span className={`text-[9px] ${colors.text.dimmed}`}>💬 Audit auth module for security issues</span>
                  <code className={`text-[8px] font-mono ${colors.text.faint}`}>task_00</code>
                </div>
              </div>
              {/* Team member 2 - Frontend-Fixes: Idle Haiku with 💤 warning */}
              <div className={`${colors.card.bgAlt} border-t ${colors.card.border} pb-2 relative`}>
                <div className="px-3 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className={colors.text.faint}>└</span>
                    <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-gray-100">
                        <circle cx="8" cy="4.5" r="3" fill="currentColor"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" fill="currentColor" opacity="0.7"/>
                      </svg>
                    </span>
                    <span className="font-medium px-1.5 py-0.5 rounded bg-white/15 text-gray-100">Frontend-Fixes</span>
                    <span className="font-medium px-1 py-0.5 rounded bg-teal-500/15 text-teal-400">Haiku 4.5</span>
                    <span className={`px-1 py-0.5 rounded bg-pink-500/15 text-pink-400`}>General-Purpose</span>
                    <span className="text-[8px] px-1 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">💤</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/15">
                      <span className="text-yellow-400">●</span>
                      <span className="text-[8px] text-yellow-400">Idle</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className={colors.text.dimmed}>12m 32s</span>
                    <span className="text-amber-500">12.1k</span>
                  </div>
                </div>
                <div className="px-3 pt-1 pl-8 flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">🔧</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Read</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Edit</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Bash</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-[50px] h-1 rounded-full bg-gray-700/30 overflow-hidden">
                      <div className="h-full bg-amber-500/50 rounded-full" style={{ width: '6%' }} />
                    </div>
                    <span className="text-[8px] font-mono text-amber-500/70">6%</span>
                  </div>
                </div>
                <div className="px-3 pt-0.5 pl-8 flex items-center justify-between">
                  <span className={`text-[9px] ${colors.text.dimmed}`}>💬 Fix frontend layout and responsive issues</span>
                  <code className={`text-[8px] font-mono ${colors.text.faint}`}>task_00</code>
                </div>
                {/* Annotation: idle + health warning */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full hidden sm:flex items-center gap-1">
                  <span className="w-4 h-px bg-yellow-500/40" />
                  <span className="text-[7px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 whitespace-nowrap">💤 idle &gt;5m warning</span>
                </div>
              </div>
              {/* Team member 3 - Backend-Security: Active Sonnet with 🔥 */}
              <div className={`${colors.card.bgAlt} border-t ${colors.card.border} pb-2 relative`}>
                <div className="px-3 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className={colors.text.faint}>└</span>
                    <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-gray-100">
                        <circle cx="8" cy="4.5" r="3" fill="currentColor"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" fill="currentColor" opacity="0.7"/>
                      </svg>
                    </span>
                    <span className="font-medium px-1.5 py-0.5 rounded bg-white/15 text-gray-100">Backend-Security</span>
                    <span className="font-medium px-1 py-0.5 rounded bg-sky-500/15 text-sky-400">Sonnet 4.5</span>
                    <span className={`px-1 py-0.5 rounded bg-pink-500/15 text-pink-400`}>General-Purpose</span>
                    <span className="text-[8px] px-1 py-0.5 rounded-full bg-orange-500/15 text-orange-400">🔥</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15">
                      <span className="text-emerald-400 animate-pulse">●</span>
                      <span className="text-[8px] text-emerald-400">Active</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className={colors.text.dimmed}>8m 51s</span>
                    <span className="text-amber-500">113.2k</span>
                  </div>
                </div>
                <div className="px-3 pt-1 pl-8 flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">🔧</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Read</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Edit</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Grep</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-[50px] h-1 rounded-full bg-gray-700/30 overflow-hidden">
                      <div className="h-full bg-amber-500/50 rounded-full" style={{ width: '53%' }} />
                    </div>
                    <span className="text-[8px] font-mono text-amber-500/70">53%</span>
                  </div>
                </div>
                <div className="px-3 pt-0.5 pl-8 flex items-center justify-between">
                  <span className={`text-[9px] ${colors.text.dimmed}`}>💬 Security hardening and input validation</span>
                  <code className={`text-[8px] font-mono ${colors.text.faint}`}>task_00</code>
                </div>
                {/* Annotation: high-token warning */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full hidden sm:flex items-center gap-1">
                  <span className="w-4 h-px bg-orange-500/40" />
                  <span className="text-[7px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 whitespace-nowrap">🔥 &gt;50k tokens</span>
                </div>
              </div>
            </div>

            {/* Team feature callouts */}
            <div className="px-2 py-2 bg-gradient-to-r from-indigo-500/[0.07] to-transparent border-t border-indigo-500/10">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10">
                  <span className="text-[10px]">📨</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'ส่งข้อความระหว่าง agents' : 'Inter-agent messaging'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10">
                  <span className="text-[10px]">📋</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'แบ่ง tasks อัตโนมัติ' : 'Auto task delegation'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10">
                  <span className="text-[10px]">⚠️</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'ตรวจจับ file conflict' : 'File conflict detection'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-500/10">
                  <span className="text-[10px]">💤</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'เตือน idle + health check' : 'Idle warnings + health check'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10">
                  <span className="text-[10px]">📊</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'Token % ต่อ member' : 'Per-member token tracking'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-violet-500/10">
                  <span className="text-[10px]">🏥</span>
                  <span className={`text-[8px] ${colors.text.muted}`}>{lang === 'th' ? 'สุขภาพทีม 🟢🟡🟠🔴' : 'Team health 🟢🟡🟠🔴'}</span>
                </div>
              </div>
            </div>

            {/* ── Non-team subagent (stopped, dimmed) ── */}
            <div className={`border-t ${colors.card.border} opacity-50 pb-2`}>
              <div className="px-3 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={colors.text.faint}>└</span>
                  <span className="font-medium px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">Opus 4.6</span>
                  <span className={`px-1 py-0.5 rounded bg-pink-500/15 text-pink-400`}>Explore</span>
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
              <div className="px-3 pt-1 pl-8 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">🔧</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Read</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Grep</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Glob</span>
              </div>
              <div className="px-3 pt-0.5 pl-8 flex items-center justify-between">
                <span className={`text-[9px] ${colors.text.dimmed}`}>💬 Research pre-existing errors</span>
                <code className={`text-[8px] font-mono ${colors.text.faint}`}>task_00</code>
              </div>
            </div>
          </div>

          {/* ── Session 2: Active Sonnet (separate, no team) ── */}
          <div className={`border-t-2 ${colors.card.border} ${colors.card.bg} bg-emerald-500/[0.02]`}>
            <div className="px-3 pt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-white w-[16px] text-right">3.</span>
                <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-sky-500/15 text-sky-400">Sonnet 4.5</span>
                <span className="text-[10px] animate-pulse">🧠</span>
                <span className="text-[9px] font-medium text-violet-400">Thinking</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={colors.text.dimmed}>8m 15s</span>
                <span className="text-amber-500">33.7k</span>
              </div>
            </div>
            <div className="px-3 pt-1 pl-[28px] flex items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/70">API-SERVER</span>
            </div>
            <div className="px-3 pt-1 pl-[20px] flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-orange-500">📝</span>
                <span className="font-medium text-orange-500">Write</span>
                <span className={colors.text.dimmed}>backend/routes/api.js</span>
              </div>
              <code className={`text-[8px] font-mono ${colors.text.faint}`}>sess-00</code>
            </div>
            <div className="px-3 pt-1 pb-2 pl-[20px] flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">1/1 running</span>
              <div className="inline-flex items-center gap-0 rounded-md border border-gray-700/40 overflow-hidden text-[10px] font-mono">
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10">
                  <span className="w-1 h-1 rounded-full bg-green-400" />
                  <span className="text-green-400">+89</span>
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border-l border-gray-700/40">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  <span className="text-red-400">-12</span>
                </span>
                <span className="px-1.5 py-0.5 text-gray-500 border-l border-gray-700/40">3 files</span>
              </div>
            </div>
            {/* Non-team subagent of session 2 */}
            <div className={`border-t ${colors.card.border} ${colors.card.bgAlt} pb-2`}>
              <div className="px-3 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={colors.text.faint}>└</span>
                  <span className="font-medium px-1 py-0.5 rounded bg-teal-500/15 text-teal-400">Haiku 4.5</span>
                  <span className={`px-1 py-0.5 rounded bg-pink-500/15 text-pink-400`}>General-Purpose</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15">
                    <span className="text-emerald-400 animate-pulse">●</span>
                    <span className="text-[8px] text-emerald-400">Active</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className={colors.text.dimmed}>1m 30s</span>
                  <span className="text-amber-500">5.1k</span>
                </div>
              </div>
              <div className="px-3 pt-1 pl-8 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">🔧</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Glob</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80">Read</span>
              </div>
              <div className="px-3 pt-0.5 pl-8 flex items-center justify-between">
                <span className={`text-[9px] ${colors.text.dimmed}`}>💬 Search for related test files</span>
                <code className={`text-[8px] font-mono ${colors.text.faint}`}>task_00</code>
              </div>
            </div>
          </div>

          {/* ── Team Comms Timeline ── */}
          <div className={`border-t-2 ${colors.card.border} ${theme === 'light' ? 'bg-slate-50' : 'bg-gray-900/40'}`}>
            <div className="px-2 py-1 flex items-center gap-1">
              <span className="text-[9px]">📨</span>
              <span className="text-[9px] font-medium text-indigo-400 uppercase tracking-wider">Team Comms</span>
              <span className={`text-[8px] font-mono ${colors.text.muted}`}>(4)</span>
            </div>
            <div className="px-1 pb-1 space-y-0.5">
              <div className="flex items-center gap-1 px-1 py-0.5 text-[9px]">
                <span className={`font-mono ${colors.text.muted} shrink-0 w-[35px]`}>14:32</span>
                <span className="font-medium text-cyan-400 shrink-0">researcher</span>
                <span className={colors.text.muted}>→</span>
                <span className="font-medium text-cyan-400 shrink-0">team-lead</span>
                <span className={`${colors.text.muted} truncate`}>Auth module audit complete, found 3 issues</span>
              </div>
              <div className="flex items-center gap-1 px-1 py-0.5 text-[9px]">
                <span className={`font-mono ${colors.text.muted} shrink-0 w-[35px]`}>14:30</span>
                <span className="font-medium text-cyan-400 shrink-0">team-lead</span>
                <span className={colors.text.muted}>→</span>
                <span className="font-medium text-amber-400 shrink-0">ALL</span>
                <span className={`${colors.text.muted} truncate`}>Starting refactor phase 2</span>
              </div>
              <div className="flex items-center gap-1 px-1 py-0.5 text-[9px]">
                <span className={`font-mono ${colors.text.muted} shrink-0 w-[35px]`}>14:28</span>
                <span className="font-medium text-cyan-400 shrink-0">implementer</span>
                <span className={colors.text.muted}>→</span>
                <span className="font-medium text-emerald-400 shrink-0">team-lead</span>
                <span className={`${colors.text.muted} truncate`}>Task #3 done: auth middleware refactored</span>
              </div>
              <div className="flex items-center gap-1 px-1 py-0.5 text-[9px]">
                <span className={`font-mono ${colors.text.muted} shrink-0 w-[35px]`}>14:25</span>
                <span className="font-medium text-cyan-400 shrink-0">test-runner</span>
                <span className={colors.text.muted}>→</span>
                <span className="font-medium text-yellow-400 shrink-0">team-lead</span>
                <span className={`${colors.text.muted} truncate`}>Idle — waiting for new test tasks</span>
              </div>
            </div>
          </div>

          {/* ── Activity Feed ── */}
          <div className={`border-t-2 ${colors.card.border} ${theme === 'light' ? 'bg-white' : 'bg-gray-950/50'}`}>
            <div className="p-1.5 space-y-0.5">
              {/* User Prompt */}
              <div className="flex items-start gap-2 py-1 px-2">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px]">💬</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium text-amber-500">User Prompt</span>
                    <span className={`text-[9px] ${colors.text.muted} font-mono`}>2m ago</span>
                  </div>
                  <p className={`text-[11px] ${colors.text.secondary} leading-relaxed line-clamp-1`}>Refactor the authentication module to use JWT...</p>
                </div>
              </div>
              {/* PreToolUse - Edit (active) */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] shrink-0 animate-pulse">⏳</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 shrink-0">Edit</span>
                <span className={`text-[10px] ${colors.text.muted} font-mono truncate flex-1`}>server.js</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>just now</span>
              </div>
              {/* PostToolUse - Read (done) */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] shrink-0">✅</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 shrink-0">Read</span>
                <span className={`text-[10px] ${colors.text.muted} font-mono truncate flex-1`}>auth/middleware.ts</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>30s ago</span>
              </div>
              {/* PostToolUse - Bash (done) */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] shrink-0">✅</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">Bash</span>
                <span className={`text-[10px] ${colors.text.muted} font-mono truncate flex-1`}>npm test -- --watch</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>1m ago</span>
              </div>
              {/* SubagentStart */}
              <div className="flex items-center gap-2 py-1 px-2">
                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] bg-violet-500/15">🤖</div>
                <span className="text-[10px] font-medium text-violet-500 shrink-0">SubagentStart</span>
                <span className={`text-[10px] ${colors.text.muted} truncate flex-1`}>researcher (Sonnet)</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>1m ago</span>
              </div>
              {/* TeamCreate */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] shrink-0">✅</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 shrink-0">TeamCreate</span>
                <span className={`text-[10px] ${colors.text.muted} font-mono truncate flex-1`}>refactor-crew</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>2m ago</span>
              </div>
              {/* SendMessage */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] shrink-0">✅</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-500 shrink-0">SendMessage</span>
                <span className={`text-[10px] ${colors.text.muted} font-mono truncate flex-1`}>→ researcher</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono shrink-0`}>2m ago</span>
              </div>
              {/* Stop */}
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px]">🛑</span>
                <span className="text-[10px] text-red-500">Stopped</span>
                <span className={`text-[9px] ${colors.text.muted} font-mono ml-auto`}>5m ago</span>
              </div>
            </div>
          </div>

          {/* ── Footer: Event Detail + Status Bar ── */}
          <div className={`border-t-2 ${colors.card.border}`}>
            {/* Row 1: Event Detail (expanded) */}
            <div className={`bg-gradient-to-r from-orange-500/10 to-transparent p-2 border-b ${colors.card.border}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500">⏳ PreToolUse</span>
                <span className={`text-[10px] font-medium text-orange-400`}>Edit</span>
                <span className={`text-[9px] ${colors.text.faint}`}>server.js</span>
                <div className="flex-1" />
                <span className={`text-[9px] ${colors.text.dimmed}`}>▲ collapse</span>
              </div>
              <div className={`mt-1.5 text-[9px] ${colors.text.muted} font-mono ${colors.code.bg} p-1.5 rounded max-h-[40px] overflow-hidden`}>
                <div>Session: 91188c68 · just now</div>
                <div className={colors.text.faint}>toolInput: {`{ "file_path": "server.js", "old_string": "..." }`}</div>
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
                <span className={`text-[9px] ${colors.text.secondary} font-mono tabular-nums`}>14:33:07</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line descriptions */}
        <div className="mt-3 space-y-1">
          <div className={`text-[10px] font-semibold ${colors.text.secondary} uppercase tracking-wider mt-2 mb-1`}>Main Agent</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-emerald-400 font-mono">1</span> {txt.cardLine1}</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-cyan-400 font-mono">2</span> {txt.cardLine2}</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-amber-400 font-mono">3</span> {txt.cardLine3}</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-violet-400 font-mono">4</span> {txt.cardLine4}</div>
          <div className={`text-[10px] font-semibold ${colors.text.secondary} uppercase tracking-wider mt-3 mb-1`}>Team Header</div>
          <div className={`text-[11px] ${colors.text.dimmed}`}><span className="text-indigo-400 font-mono">◆</span> {txt.teamHeaderDesc}</div>
          <div className={`text-[10px] font-semibold ${colors.text.secondary} uppercase tracking-wider mt-3 mb-1`}>Team Member (Subagent)</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">└</span> {txt.cardSubLine1}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardSubLine2}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardSubLine3}</div>
          <div className={`text-[10px] font-semibold ${colors.text.secondary} uppercase tracking-wider mt-3 mb-1`}>Non-team Subagent</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">└</span> {txt.cardNonTeamLine1}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardNonTeamLine2}</div>
          <div className={`text-[11px] ${colors.text.faint}`}><span className="text-gray-500 font-mono">&nbsp;</span> {txt.cardNonTeamLine3}</div>
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
      whatDesc: 'A compact floating popup window (~280x400px) that shows key metrics at a glance. Perfect for keeping on screen while working.',
      howTitle: 'How to Open',
      howDesc: 'Click the Mini button in the header bar. A popup window opens with its own WebSocket connection.',
      howStep1: 'Click "Mini" button in header',
      howStep2: 'Popup window opens (280x400px)',
      howStep3: 'Window stays on top while you work',
      featuresTitle: 'What it Shows',
      headerTitle: 'Header',
      headerItems: [
        'Connection indicator (green dot = live)',
        'Extension sync icon (spinning = syncing, skull = offline)',
        'Usage badge (Chill / Warming Up / On Fire / etc.)',
      ],
      gaugeTitle: 'Usage Gauges',
      gaugeItems: [
        'Session gauge — 5h rolling usage % with reset timer',
        'Weekly gauge — 7-day usage % with reset timer',
      ],
      agentTitle: 'Agent List',
      agentItems: [
        'Sessions grouped by creation order, active first',
        'Full model name (Opus 4.6, Sonnet 4.5, Haiku 4.5)',
        'Live smart status with animated icons (Thinking, Reading, Writing, Executing, Spawning, etc.)',
        'Token usage per session',
        'Project name from working directory',
        'Team badge with member count when teams are active',
        'Subagent dots with model name + agent name',
        'Active/total subagent count per session',
      ],
      footerTitle: 'Footer',
      footerItems: [
        'Active session count + active task count',
        'Monthly estimated cost',
        'Clear stopped agents button (✕)',
      ],
      themeTitle: 'Theme Sync',
      themeDesc: 'Mini Mode automatically follows the theme of the main dashboard. Change theme in main app and the popup updates instantly.',
    },
    th: {
      whatTitle: 'Mini Mode คืออะไร?',
      whatDesc: 'หน้าต่าง popup ขนาดกะทัดรัด (~280x400px) แสดงข้อมูลสำคัญแบบรวดเร็ว เหมาะสำหรับเปิดค้างไว้ขณะทำงาน',
      howTitle: 'วิธีเปิด',
      howDesc: 'คลิกปุ่ม Mini ที่ header bar หน้าต่าง popup จะเปิดพร้อม WebSocket connection ของตัวเอง',
      howStep1: 'คลิกปุ่ม "Mini" ที่ header',
      howStep2: 'หน้าต่าง popup เปิดขึ้น (280x400px)',
      howStep3: 'หน้าต่างลอยอยู่ด้านบนขณะทำงาน',
      featuresTitle: 'แสดงอะไรบ้าง',
      headerTitle: 'Header',
      headerItems: [
        'ไฟสถานะการเชื่อมต่อ (จุดเขียว = เชื่อมต่อแล้ว)',
        'ไอคอน sync extension (หมุน = กำลัง sync, หัวกระโหลก = ออฟไลน์)',
        'Usage badge (Chill / Warming Up / On Fire / ฯลฯ)',
      ],
      gaugeTitle: 'Usage Gauges',
      gaugeItems: [
        'Session gauge — % การใช้งาน 5 ชม. พร้อมเวลา reset',
        'Weekly gauge — % การใช้งาน 7 วัน พร้อมเวลา reset',
      ],
      agentTitle: 'รายการ Agent',
      agentItems: [
        'Session จัดกลุ่มตามเวลาสร้าง, active ขึ้นก่อน',
        'ชื่อ model เต็ม (Opus 4.6, Sonnet 4.5, Haiku 4.5)',
        'Smart status แบบ real-time พร้อมไอคอนเคลื่อนไหว (Thinking, Reading, Writing, Executing, Spawning ฯลฯ)',
        'Token ที่ใช้ต่อ session',
        'ชื่อ project จาก working directory',
        'Team badge พร้อมจำนวนสมาชิก เมื่อมี team ทำงานอยู่',
        'Subagent dots พร้อมชื่อ model + ชื่อ agent',
        'จำนวน subagent active/ทั้งหมด ต่อ session',
      ],
      footerTitle: 'Footer',
      footerItems: [
        'จำนวน session active + จำนวน task active',
        'ค่าใช้จ่ายประมาณรายเดือน',
        'ปุ่มล้าง stopped agents (✕)',
      ],
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

      {/* Visual Mockup of Mini Mode */}
      <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 border-gray-500/20'} border`}>
        <h3 className={`text-base font-semibold ${colors.text.primary} mb-2`}>{lang === 'th' ? 'ตัวอย่างหน้าตา Mini Mode' : 'Mini Mode Preview'}</h3>
        <p className={`text-[11px] ${colors.text.muted} mb-3`}>{lang === 'th' ? 'หน้าต่าง popup จริงจะแสดงผลคล้ายกับนี้' : 'The actual popup window will look similar to this'}</p>

        {/* Mock Mini Window */}
        <div className={`rounded-lg overflow-hidden border ${colors.card.border} max-w-[260px] mx-auto shadow-lg`}>
          {/* Accent line */}
          <div className="h-0.5 bg-gradient-to-r from-[#d97757] via-[#e8956f] to-[#d97757]" />

          {/* Header */}
          <div className={`h-7 flex items-center justify-between px-1.5 border-b ${colors.card.border} ${theme === 'light' ? 'bg-white' : 'bg-gray-900/80'}`}>
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 -.01 39.5 39.53" xmlns="http://www.w3.org/2000/svg">
                <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="#d97757"/>
              </svg>
              <span className={`text-[10px] font-bold ${colors.text.primary}`}>Oh My Claude<span className="text-[#d97757]">!</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <svg className="w-2.5 h-2.5 text-sky-400" style={{ animation: 'spin 20s linear infinite' }} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              <div className={`px-1 h-4 flex items-center rounded text-[7px] font-semibold ${theme === 'light' ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/15 text-sky-400'}`}>
                ❄️ Chill
              </div>
            </div>
          </div>

          {/* Gauges */}
          <div className={`px-2 pt-1.5 pb-2 border-b ${colors.card.border} ${theme === 'light' ? 'bg-slate-50' : 'bg-gray-900/40'}`}>
            {/* Session gauge */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className={`text-[8px] ${colors.text.muted}`}>Session</span>
                  <span className={`text-[7px] ${colors.text.muted} opacity-60`}>Resets in 3h 12m</span>
                </div>
                <span className="text-[8px] font-mono font-bold text-green-500">24%</span>
              </div>
              <div className={`h-1 rounded-full ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'} overflow-hidden relative`}>
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full" />
                <div className={`absolute inset-0 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'} rounded-r-full`} style={{ left: '24%' }} />
              </div>
            </div>
            {/* Weekly gauge */}
            <div className="space-y-0.5 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className={`text-[8px] ${colors.text.muted}`}>Weekly</span>
                  <span className={`text-[7px] ${colors.text.muted} opacity-60`}>Resets in 2d 5h</span>
                </div>
                <span className="text-[8px] font-mono font-bold text-gray-400">41%</span>
              </div>
              <div className={`h-1 rounded-full ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'} overflow-hidden relative`}>
                <div className={`absolute inset-0 bg-gray-400 rounded-full`} />
                <div className={`absolute inset-0 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'} rounded-r-full`} style={{ left: '41%' }} />
              </div>
            </div>
          </div>

          {/* Agent List */}
          <div className={`${theme === 'light' ? 'bg-white' : 'bg-gray-950/50'}`}>
            {/* Agent 1 — Active Opus */}
            <div className={`border-b ${colors.card.border} bg-emerald-500/[0.03]`}>
              <div className="flex items-center gap-1 px-2 pt-1 pb-0.5">
                <span className="text-[10px] font-mono font-bold text-white shrink-0 w-[14px] text-right">1.</span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded text-violet-400 bg-violet-500/20 shrink-0">Opus 4.6</span>
                <span className="text-[11px] shrink-0 animate-pulse">🧠</span>
                <span className="text-[10px] font-medium text-violet-400">Thinking</span>
                <div className="flex-1" />
                <span className="text-[8px] font-mono tabular-nums text-amber-500">12.4k</span>
              </div>
              <div className="flex items-center gap-1 px-2 pb-0.5 pl-[28px]">
                <span className="text-[9px] font-mono tracking-widest uppercase text-cyan-400/70" style={{ fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.12em' }}>my-project</span>
                <span className="text-[7px] px-1 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">👥3</span>
                <div className="flex-1" />
                <span className={`text-[7px] ${colors.text.muted}`}>2/3</span>
              </div>
              {/* Subagents */}
              <div className="flex flex-wrap items-center gap-1 px-2 pb-1 pl-[42px]">
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[7px] font-bold text-sky-400">Sonnet 4.5</span>
                  <span className="text-[6px] text-cyan-400/80">researcher</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[7px] font-bold text-teal-400">Haiku 4.5</span>
                  <span className="text-[6px] text-cyan-400/80">test-runner</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  <span className="text-[7px] font-bold text-sky-400">Sonnet 4.5</span>
                </div>
              </div>
            </div>

            {/* Agent 2 — Stopped Sonnet */}
            <div className={`border-b ${colors.card.border} opacity-50`}>
              <div className="flex items-center gap-1 px-2 pt-1 pb-0.5">
                <span className="text-[10px] font-mono font-bold text-white shrink-0 w-[14px] text-right">2.</span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded text-sky-400 bg-sky-500/20 shrink-0">Sonnet 4.5</span>
                <span className="text-[10px] shrink-0 text-gray-500">○</span>
                <span className="text-[10px] text-gray-500">Stopped</span>
                <div className="flex-1" />
                <span className="text-[8px] font-mono tabular-nums text-amber-500">5.1k</span>
              </div>
              <div className="flex items-center gap-1 px-2 pb-1 pl-[28px]">
                <span className="text-[9px] font-mono tracking-widest uppercase text-cyan-400/70" style={{ fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.12em' }}>api-server</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`h-6 flex items-center justify-between px-2 border-t ${colors.card.border} ${theme === 'light' ? 'bg-slate-50' : 'bg-gray-900/80'}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] text-emerald-400">1 session · 2 tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono font-bold text-emerald-400">$12.50</span>
              <span className={`text-[7px] ${colors.text.muted} opacity-40`}>✕</span>
            </div>
          </div>
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
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className={`text-[11px] font-semibold ${colors.text.secondary} mb-1.5`}>{txt.headerTitle}</div>
            <div className="space-y-1">
              {txt.headerItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.card.bg}`}>
                  <span className="text-sky-400 text-[10px]">&#9679;</span>
                  <span className={`text-[11px] ${colors.text.muted}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Gauges */}
          <div>
            <div className={`text-[11px] font-semibold ${colors.text.secondary} mb-1.5`}>{txt.gaugeTitle}</div>
            <div className="space-y-1">
              {txt.gaugeItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.card.bg}`}>
                  <span className="text-emerald-400 text-[10px]">&#9679;</span>
                  <span className={`text-[11px] ${colors.text.muted}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Agent List */}
          <div>
            <div className={`text-[11px] font-semibold ${colors.text.secondary} mb-1.5`}>{txt.agentTitle}</div>
            <div className="space-y-1">
              {txt.agentItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.card.bg}`}>
                  <span className="text-violet-400 text-[10px]">&#9679;</span>
                  <span className={`text-[11px] ${colors.text.muted}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Footer */}
          <div>
            <div className={`text-[11px] font-semibold ${colors.text.secondary} mb-1.5`}>{txt.footerTitle}</div>
            <div className="space-y-1">
              {txt.footerItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.card.bg}`}>
                  <span className="text-amber-400 text-[10px]">&#9679;</span>
                  <span className={`text-[11px] ${colors.text.muted}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
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
      desc: lang === 'th' ? 'หลัง tool ทำงานเสร็จ - จับ output' : 'After tool completes - captures output',
      data: ['toolName', 'toolOutput', 'sessionId']
    },
    {
      icon: '❌',
      name: 'Tool Failed',
      color: 'text-red-400',
      hook: 'PostToolUseFailure',
      desc: lang === 'th' ? 'เมื่อ tool ทำงานล้มเหลว - จับ error message' : 'When tool fails - captures error message',
      data: ['toolName', 'error', 'sessionId']
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
      desc: lang === 'th' ? 'เมื่อ subagent จบงาน - จับ tokens ที่ใช้' : 'When subagent finishes - captures token usage',
      data: ['agentId', 'inputTokens', 'outputTokens']
    },
    {
      icon: '📦',
      name: 'PreCompact',
      color: 'text-slate-400',
      hook: 'PreCompact',
      desc: lang === 'th' ? 'ก่อน context compaction - บันทึก conversation ก่อนถูกย่อ' : 'Before context compaction - saves conversation before trimming',
      data: ['sessionId', 'timestamp']
    },
    {
      icon: '⏳',
      name: 'PermissionRequest',
      color: 'text-orange-400',
      hook: 'PermissionRequest',
      desc: lang === 'th' ? 'เมื่อ Claude ขอ permission จาก user' : 'When Claude requests user permission for an action',
      data: ['toolName', 'sessionId', 'timestamp']
    },
    {
      icon: '🚀',
      name: 'SessionStart',
      color: 'text-green-400',
      hook: 'SessionStart',
      desc: lang === 'th' ? 'เมื่อเริ่ม session ใหม่' : 'When a new session starts',
      data: ['sessionId', 'cwd', 'timestamp']
    },
    {
      icon: '🛑',
      name: 'Stop',
      color: 'text-red-400',
      hook: 'Stop',
      desc: lang === 'th' ? 'เมื่อ Claude หยุดตอบ - จับ session ID และเหตุผล' : 'When Claude stops responding - captures session ID and reason',
      data: ['sessionId', 'stopReason', 'timestamp']
    },
    {
      icon: '🔚',
      name: 'SessionEnd',
      color: 'text-gray-400',
      hook: 'SessionEnd',
      desc: lang === 'th' ? 'เมื่อ session จบลง' : 'When a session ends',
      data: ['sessionId', 'timestamp']
    },
  ];

  const hookList = [
    { hook: 'PreToolUse', desc: lang === 'th' ? 'ก่อน tool ทำงาน' : 'Before tool runs' },
    { hook: 'PostToolUse', desc: lang === 'th' ? 'หลัง tool เสร็จ' : 'After tool completes' },
    { hook: 'SubagentStart', desc: lang === 'th' ? 'Subagent ถูกสร้าง' : 'Subagent spawned' },
    { hook: 'SubagentStop', desc: lang === 'th' ? 'Subagent จบงาน' : 'Subagent finished' },
    { hook: 'UserPromptSubmit', desc: lang === 'th' ? 'User ส่งข้อความ' : 'User sends message' },
    { hook: 'PermissionRequest', desc: lang === 'th' ? 'ขอ permission จาก user' : 'Permission requested' },
    { hook: 'Stop', desc: lang === 'th' ? 'Claude หยุดตอบ' : 'Claude stops' },
    { hook: 'PreCompact', desc: lang === 'th' ? 'ก่อน compact context' : 'Before context compaction' },
    { hook: 'SessionStart', desc: lang === 'th' ? 'เริ่ม session ใหม่' : 'Session starts' },
    { hook: 'SessionEnd', desc: lang === 'th' ? 'จบ session' : 'Session ends' },
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

// Demo Mode Section
function DemoSection({ lang, theme = 'dark' }) {
  const colors = getThemeColors(theme);
  const t = {
    en: {
      heroTitle: 'Demo Mode',
      heroDesc: 'Experience the full dashboard without a live Claude Code session. Demo Mode replays real captured events with simulated data — perfect for showcasing, learning, or testing.',
      enableTitle: 'How to Enable',
      enableSteps: [
        { step: '1', text: 'Open the Dashboard Guide (? button in toolbar)' },
        { step: '2', text: 'Click the 🧪 Demo button in the guide header' },
        { step: '3', text: 'The header changes from LIVE to DEMO with amber glow' },
      ],
      enableNote: 'Demo mode can be toggled on/off anytime. All live data is preserved.',
      controlsTitle: 'Playback Controls',
      controlsDesc: 'A retro-styled tape counter and control buttons appear next to the DEMO badge:',
      counterLabel: 'Event Counter',
      counterDesc: 'Digital LED counter showing current event number out of 1,006 total events. Digits spin up with animation as events play.',
      playLabel: 'Play / Pause',
      playDesc: 'Start replaying events. While playing, click again to pause — the counter freezes and state is preserved. Click Resume to continue from where you left off.',
      resetLabel: 'Reset',
      resetDesc: 'Stop playback and clear all state. Counter returns to 0000, all panels reset to empty.',
      statesTitle: 'Playback States',
      statesItems: [
        { state: 'Idle', icon: '⏹', color: 'gray', desc: 'Initial state — counter shows 0000, dashboard empty' },
        { state: 'Playing', icon: '▶', color: 'green', desc: 'Events replay at variable speed based on event type' },
        { state: 'Paused', icon: '⏸', color: 'amber', desc: 'Frozen in place — all data visible, counter stopped' },
        { state: 'Finished', icon: '✓', color: 'emerald', desc: 'All 1,006 events played — dashboard shows final state' },
      ],
      panelsTitle: 'What Gets Simulated',
      panelsDesc: 'Demo mode populates every panel with realistic data:',
      panelItems: [
        { icon: '🎯', name: 'Token Usage', desc: 'Session 30%, Weekly 17%, with countdown timers. Last 12 Hours chart shows mixed Opus/Sonnet/Haiku bars.' },
        { icon: '🤖', name: 'Agents Panel', desc: 'Main sessions spawn, subagents appear with real tool activity. Team "audit-crew" forms with 3 members working in parallel.' },
        { icon: '👥', name: 'Team Agents', desc: 'code-reviewer, worker, and reviewer-2 — each with independent token growth, cycling tool tasks, and health indicators.' },
        { icon: '📨', name: 'Team Comms', desc: '8 inter-agent messages flow between team lead, code-reviewer, and worker during the replay.' },
        { icon: '📡', name: 'Activity Feed', desc: 'Events stream in real-time: Read, Write, Edit, Bash, Grep, Glob, TodoWrite, and more — with tool inputs.' },
        { icon: '📋', name: 'Event Details', desc: 'Click any event to see Input/Output in the footer detail panel. PostToolUse events show generated tool responses.' },
        { icon: '📈', name: 'Footer Stats', desc: 'Fixed event counts (1,000 total), monthly cost ($7,867), and per-model breakdown.' },
        { icon: '🚦', name: 'Status Badge', desc: 'Header shows 🪴 Normal status with session percentage.' },
      ],
      speedTitle: 'Event Timing',
      speedDesc: 'Different event types play at different speeds for a natural feel:',
      speedItems: [
        { type: 'UserPromptSubmit', speed: '600ms', desc: 'User messages — longest pause' },
        { type: 'SubagentStart/Stop', speed: '400ms', desc: 'Agent lifecycle events' },
        { type: 'SendMessage/TeamCreate', speed: '250ms', desc: 'Team operations' },
        { type: 'PreToolUse/PostToolUse', speed: '80ms', desc: 'Tool calls — fastest' },
      ],
      dataTitle: 'Demo Data Source',
      dataDesc: 'Events are captured from a real Claude Code session working on the CatStay Platform project — a multi-package NestJS + React app with tenant management, staff roles, and LINE LIFF integration.',
      dataStats: [
        { label: 'Total Events', value: '1,006' },
        { label: 'Sessions', value: '2' },
        { label: 'Team Members', value: '3' },
        { label: 'Tool Types', value: '12+' },
      ],
      tipsTitle: 'Tips',
      tips: [
        'Pause anytime to explore the current state — click events, check team health, browse agents',
        'The replay counter keeps its position when paused — Resume continues exactly where you stopped',
        'Token Usage panel shows fixed demo data immediately, even before pressing Play',
        'Reset clears everything — useful for restarting the demo for a fresh audience',
      ],
    },
    th: {
      heroTitle: 'Demo Mode',
      heroDesc: 'สัมผัส dashboard เต็มรูปแบบโดยไม่ต้องมี Claude Code session จริง Demo Mode เล่นซ้ำ events จริงที่บันทึกไว้พร้อมข้อมูลจำลอง — เหมาะสำหรับ showcase, เรียนรู้, หรือทดสอบ',
      enableTitle: 'วิธีเปิดใช้งาน',
      enableSteps: [
        { step: '1', text: 'เปิด Dashboard Guide (ปุ่ม ? ใน toolbar)' },
        { step: '2', text: 'คลิกปุ่ม 🧪 Demo ที่ header ของ guide' },
        { step: '3', text: 'Header เปลี่ยนจาก LIVE เป็น DEMO พร้อมแสงสีส้ม' },
      ],
      enableNote: 'เปิด/ปิด Demo mode ได้ตลอด ข้อมูล live จะยังคงอยู่',
      controlsTitle: 'ปุ่มควบคุมการเล่น',
      controlsDesc: 'ตัวนับสไตล์ retro และปุ่มควบคุมจะปรากฏข้าง DEMO badge:',
      counterLabel: 'ตัวนับ Event',
      counterDesc: 'ตัวนับ LED แบบ digital แสดงหมายเลข event ปัจจุบันจากทั้งหมด 1,006 events ตัวเลขหมุนขึ้นพร้อม animation',
      playLabel: 'Play / Pause',
      playDesc: 'เริ่มเล่น events ขณะเล่นคลิกอีกครั้งเพื่อหยุดชั่วคราว — ตัวนับหยุดและข้อมูลคงอยู่ คลิก Resume เพื่อเล่นต่อ',
      resetLabel: 'Reset',
      resetDesc: 'หยุดการเล่นและล้างข้อมูลทั้งหมด ตัวนับกลับเป็น 0000 ทุก panel รีเซ็ต',
      statesTitle: 'สถานะการเล่น',
      statesItems: [
        { state: 'Idle', icon: '⏹', color: 'gray', desc: 'สถานะเริ่มต้น — ตัวนับ 0000, dashboard ว่าง' },
        { state: 'Playing', icon: '▶', color: 'green', desc: 'เล่น events ด้วยความเร็วต่างกันตามประเภท' },
        { state: 'Paused', icon: '⏸', color: 'amber', desc: 'หยุดชั่วคราว — ข้อมูลยังแสดง ตัวนับหยุด' },
        { state: 'Finished', icon: '✓', color: 'emerald', desc: 'เล่นครบ 1,006 events — dashboard แสดงสถานะสุดท้าย' },
      ],
      panelsTitle: 'สิ่งที่จำลอง',
      panelsDesc: 'Demo mode เติมข้อมูลทุก panel ด้วยข้อมูลสมจริง:',
      panelItems: [
        { icon: '🎯', name: 'Token Usage', desc: 'Session 30%, Weekly 17% พร้อมนับถอยหลัง กราฟ Last 12 Hours แสดงแท่ง Opus/Sonnet/Haiku ผสม' },
        { icon: '🤖', name: 'Agents Panel', desc: 'Main session spawn, subagents ปรากฏพร้อม tool activity จริง ทีม "audit-crew" ก่อตัวพร้อมสมาชิก 3 คนทำงานพร้อมกัน' },
        { icon: '👥', name: 'Team Agents', desc: 'code-reviewer, worker, reviewer-2 — แต่ละตัว token เพิ่มอิสระ, สลับ tool tasks, แสดง health indicators' },
        { icon: '📨', name: 'Team Comms', desc: '8 ข้อความระหว่าง agent ไหลระหว่าง team lead, code-reviewer, และ worker ระหว่างเล่น' },
        { icon: '📡', name: 'Activity Feed', desc: 'Events stream real-time: Read, Write, Edit, Bash, Grep, Glob, TodoWrite ฯลฯ — พร้อม tool inputs' },
        { icon: '📋', name: 'Event Details', desc: 'คลิก event เพื่อดู Input/Output ใน footer PostToolUse events แสดง tool response ที่สร้างขึ้น' },
        { icon: '📈', name: 'Footer Stats', desc: 'จำนวน event คงที่ (1,000), ค่าเดือน ($7,867), แยกตาม model' },
        { icon: '🚦', name: 'Status Badge', desc: 'Header แสดง 🪴 Normal พร้อมเปอร์เซ็นต์ session' },
      ],
      speedTitle: 'ความเร็ว Event',
      speedDesc: 'Event แต่ละประเภทเล่นด้วยความเร็วต่างกันเพื่อให้ดูเป็นธรรมชาติ:',
      speedItems: [
        { type: 'UserPromptSubmit', speed: '600ms', desc: 'ข้อความจาก user — หยุดนานสุด' },
        { type: 'SubagentStart/Stop', speed: '400ms', desc: 'Agent lifecycle events' },
        { type: 'SendMessage/TeamCreate', speed: '250ms', desc: 'Team operations' },
        { type: 'PreToolUse/PostToolUse', speed: '80ms', desc: 'Tool calls — เร็วสุด' },
      ],
      dataTitle: 'แหล่งข้อมูล Demo',
      dataDesc: 'Events ถูกบันทึกจาก Claude Code session จริงที่ทำงานบน CatStay Platform — แอป multi-package NestJS + React พร้อม tenant management, staff roles, และ LINE LIFF integration',
      dataStats: [
        { label: 'Events ทั้งหมด', value: '1,006' },
        { label: 'Sessions', value: '2' },
        { label: 'สมาชิกทีม', value: '3' },
        { label: 'ประเภท Tool', value: '12+' },
      ],
      tipsTitle: 'เคล็ดลับ',
      tips: [
        'Pause ได้ตลอดเพื่อสำรวจสถานะ — คลิก events, ดู team health, ดู agents',
        'ตัวนับจำตำแหน่งเมื่อ Pause — Resume เล่นต่อจากจุดเดิม',
        'Token Usage panel แสดงข้อมูล demo ทันทีแม้ยังไม่กด Play',
        'Reset ล้างทุกอย่าง — เหมาะสำหรับเริ่ม demo ใหม่',
      ],
    },
  };
  const txt = t[lang] || t.en;

  const stateColors = { gray: 'from-gray-500/20', green: 'from-green-500/20', amber: 'from-amber-500/20', emerald: 'from-emerald-500/20' };
  const stateTextColors = { gray: 'text-gray-400', green: 'text-green-400', amber: 'text-amber-400', emerald: 'text-emerald-400' };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className={`p-5 rounded-xl border ${theme === 'light' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${theme === 'light' ? 'bg-amber-100' : 'bg-amber-500/20'}`}>
            <span className="text-2xl">🧪</span>
          </div>
          <div>
            <h3 className={`text-base font-bold ${colors.text.primary} mb-1`}>{txt.heroTitle}</h3>
            <p className={`text-[12px] ${colors.text.muted} leading-relaxed`}>{txt.heroDesc}</p>
          </div>
        </div>
      </div>

      {/* How to Enable */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.enableTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <div className="space-y-2.5">
            {txt.enableSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}`}>
                  {s.step}
                </div>
                <span className={`text-[12px] ${colors.text.secondary}`}>{s.text}</span>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-[10px] ${colors.text.faint} flex items-center gap-1.5`}>
            <span>💡</span> {txt.enableNote}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.controlsTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.controlsDesc}</p>

        {/* Visual mockup of controls */}
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border} mb-4`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-px">
              {/* Mini counter mockup */}
              <div className="flex items-center rounded-sm overflow-hidden" style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #0a0a0a 60%, #1a1a1a 100%)',
                border: '1px solid #555',
                height: '24px',
              }}>
                {['0', '1', '2', '7'].map((d, i) => (
                  <span key={i} className="inline-flex items-center justify-center" style={{
                    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                    fontSize: '15px', width: '15px', height: '24px', lineHeight: '24px',
                    color: '#c8f0c8', textShadow: '0 0 4px rgba(100,255,100,0.4)',
                    borderLeft: i > 0 ? '1px solid #555' : 'none',
                  }}>{d}</span>
                ))}
              </div>
              {/* Play button mockup */}
              <div className="w-6 h-6 ml-1 rounded border border-green-500/50 bg-green-500/10 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-400" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12" /></svg>
              </div>
              {/* Reset button mockup */}
              <div className="w-6 h-6 ml-0.5 rounded border border-red-500/50 bg-red-500/10 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-400" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="1" /></svg>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: txt.counterLabel, desc: txt.counterDesc, icon: '🔢', color: 'emerald' },
              { label: txt.playLabel, desc: txt.playDesc, icon: '▶', color: 'green' },
              { label: txt.resetLabel, desc: txt.resetDesc, icon: '■', color: 'red' },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${colors.card.bgAlt}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] bg-${item.color}-500/15 text-${item.color}-400`}>
                  {item.icon}
                </div>
                <div>
                  <div className={`text-[12px] font-medium ${colors.text.secondary}`}>{item.label}</div>
                  <div className={`text-[10px] ${colors.text.dimmed} mt-0.5 leading-relaxed`}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Playback States */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.statesTitle}</h4>
        <div className="grid grid-cols-2 gap-2">
          {txt.statesItems.map((item, i) => (
            <div key={i} className={`p-3 rounded-xl border ${colors.card.border} bg-gradient-to-r ${stateColors[item.color]} to-transparent`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm ${stateTextColors[item.color]}`}>{item.icon}</span>
                <span className={`text-[12px] font-semibold ${stateTextColors[item.color]}`}>{item.state}</span>
              </div>
              <p className={`text-[10px] ${colors.text.dimmed} leading-relaxed`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What Gets Simulated */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.panelsTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.panelsDesc}</p>
        <div className="grid grid-cols-2 gap-2">
          {txt.panelItems.map((item, i) => (
            <div key={i} className={`p-3 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm">{item.icon}</span>
                <span className={`text-[11px] font-semibold ${colors.text.secondary}`}>{item.name}</span>
              </div>
              <p className={`text-[10px] ${colors.text.dimmed} leading-relaxed`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Event Timing */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.speedTitle}</h4>
        <p className={`text-[11px] ${colors.text.dimmed} mb-3`}>{txt.speedDesc}</p>
        <div className={`rounded-xl overflow-hidden border ${colors.card.border}`}>
          {txt.speedItems.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? `border-t ${colors.card.border}` : ''} ${colors.card.bg}`}>
              <code className={`text-[10px] ${theme === 'light' ? 'text-violet-600 bg-violet-50' : 'text-violet-300 bg-violet-500/10'} px-1.5 py-0.5 rounded font-mono min-w-[140px]`}>
                {item.type}
              </code>
              <span className={`text-[11px] font-mono font-bold ${colors.text.secondary} min-w-[50px]`}>{item.speed}</span>
              <span className={`text-[10px] ${colors.text.dimmed}`}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Data Source */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.dataTitle}</h4>
        <div className={`p-4 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
          <p className={`text-[11px] ${colors.text.dimmed} leading-relaxed mb-3`}>{txt.dataDesc}</p>
          <div className="grid grid-cols-4 gap-2">
            {txt.dataStats.map((stat, i) => (
              <div key={i} className={`text-center p-2.5 rounded-lg ${colors.card.bgAlt}`}>
                <div className={`text-lg font-bold ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>{stat.value}</div>
                <div className={`text-[9px] ${colors.text.faint} mt-0.5`}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h4 className={`text-[13px] font-semibold ${colors.text.tertiary} uppercase tracking-wider mb-3`}>{txt.tipsTitle}</h4>
        <div className="space-y-2">
          {txt.tips.map((tip, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl ${colors.card.bg} border ${colors.card.border}`}>
              <span className={`text-[11px] ${theme === 'light' ? 'text-amber-500' : 'text-amber-400'} mt-px`}>✦</span>
              <span className={`text-[11px] ${colors.text.muted} leading-relaxed`}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HelpGuide;
