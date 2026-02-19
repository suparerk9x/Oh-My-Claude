# Oh My Claude - Code Audit Report

**Date:** 2026-02-20
**Audited by:** Claude Opus 4.6 (5 parallel agents)
**Scope:** Full codebase review - backend, frontend, extension, utilities, HelpGuide

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 10 | Security issues, runtime bugs, incorrect documentation |
| HIGH | 13 | Logic errors, missing error handling, data inconsistencies |
| MEDIUM | 16 | DRY violations, performance, UX inconsistencies |
| LOW | 14 | Dead code, minor improvements |

---

## CRITICAL Issues

### Backend Security

| # | Issue | File | Detail |
|---|-------|------|--------|
| 1 | CORS allows all origins | server.js:101-113 | else branch allows all origins |
| 2 | Command injection risk | server.js:944 | diffBase interpolated into shell without validation |
| 3 | No auth on DELETE | server.js:1215-1233 | DELETE endpoints have no authentication |

### Frontend Bugs

| # | Issue | File | Detail |
|---|-------|------|--------|
| 4 | Stale closure WebSocket | App.jsx:187 | checkAgentChanges stale in onmessage handler |
| 5 | smartStatus not memoized | App.jsx:239-324 | New object every render, useEffect fires constantly |
| 6 | GaugeBar inside component | MiniApp.jsx:250 | Causes unmount/remount every render |

### HelpGuide - Agent Timeouts All Wrong

| Status | Guide Says | Actual Code |
|--------|-----------|-------------|
| Idle | 5 min | 3 min |
| Stale | 10 min | 8 min |
| Timeout | 30 min | 20 min |
| Removed | 60 min | 30 min |

---

## HIGH Issues

### Backend

| # | Issue | File | Detail |
|---|-------|------|--------|
| 11 | Sync I/O in async | server.js:870 | readdirSync/statSync blocks event loop |
| 12 | Missing dir check | server.js:870 | Crashes if projects dir missing |
| 13 | WS init no catch | server.js:129-140 | Async IIFE no error handling |
| 14 | smartStatusMap leak | server.js:164 | Never cleared on DELETE |

### Frontend

| # | Issue | File | Detail |
|---|-------|------|--------|
| 15 | View mode not persisted | App.jsx:69-90 | Hidden mode lost on refresh |
| 16 | MiniApp empty on load | MiniApp.jsx:87 | No smartStatus until first event |
| 17 | stoppedTaskCount wrong | AgentTree.jsx:68 | Counts idle/stale as stopped |
| 18 | Activity counts wrong | App.jsx:591-605 | Header ignores session filter |

### HelpGuide

| # | Issue | Detail |
|---|-------|--------|
| 19 | Mini window size | 220x450 should be 280x400 |
| 20 | PostToolUse false field | success field does not exist |
| 21 | Tool Failed type | Should be PostToolUseFailure |
| 22 | SubagentStop fields | tokens/duration/toolsUsed are server-derived |

---

## MEDIUM Issues

| # | Issue | File |
|---|-------|------|
| 24 | Usage emoji duplicated 4x | App.jsx + MiniApp.jsx |
| 25 | STATUS_PRIORITY per render | App.jsx, MiniApp.jsx |
| 26 | Clock re-renders everything | App.jsx:198-204 |
| 27 | MiniApp no clear handler | MiniApp.jsx |
| 28 | smartStatus accumulates | MiniApp.jsx:101-127 |
| 29 | Sort logic differs | AgentTree vs MiniApp |
| 30 | formatTokens 999999 bug | format.js |
| 31 | cycleMode race condition | useNotifications.js |
| 32 | Stale TTL comment | server.js:927 (says 12s, is 5s) |
| 33 | Test mock shape wrong | api.test.js |
| 34 | Guide version v2.0 | package.json is 1.0.0 |
| 35-39 | Guide missing events | PermissionRequest, SessionStart, etc. |

---

## LOW Issues

| # | Issue | File |
|---|-------|------|
| 40 | sonnetWeeklyPct unused | App.jsx:291 |
| 41 | isFirst prop unused | ActivityItem.jsx |
| 42 | Unused imports | App.jsx:4-5 |
| 43 | React import unnecessary | main.jsx, mini-main.jsx |
| 44-53 | Various minor issues | See full report |

---

## Fixes Applied (2026-02-20)

### Round 1 - CRITICAL fixes
1. App.jsx: Stale closure fixed with checkAgentChangesRef
2. App.jsx: smartStatus wrapped in useMemo
3. App.jsx + MiniApp.jsx: STATUS_PRIORITY moved to module level
4. MiniApp.jsx: GaugeBar extracted outside component
5. HelpGuide.jsx: Agent timeouts corrected (EN + TH)
6. HelpGuide.jsx: Mini size 220x450 -> 280x400
7. HelpGuide.jsx: PostToolUse removed false success field
8. HelpGuide.jsx: Tool Failed -> PostToolUseFailure
9. HelpGuide.jsx: SubagentStop fields corrected
10. HelpGuide.jsx: Added agents.json to file structure
11. HelpGuide.jsx: Stop event added stopReason
12. HelpGuide.jsx: PreCompact removed false trigger field

### Round 2 - HIGH/MEDIUM/LOW safe fixes
13. server.js: smartStatusMap cleared on DELETE endpoints (#14)
14. AgentTree.jsx: stoppedTaskCount only counts stopped/timeout (#17)
15. App.jsx: Activity counts respect session filter (#18)
16. format.js: getUsageBadge() shared across App + MiniApp (#24)
17. App.jsx: LiveClock extracted, no full re-render every second (#26)
18. MiniApp.jsx: Added clear agents button (#27)
19. AgentTree.jsx: Session numbering sort aligned with MiniApp (#29)
20. format.js: formatTokens 999950+ correctly shows M (#30)
21. server.js: TTL comment corrected 12s -> 5s (#32)
22. package.json: Master version set to v2.2.0 (#34)
23. HelpGuide.jsx: Added PermissionRequest, SessionStart, SessionEnd (#35-39)
24. App.jsx: Removed unused sonnetWeeklyPct (#40)
25. ActivityItem.jsx: Removed unused isFirst prop (#41)
26. App.jsx: Removed unused AgentCard, formatTime imports (#42)
27. main.jsx + mini-main.jsx: Removed unnecessary React import (#43)

### Round 3 - Remaining safe fixes
28. server.js: Added existsSync check before readdirSync in readSessionTokens (#12)
29. server.js: Added .catch() to WebSocket init async IIFE (#13)
30. useNotifications.js: cycleMode uses functional update to prevent stale closure (#31)
31. api.test.js: Mock /stats response shape matches actual API (#33)

### Round 4 - Behavior-affecting fixes
32. server.js: readSessionTokens uses async fs.promises instead of sync I/O (#11)
33. App.jsx: isAgentsCollapsed persisted in localStorage (#15)
34. server.js: Rebuild smartStatusMap from loaded events on startup (#16)
35. server.js: checkAgentTimeouts syncs smartStatus when agent goes inactive, cleans up on removal (#28)

### Won't Fix

| # | Issue | Reason |
|---|-------|--------|
| 1 | CORS allows all origins | Localhost single-user only. Worst case: external site clears monitoring data. No system access risk. Revisit if exposed to network. |
| 2 | Command injection in diffBase | **False positive.** `diffBase` comes from `git rev-parse HEAD` output (40-char SHA) generated by the server itself, never from external input. |
| 3 | No auth on DELETE | Localhost single-user only. DELETE only clears in-memory monitoring data and Oh-My-Claude's own files (events.json, agents.json). No system impact. |
| 23 | PWA name `<` | Intentional design choice. |
