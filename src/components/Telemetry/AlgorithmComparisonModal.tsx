'use client';

import React, { useMemo } from 'react';
import { BenchmarkResult, CostMetric, FlightGraph } from '@/types/flight';
import { runAllBenchmarks } from '@/lib/algorithms/benchmark';
import { formatDistance } from '@/lib/geo';
import { Icons } from '../Common/Icons';

interface AlgorithmComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  graph: FlightGraph | null;
  startIata: string;
  targetIata: string;
  metric: CostMetric;
}

export const AlgorithmComparisonModal: React.FC<AlgorithmComparisonModalProps> = ({
  isOpen,
  onClose,
  graph,
  startIata,
  targetIata,
  metric,
}) => {
  const results = useMemo<BenchmarkResult[]>(() => {
    if (!isOpen || !graph || !startIata || !targetIata) return [];
    return runAllBenchmarks(graph, startIata, targetIata, metric);
  }, [isOpen, graph, startIata, targetIata, metric]);

  if (!isOpen) return null;

  const maxExplored = Math.max(...results.map((r) => r.nodesExplored), 1);
  const startAirport = graph?.airports[startIata];
  const targetAirport = graph?.airports[targetIata];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-title">
              <Icons.Trophy size={20} className="trophy-icon" />
              <span>ALGORITHM BENCHMARK RACE</span>
            </div>
            <div className="modal-subtitle">
              Comparing Route Search Performance from{' '}
              <strong>{startAirport ? `${startAirport.city} (${startIata})` : startIata}</strong> to{' '}
              <strong>{targetAirport ? `${targetAirport.city} (${targetIata})` : targetIata}</strong>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <Icons.Close size={18} />
          </button>
        </div>

        {/* Comparison Cards / Table */}
        <div className="benchmark-grid">
          {results.map((res) => {
            const barWidth = Math.max(5, (res.nodesExplored / maxExplored) * 100);
            return (
              <div key={res.algorithm} className="benchmark-card">
                <div className="benchmark-card-header">
                  <span className="benchmark-algo-name">{res.name}</span>
                  <span className="benchmark-time">{res.executionTimeMs} ms</span>
                </div>

                {/* Nodes Explored Metric */}
                <div className="benchmark-stat-row">
                  <span className="label">Airports Explored:</span>
                  <span className="value">{res.nodesExplored.toLocaleString()}</span>
                </div>
                <div className="stat-bar-bg">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background:
                        res.algorithm === 'astar'
                          ? '#10b981'
                          : res.algorithm === 'bidirectional-dijkstra'
                          ? '#00f2fe'
                          : res.algorithm === 'dijkstra'
                          ? '#38bdf8'
                          : '#f59e0b',
                    }}
                  />
                </div>

                <div className="benchmark-details-list">
                  <div className="detail-item">
                    <span>Edges Relaxed:</span>
                    <strong>{res.edgesRelaxed.toLocaleString()}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Path Distance:</span>
                    <strong>{res.totalDistanceKm > 0 ? formatDistance(res.totalDistanceKm) : 'No route'}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Total Legs:</span>
                    <strong>{res.pathLength > 0 ? `${res.pathLength - 1} stop(s)` : 'N/A'}</strong>
                  </div>
                </div>

                {/* Route String */}
                {res.path.length > 0 && (
                  <div className="benchmark-path">
                    {res.path.join(' ➔ ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Algorithm Performance Takeaway */}
        <div className="benchmark-insights">
          <div className="insight-title">
            <Icons.Zap size={16} /> KEY ALGORITHMIC OBSERVATIONS
          </div>
          <div className="insight-bullets">
            <p>
              • <strong>A* Search</strong> directs its search cone toward the destination using the spherical Haversine distance heuristic, cutting visited nodes by up to 80% compared to Dijkstra.
            </p>
            <p>
              • <strong>Bi-directional Dijkstra</strong> expands two concentric wavefronts simultaneously from origin and destination, meeting in the middle and searching a fraction of the total graph area ($\approx 2 \times \pi (r/2)^2$ vs $\pi r^2$).
            </p>
            <p>
              • <strong>Bellman-Ford</strong> evaluates flight connections round-by-round, representing discovery of routes with at most $k$ layovers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
