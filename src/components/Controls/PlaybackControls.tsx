'use client';

import React from 'react';
import { AlgorithmStatus } from '@/types/flight';
import { Icons } from '../Common/Icons';

interface PlaybackControlsProps {
  status: AlgorithmStatus;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onOpenBenchmark: () => void;
  disabled: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  status,
  speed,
  onSpeedChange,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onOpenBenchmark,
  disabled,
}) => {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isComplete = status === 'found' || status === 'not-found';

  return (
    <div className="playback-panel">
      {/* Primary Action Buttons */}
      <div className="playback-actions">
        {status === 'idle' && (
          <button
            onClick={onStart}
            disabled={disabled}
            className="action-btn primary-run"
          >
            <Icons.Play size={18} />
            <span>VISUALIZE FLIGHT PATH</span>
          </button>
        )}

        {isRunning && (
          <button onClick={onPause} className="action-btn pause">
            <Icons.Pause size={18} />
            <span>PAUSE VISUALIZATION</span>
          </button>
        )}

        {isPaused && (
          <button onClick={onResume} className="action-btn resume">
            <Icons.Play size={18} />
            <span>RESUME SEARCH</span>
          </button>
        )}

        {isComplete && (
          <button onClick={onStart} className="action-btn re-run">
            <Icons.RotateCcw size={16} />
            <span>RE-RUN SEARCH</span>
          </button>
        )}

        {/* Step Forward */}
        <button
          onClick={onStep}
          disabled={isRunning || isComplete || disabled}
          title="Advance by 1 search step"
          className="action-btn step-btn"
        >
          <Icons.StepForward size={16} />
          <span>STEP</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          disabled={status === 'idle' && !isComplete}
          title="Reset search"
          className="action-btn reset-btn"
        >
          <Icons.RotateCcw size={16} />
          <span>RESET</span>
        </button>

        {/* Benchmark Race Button */}
        <button
          onClick={onOpenBenchmark}
          disabled={disabled || isRunning}
          title="Run all 4 algorithms and compare results side-by-side"
          className="action-btn benchmark-btn"
        >
          <Icons.Trophy size={16} />
          <span>COMPARE ALGORITHMS</span>
        </button>
      </div>

      {/* Speed Slider */}
      <div className="playback-speed-wrapper">
        <div className="speed-label-row">
          <span className="speed-title">ANIMATION SPEED:</span>
          <span className="speed-val">
            {speed === 1 ? '1x (Slow)' : speed === 5 ? '5x' : speed === 15 ? '15x' : speed === 30 ? '30x (Fast)' : 'Turbo'}
          </span>
        </div>
        <div className="speed-slider-container">
          <span className="speed-bound">1x</span>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="speed-slider"
          />
          <span className="speed-bound">Turbo</span>
        </div>
      </div>
    </div>
  );
};
