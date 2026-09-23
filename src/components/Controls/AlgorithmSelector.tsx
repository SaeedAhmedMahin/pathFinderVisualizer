'use client';

import React from 'react';
import { AlgorithmType, CostMetric, DatasetScope } from '@/types/flight';
import { Icons } from '../Common/Icons';

interface AlgorithmSelectorProps {
  algorithm: AlgorithmType;
  metric: CostMetric;
  scope: DatasetScope;
  onSelectAlgorithm: (algo: AlgorithmType) => void;
  onSelectMetric: (metric: CostMetric) => void;
  onSelectScope: (scope: DatasetScope) => void;
  disabled: boolean;
  onOpenInfo: () => void;
}

const ALGORITHMS: {
  id: AlgorithmType;
  name: string;
  badge: string;
  tagline: string;
}[] = [
  {
    id: 'dijkstra',
    name: 'Dijkstra',
    badge: 'Uniform Cost',
    tagline: 'Expands radially in all directions',
  },
  {
    id: 'bidirectional-dijkstra',
    name: 'Bi-directional',
    badge: 'Dual Frontier',
    tagline: 'Forward & backward searches meeting mid-way',
  },
  {
    id: 'astar',
    name: 'A* Search',
    badge: 'Heuristic Admissible',
    tagline: 'Target-guided spherical great-circle corridor',
  },
  {
    id: 'bellman-ford',
    name: 'Bellman-Ford',
    badge: 'Edge Relaxation',
    tagline: 'Discovers 1-hop, 2-hop, 3-hop routes in rounds',
  },
];

const METRICS: {
  id: CostMetric;
  name: string;
  icon: keyof typeof Icons;
  unit: string;
}[] = [
  { id: 'dist', name: 'Shortest Distance', icon: 'Plane', unit: 'km' },
  { id: 'time', name: 'Fastest Travel Time', icon: 'Clock', unit: 'hrs' },
  { id: 'price', name: 'Lowest Airfare', icon: 'DollarSign', unit: 'USD' },
  { id: 'hops', name: 'Fewest Layovers', icon: 'Layers', unit: 'legs' },
];

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  algorithm,
  metric,
  scope,
  onSelectAlgorithm,
  onSelectMetric,
  onSelectScope,
  disabled,
  onOpenInfo,
}) => {
  return (
    <div className="algo-selector-panel">
      {/* Algorithms Selector */}
      <div className="algo-header-row">
        <span className="section-title">PATHFINDING ALGORITHM</span>
        <button
          onClick={onOpenInfo}
          className="info-help-btn"
          title="Learn how these algorithms navigate flight networks"
        >
          <Icons.Info size={14} />
          <span>Algorithm Guide</span>
        </button>
      </div>

      <div className="algo-grid">
        {ALGORITHMS.map((a) => {
          const isSelected = algorithm === a.id;
          return (
            <button
              key={a.id}
              onClick={() => onSelectAlgorithm(a.id)}
              disabled={disabled}
              className={`algo-card ${isSelected ? 'active' : ''}`}
            >
              <div className="algo-card-top">
                <span className="algo-card-name">{a.name}</span>
                <span className="algo-card-badge">{a.badge}</span>
              </div>
              <div className="algo-card-desc">{a.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Metrics & Scope Row */}
      <div className="metrics-scope-row">
        {/* Metric selection */}
        <div className="metric-group">
          <span className="sub-title">OPTIMIZATION METRIC:</span>
          <div className="metric-pills">
            {METRICS.map((m) => {
              const isSelected = metric === m.id;
              const IconComponent = Icons[m.icon];
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMetric(m.id)}
                  disabled={disabled}
                  className={`metric-pill ${isSelected ? 'active' : ''}`}
                >
                  <IconComponent size={14} />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dataset Scope Toggle */}
        <div className="scope-group">
          <span className="sub-title">DATASET SCOPE:</span>
          <div className="scope-toggle">
            <button
              onClick={() => onSelectScope('hubs')}
              disabled={disabled}
              className={`scope-pill ${scope === 'hubs' ? 'active' : ''}`}
              title="350 major international hubs for fast, clean rendering"
            >
              Major Hubs
            </button>
            <button
              onClick={() => onSelectScope('global')}
              disabled={disabled}
              className={`scope-pill ${scope === 'global' ? 'active' : ''}`}
              title="All 3,257 commercial airports and 37,000+ flight routes worldwide"
            >
              Worldwide Network
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
