import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentCard } from './AgentCard';

describe('AgentCard', () => {
  const defaultColors = {
    text: { primary: 'text-gray-100', secondary: 'text-gray-300', muted: 'text-gray-400' },
    bg: { secondary: 'bg-[#1a1a24]', tertiary: 'bg-[#12121a]' },
    border: 'border-[#1a1a24]'
  };

  const createAgent = (overrides = {}) => ({
    id: 'agent-1',
    type: 'main',
    status: 'active',
    model: 'claude-sonnet-4-5-20250929',
    tokens: 1500,
    inputTokens: 1000,
    outputTokens: 500,
    ...overrides
  });

  describe('Basic rendering', () => {
    it('renders agent type name', () => {
      render(<AgentCard agent={createAgent()} colors={defaultColors} />);
      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('shows active status for running agent', () => {
      render(<AgentCard agent={createAgent({ status: 'active' })} colors={defaultColors} />);
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('shows stopped status for inactive agent', () => {
      render(<AgentCard agent={createAgent({ status: 'stopped' })} colors={defaultColors} />);
      expect(screen.getByText('stopped')).toBeInTheDocument();
    });
  });

  describe('Model badges', () => {
    it('displays Opus badge for opus model', () => {
      render(<AgentCard agent={createAgent({ model: 'claude-opus-4-5-20251101' })} colors={defaultColors} />);
      expect(screen.getByText(/Opus/)).toBeInTheDocument();
    });

    it('displays Sonnet badge for sonnet model', () => {
      render(<AgentCard agent={createAgent({ model: 'claude-sonnet-4-5-20250929' })} colors={defaultColors} />);
      expect(screen.getByText(/Sonnet/)).toBeInTheDocument();
    });

    it('displays Haiku badge for haiku model', () => {
      render(<AgentCard agent={createAgent({ model: 'claude-haiku-4-5-20251001' })} colors={defaultColors} />);
      expect(screen.getByText(/Haiku/)).toBeInTheDocument();
    });

    it('displays Unknown for unrecognized model', () => {
      render(<AgentCard agent={createAgent({ model: 'gpt-4' })} colors={defaultColors} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Token display', () => {
    it('formats tokens with K suffix for thousands', () => {
      render(<AgentCard agent={createAgent({ tokens: 1500 })} colors={defaultColors} />);
      expect(screen.getByText('1.5k')).toBeInTheDocument();
    });

    it('calculates tokens from input + output if tokens not provided', () => {
      render(
        <AgentCard
          agent={createAgent({ tokens: undefined, inputTokens: 1000, outputTokens: 500 })}
          colors={defaultColors}
        />
      );
      expect(screen.getByText('1.5k')).toBeInTheDocument();
    });

    it('does not show token count when zero', () => {
      render(
        <AgentCard
          agent={createAgent({ tokens: 0, inputTokens: 0, outputTokens: 0 })}
          colors={defaultColors}
        />
      );
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('Agent type names', () => {
    it('formats hyphenated type names', () => {
      render(<AgentCard agent={createAgent({ type: 'code-reviewer' })} colors={defaultColors} />);
      expect(screen.getByText('Code Reviewer')).toBeInTheDocument();
    });

    it('handles null type as Main', () => {
      render(<AgentCard agent={createAgent({ type: null })} colors={defaultColors} />);
      expect(screen.getByText('Main')).toBeInTheDocument();
    });
  });

  describe('Time display', () => {
    it('shows elapsed time for active agent', () => {
      render(
        <AgentCard
          agent={createAgent({ status: 'active', elapsedFormatted: '5m 30s' })}
          colors={defaultColors}
        />
      );
      expect(screen.getByText('5m 30s')).toBeInTheDocument();
    });

    it('shows duration for stopped agent', () => {
      render(
        <AgentCard
          agent={createAgent({ status: 'stopped', durationFormatted: '10m' })}
          colors={defaultColors}
        />
      );
      expect(screen.getByText('10m')).toBeInTheDocument();
    });
  });

  describe('Compact view mode', () => {
    it('renders compact layout', () => {
      const { container } = render(
        <AgentCard agent={createAgent()} colors={defaultColors} viewMode="compact" />
      );
      // Compact mode uses px-2 py-1.5 instead of p-2.5
      expect(container.querySelector('.px-2')).toBeInTheDocument();
    });

    it('shows tools count in compact mode', () => {
      render(
        <AgentCard
          agent={createAgent({ toolsUsed: ['Read', 'Write', 'Bash'] })}
          colors={defaultColors}
          viewMode="compact"
        />
      );
      expect(screen.getByText('3 tools')).toBeInTheDocument();
    });
  });

  describe('Full view mode', () => {
    it('displays task description if provided', () => {
      render(
        <AgentCard
          agent={createAgent({ lastTask: 'Reviewing code changes' })}
          colors={defaultColors}
          viewMode="full"
        />
      );
      expect(screen.getByText('Reviewing code changes')).toBeInTheDocument();
    });

    it('hides task description if it is Main Session', () => {
      render(
        <AgentCard
          agent={createAgent({ lastTask: 'Main Session' })}
          colors={defaultColors}
          viewMode="full"
        />
      );
      expect(screen.queryByText('Main Session')).not.toBeInTheDocument();
    });

    it('shows tool badges with truncation', () => {
      render(
        <AgentCard
          agent={createAgent({ toolsUsed: ['Read', 'Write', 'Bash', 'Grep', 'Glob'] })}
          colors={defaultColors}
          viewMode="full"
        />
      );
      // Should show first 3 tools and +2 indicator
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('renders without optional colors', () => {
      render(<AgentCard agent={createAgent()} />);
      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('handles running status same as active', () => {
      render(<AgentCard agent={createAgent({ status: 'running' })} colors={defaultColors} />);
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('handles agent with id main as main type', () => {
      render(<AgentCard agent={createAgent({ id: 'main', type: 'custom' })} colors={defaultColors} />);
      // The main text color should be applied
      const typeElement = screen.getByText('Custom');
      expect(typeElement).toBeInTheDocument();
    });
  });
});
