import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenGauge } from './TokenGauge';

describe('TokenGauge', () => {
  const defaultColors = {
    text: { secondary: 'text-gray-300', muted: 'text-gray-500' },
    progressBg: 'bg-gray-800'
  };

  describe('Basic rendering', () => {
    it('renders with required label', () => {
      render(<TokenGauge label="Session" colors={defaultColors} />);
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('displays percentage when provided', () => {
      render(<TokenGauge label="Session" pct={75} colors={defaultColors} />);
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('displays N/A when pct is null', () => {
      render(<TokenGauge label="Weekly" pct={null} colors={defaultColors} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Reset time display', () => {
    it('shows reset time with rolling type', () => {
      render(
        <TokenGauge
          label="Session"
          pct={50}
          resetTime="2h 30m"
          resetType="rolling"
          colors={defaultColors}
        />
      );
      expect(screen.getByText('Resets in 2h 30m')).toBeInTheDocument();
    });

    it('shows reset time with fixed type', () => {
      render(
        <TokenGauge
          label="Weekly"
          pct={30}
          resetTime="Mon 9:00"
          resetType="fixed"
          colors={defaultColors}
        />
      );
      expect(screen.getByText('Resets Mon 9:00')).toBeInTheDocument();
    });

    it('shows no extension data message when N/A', () => {
      render(
        <TokenGauge
          label="Session"
          pct={null}
          resetTime="2h"
          colors={defaultColors}
        />
      );
      expect(screen.getByText('No extension data')).toBeInTheDocument();
    });
  });

  describe('Color thresholds for Session', () => {
    it('shows green color when below 60%', () => {
      const { container } = render(
        <TokenGauge label="Session" pct={50} colors={defaultColors} />
      );
      const pctElement = screen.getByText('50%');
      expect(pctElement.className).toContain('text-green-500');
    });

    it('shows yellow color when between 60-85%', () => {
      const { container } = render(
        <TokenGauge label="Session" pct={70} colors={defaultColors} />
      );
      const pctElement = screen.getByText('70%');
      expect(pctElement.className).toContain('text-yellow-500');
    });

    it('shows red color when 85% or above', () => {
      const { container } = render(
        <TokenGauge label="Session" pct={90} colors={defaultColors} />
      );
      const pctElement = screen.getByText('90%');
      expect(pctElement.className).toContain('text-red-500');
    });
  });

  describe('Weekly gauge (neutral colors)', () => {
    it('shows gray color for Weekly gauge regardless of percentage', () => {
      const { container } = render(
        <TokenGauge label="Weekly" pct={95} colors={defaultColors} />
      );
      const pctElement = screen.getByText('95%');
      expect(pctElement.className).toContain('text-gray-400');
    });
  });

  describe('Edge cases', () => {
    it('handles 0%', () => {
      render(<TokenGauge label="Session" pct={0} colors={defaultColors} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles 100%', () => {
      render(<TokenGauge label="Session" pct={100} colors={defaultColors} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('renders without optional props', () => {
      render(<TokenGauge label="Test" />);
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });
});
