import { useState, useRef, useCallback } from 'react';

// Notification modes: off → bell → off
const MODES = ['off', 'bell'];

// Shared AudioContext - reused across calls, resumed on user gesture
let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function useNotifications() {
  const [mode, setMode] = useState(() => localStorage.getItem('notifMode') || 'off');
  const prevAgentsRef = useRef(new Map());
  const userInteractedRef = useRef(false);

  // Play bell sound using Web Audio API
  const playBell = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  }, []);

  // Cycle through modes (user click unlocks AudioContext)
  const cycleMode = useCallback(() => {
    userInteractedRef.current = true;
    try { getAudioContext(); } catch {}

    setMode(prev => {
      const idx = MODES.indexOf(prev);
      const next = MODES[(idx + 1) % MODES.length];
      localStorage.setItem('notifMode', next);
      if (next === 'bell') {
        setTimeout(() => playBell(), 50);
      }
      return next;
    });
  }, [playBell]);

  // Check for agent status changes
  const checkAgentChanges = useCallback((agents) => {
    if (mode === 'off' || !userInteractedRef.current) {
      const newMap = new Map();
      agents.forEach(a => newMap.set(a.id, a.status));
      prevAgentsRef.current = newMap;
      return;
    }

    const prev = prevAgentsRef.current;
    const completedAgents = [];

    agents.forEach(agent => {
      const prevStatus = prev.get(agent.id);
      if (prevStatus && ['active', 'idle', 'stale'].includes(prevStatus) && agent.status === 'stopped') {
        completedAgents.push(agent);
      }
    });

    const newMap = new Map();
    agents.forEach(a => newMap.set(a.id, a.status));
    prevAgentsRef.current = newMap;

    if (completedAgents.length > 0 && mode === 'bell') {
      playBell();
    }
  }, [mode, playBell]);

  const getModeInfo = () => {
    switch (mode) {
      case 'bell': return { icon: '🔔', label: 'Bell' };
      default: return { icon: '🔕', label: 'Off' };
    }
  };

  return { mode, cycleMode, checkAgentChanges, getModeInfo };
}
