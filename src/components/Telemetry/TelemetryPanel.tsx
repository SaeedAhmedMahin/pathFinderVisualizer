'use client';

import React from 'react';
import {
  AlgorithmStatus,
  AlgorithmStep,
  AlgorithmType,
  FlightGraph,
} from '@/types/flight';
import { Icons } from '../Common/Icons';

interface TelemetryPanelProps {
  status: AlgorithmStatus;
  algorithm: AlgorithmType;
  currentStep: AlgorithmStep | null;
  graph: FlightGraph | null;
  targetIata: string;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  status,
  algorithm,
  currentStep,
  graph,
}) => {
  const currentAirport =
    currentStep?.currentNode && graph
      ? graph.airports[currentStep.currentNode]
      : null;

  const visitedCount =
    (currentStep?.visitedNodes?.length || 0) +
    (currentStep?.backwardVisitedNodes?.length || 0);

  const frontierCount =
    (currentStep?.frontierNodes?.length || 0) +
    (currentStep?.backwardFrontierNodes?.length || 0);

  const getStatusBadge = () => {
    switch (status) {
      case 'idle':
        return <span className="status-badge idle">READY FOR FLIGHT SEARCH</span>;
      case 'running':
        return (
          <span className="status-badge running">
            <span className="pulse-indicator" /> SCANNING FLIGHT NETWORK...
          </span>
        );
      case 'paused':
        return <span className="status-badge paused">SEARCH PAUSED</span>;
      case 'found':
        return (
          <span className="status-badge found">
            <Icons.CheckCircle size={14} /> OPTIMAL FLIGHT PATH CONFIRMED
          </span>
        );
      case 'not-found':
        return (
          <span className="status-badge error">
            <Icons.AlertCircle size={14} /> NO CONNECTING ROUTE FOUND
          </span>
        );
    }
  };

  return (
    <div className="telemetry-panel">
      <div className="telemetry-top-bar">
        <span className="telemetry-title">LIVE RADAR TELEMETRY</span>
        {getStatusBadge()}
      </div>

      <div className="telemetry-grid">
        {/* Active Node */}
        <div className="telemetry-card highlight">
          <div className="telemetry-card-label">CURRENT EVALUATED HUB</div>
          <div className="telemetry-card-val current-hub">
            {currentAirport ? (
              <>
                <span className="hub-iata">{currentAirport.iata}</span>
                <span className="hub-name">{currentAirport.city}, {currentAirport.country}</span>
              </>
            ) : (
              <span className="hub-empty">—</span>
            )}
          </div>
        </div>

        {/* Airports Discovered */}
        <div className={`telemetry-card ${status === 'found' ? 'highlight-final' : ''}`}>
          <div className="telemetry-card-label">
            {status === 'found' ? '★ AIRPORTS DISCOVERED' : 'AIRPORTS DISCOVERED'}
          </div>
          <div className="telemetry-card-val number">
            {visitedCount}
            {graph && (
              <span className="telemetry-card-total">
                {' '}/ {Object.keys(graph.airports).length}
              </span>
            )}
          </div>
          <div className="telemetry-card-sub">
            {status === 'found'
              ? `Final search explored ${visitedCount} hubs`
              : algorithm === 'bidirectional-dijkstra'
              ? `Fwd: ${currentStep?.visitedNodes?.length || 0} | Bwd: ${currentStep?.backwardVisitedNodes?.length || 0}`
              : 'Visited Hubs in Graph'}
          </div>
        </div>

        {/* Frontier / Queue */}
        <div className="telemetry-card">
          <div className="telemetry-card-label">FRONTIER QUEUE</div>
          <div className="telemetry-card-val number">
            {frontierCount}
          </div>
          <div className="telemetry-card-sub">
            Candidate Hubs in Open Set
          </div>
        </div>

        {/* Algorithm Specific Stats */}
        {algorithm === 'astar' && currentStep?.hScore !== undefined && (
          <div className="telemetry-card">
            <div className="telemetry-card-label">A* HEURISTIC (f = g + h)</div>
            <div className="telemetry-card-val astar-scores">
              <span>g: {Math.round(currentStep.gScore || 0)}</span>
              <span>h: {Math.round(currentStep.hScore || 0)}</span>
            </div>
            <div className="telemetry-card-sub">
              Spherical Great-Circle Admissible Estimate
            </div>
          </div>
        )}

        {algorithm === 'bellman-ford' && (
          <div className="telemetry-card">
            <div className="telemetry-card-label">BELLMAN-FORD PASS</div>
            <div className="telemetry-card-val number">
              Round {currentStep?.pass || 0}
            </div>
            <div className="telemetry-card-sub">
              Max transfer depth / leg level
            </div>
          </div>
        )}

        {algorithm === 'bidirectional-dijkstra' && (
          <div className="telemetry-card">
            <div className="telemetry-card-label">FRONTIER CONVERGENCE</div>
            <div className="telemetry-card-val">
              {currentStep?.meetingNode ? (
                <span style={{ color: '#eab308', fontWeight: 'bold' }}>
                  Met at {currentStep.meetingNode}!
                </span>
              ) : (
                <span style={{ color: '#38bdf8' }}>Converging...</span>
              )}
            </div>
            <div className="telemetry-card-sub">
              Dual Wave Intersection
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
