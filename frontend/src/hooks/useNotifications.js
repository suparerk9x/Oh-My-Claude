import { useState, useRef, useCallback } from 'react';

// Notification modes: off → bell → voice → off
const MODES = ['off', 'bell', 'voice'];

export function useNotifications() {
  const [mode, setMode] = useState(() => localStorage.getItem('notifMode') || 'off');
  const prevAgentsRef = useRef(new Map()); // id -> status

  // Play bell sound using Web Audio API (no sound file needed)
  const playBell = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

  // Speak agent name using SpeechSynthesis
  const speak = useCallback((text) => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1;
        utterance.volume = 0.7;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Speech not available
    }
  }, []);

  // Cycle through modes (with preview sound)
  const cycleMode = useCallback(() => {
    const idx = MODES.indexOf(mode);
    const next = MODES[(idx + 1) % MODES.length];
    setMode(next);
    localStorage.setItem('notifMode', next);
    // Preview sound on mode switch
    if (next === 'bell') {
      setTimeout(() => playBell(), 50);
    } else if (next === 'voice') {
      setTimeout(() => speak('Voice notifications on'), 50);
    }
  }, [mode, playBell, speak]);

  // Check for agent status changes - call this with current agents array
  const checkAgentChanges = useCallback((agents) => {
    if (mode === 'off') {
      // Still update refs for tracking
      const newMap = new Map();
      agents.forEach(a => newMap.set(a.id, a.status));
      prevAgentsRef.current = newMap;
      return;
    }

    const prev = prevAgentsRef.current;
    const completedAgents = [];

    agents.forEach(agent => {
      const prevStatus = prev.get(agent.id);
      // Detect: was active/idle/stale → now stopped (task completed)
      if (prevStatus && ['active', 'idle', 'stale'].includes(prevStatus) && agent.status === 'stopped') {
        completedAgents.push(agent);
      }
    });

    // Update tracking map
    const newMap = new Map();
    agents.forEach(a => newMap.set(a.id, a.status));
    prevAgentsRef.current = newMap;

    // Notify for completed agents
    if (completedAgents.length > 0) {
      if (mode === 'bell') {
        playBell();
      } else if (mode === 'voice') {
        const names = completedAgents
          .map(a => a.type === 'main' ? 'main session' : (a.type || 'agent'))
          .join(' and ');
        speak(`${names} completed`);
      }
    }
  }, [mode, playBell, speak]);

  // Mode display info
  const getModeInfo = () => {
    switch (mode) {
      case 'bell': return { icon: '🔔', label: 'Bell' };
      case 'voice': return { icon: '🔊', label: 'Voice' };
      default: return { icon: '🔕', label: 'Off' };
    }
  };

  return { mode, cycleMode, checkAgentChanges, getModeInfo };
}
