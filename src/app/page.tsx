'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlgorithmStatus,
  AlgorithmStep,
  AlgorithmType,
  CostMetric,
  DatasetScope,
  FlightGraph,
  RouteSummary,
} from '@/types/flight';
import { MapTransform, getBoundingBoxTransform } from '@/lib/geo';
import { dijkstraGenerator } from '@/lib/algorithms/dijkstra';
import { bidirectionalDijkstraGenerator } from '@/lib/algorithms/bidirectional-dijkstra';
import { astarGenerator } from '@/lib/algorithms/astar';
import { bellmanFordGenerator } from '@/lib/algorithms/bellman-ford';
import { buildRouteSummary } from '@/lib/itinerary';

import { FlightMapCanvas } from '@/components/Map/FlightMapCanvas';
import { MapControls } from '@/components/Map/MapControls';
import { FlightDispatch } from '@/components/Controls/FlightDispatch';
import { AlgorithmSelector } from '@/components/Controls/AlgorithmSelector';
import { PlaybackControls } from '@/components/Controls/PlaybackControls';
import { TelemetryPanel } from '@/components/Telemetry/TelemetryPanel';
import { FlightItinerary } from '@/components/Telemetry/FlightItinerary';
import { AlgorithmComparisonModal } from '@/components/Telemetry/AlgorithmComparisonModal';
import { AlgorithmGuideModal } from '@/components/Telemetry/AlgorithmGuideModal';
import { Icons } from '@/components/Common/Icons';

export default function Home() {
  // Graph & Map Geometry data
  const [graph, setGraph] = useState<FlightGraph | null>(null);
  const [worldLand, setWorldLand] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Flight Route Selections
  const [startIata, setStartIata] = useState('JFK');
  const [targetIata, setTargetIata] = useState('LHR');

  // Algorithm & Metrics
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('astar');
  const [metric, setMetric] = useState<CostMetric>('dist');
  const [scope, setScope] = useState<DatasetScope>('hubs');

  // Playback & Animation State
  const [status, setStatus] = useState<AlgorithmStatus>('idle');
  const [speed, setSpeed] = useState<number>(15);
  const [currentStep, setCurrentStep] = useState<AlgorithmStep | null>(null);
  const [optimalPath, setOptimalPath] = useState<string[] | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  // Map viewport transform & layer controls
  const [transform, setTransform] = useState<MapTransform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [showBackgroundRoutes, setShowBackgroundRoutes] = useState(true);

  // Modals
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Generator and Timer references
  const generatorRef = useRef<Generator<AlgorithmStep, void, unknown> | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<AlgorithmStatus>(status);
  statusRef.current = status;
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  // 1. Initial Data Loading
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const landRes = await fetch('/data/world-land.json');
        const landData = await landRes.json();
        setWorldLand(landData);

        const airportsFile = scope === 'hubs' ? '/data/airports-hubs.json' : '/data/airports.json';
        const routesFile = scope === 'hubs' ? '/data/routes-hubs.json' : '/data/routes.json';

        const [airportsRes, routesRes, hubsRes] = await Promise.all([
          fetch(airportsFile),
          fetch(routesFile),
          fetch('/data/major-hubs.json'),
        ]);

        const airports = await airportsRes.json();
        const routes = await routesRes.json();
        const majorHubs = await hubsRes.json();

        setGraph({
          airports,
          forward: routes.forward,
          backward: routes.backward,
          majorHubs,
        });
      } catch (err) {
        console.error('Failed to load flight graph data:', err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [scope]);

  // Reset Search state
  const resetSearch = useCallback(() => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    generatorRef.current = null;
    setStatus('idle');
    setCurrentStep(null);
    setOptimalPath(null);
    setRouteSummary(null);
  }, []);

  // When start or target or algorithm changes, reset previous search
  const handleSelectStart = (iata: string) => {
    setStartIata(iata);
    resetSearch();
  };

  const handleSelectTarget = (iata: string) => {
    setTargetIata(iata);
    resetSearch();
  };

  const handleSwap = () => {
    const temp = startIata;
    setStartIata(targetIata);
    setTargetIata(temp);
    resetSearch();
  };

  const handleSelectAlgorithm = (algo: AlgorithmType) => {
    setAlgorithm(algo);
    resetSearch();
  };

  const handleSelectMetric = (m: CostMetric) => {
    setMetric(m);
    resetSearch();
  };

  const handleSelectScope = (s: DatasetScope) => {
    setScope(s);
    resetSearch();
  };

  // Create Step Generator for chosen algorithm
  const createGenerator = useCallback((): Generator<AlgorithmStep, void, unknown> | null => {
    if (!graph || !startIata || !targetIata) return null;

    switch (algorithm) {
      case 'dijkstra':
        return dijkstraGenerator(graph, startIata, targetIata, metric);
      case 'bidirectional-dijkstra':
        return bidirectionalDijkstraGenerator(graph, startIata, targetIata, metric);
      case 'astar':
        return astarGenerator(graph, startIata, targetIata, metric);
      case 'bellman-ford':
        return bellmanFordGenerator(graph, startIata, targetIata, metric);
      default:
        return dijkstraGenerator(graph, startIata, targetIata, metric);
    }
  }, [graph, startIata, targetIata, algorithm, metric]);

  // Advance single or multiple steps
  const stepEngine = useCallback((): boolean => {
    if (!generatorRef.current) {
      generatorRef.current = createGenerator();
    }
    if (!generatorRef.current) return false;

    // Batch steps based on speed
    const currentSpd = speedRef.current;
    const batchCount = currentSpd <= 5 ? 1 : currentSpd <= 15 ? 2 : currentSpd <= 30 ? 6 : 18;

    let finalStep: AlgorithmStep | null = null;
    let finished = false;

    for (let i = 0; i < batchCount; i++) {
      const { value, done } = generatorRef.current.next();
      if (done || (value && value.isComplete)) {
        finished = true;
        if (value) finalStep = value;
        break;
      }
      if (value) finalStep = value;
    }

    if (finalStep) {
      setCurrentStep(finalStep);

      if (finalStep.isComplete) {
        if (finalStep.pathFound && finalStep.pathFound.length > 0) {
          setOptimalPath(finalStep.pathFound);
          if (graph) {
            const discoveredCount =
              (finalStep.visitedNodes?.length || 0) +
              (finalStep.backwardVisitedNodes?.length || 0);
            const totalAirports = Object.keys(graph.airports).length;
            const summary = buildRouteSummary(
              graph,
              finalStep.pathFound,
              discoveredCount,
              totalAirports,
              algorithm
            );
            setRouteSummary(summary);
          }
          setStatus('found');
        } else {
          setStatus('not-found');
        }
        return false; // Stop loop
      }
    }

    return !finished;
  }, [createGenerator, graph]);

  // Start Playback
  const handleStart = () => {
    resetSearch();
    const gen = createGenerator();
    generatorRef.current = gen;
    setStatus('running');

    const tickInterval = speed <= 5 ? 80 : speed <= 15 ? 35 : speed <= 30 ? 20 : 16;

    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = setInterval(() => {
      const continueRunning = stepEngine();
      if (!continueRunning) {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      }
    }, tickInterval);
  };

  // Pause Playback
  const handlePause = () => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setStatus('paused');
  };

  // Resume Playback
  const handleResume = () => {
    if (!generatorRef.current) return;
    setStatus('running');

    const tickInterval = speed <= 5 ? 80 : speed <= 15 ? 35 : speed <= 30 ? 20 : 16;
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = setInterval(() => {
      const continueRunning = stepEngine();
      if (!continueRunning) {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      }
    }, tickInterval);
  };

  // Step Forward manually
  const handleStep = () => {
    if (status === 'idle') {
      generatorRef.current = createGenerator();
      setStatus('paused');
    }
    stepEngine();
  };

  // Update speed dynamically during playback
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    speedRef.current = newSpeed;

    if (statusRef.current === 'running') {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      const tickInterval = newSpeed <= 5 ? 80 : newSpeed <= 15 ? 35 : newSpeed <= 30 ? 20 : 16;
      playbackTimerRef.current = setInterval(() => {
        const continueRunning = stepEngine();
        if (!continueRunning) {
          if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
      }, tickInterval);
    }
  };

  // Fit View to Route
  const handleFitRoute = () => {
    if (!graph || !optimalPath || optimalPath.length < 2) return;
    const airports = optimalPath.map((i) => graph.airports[i]).filter(Boolean);
    if (airports.length >= 2) {
      const newT = getBoundingBoxTransform(airports, 1200, 700, 140);
      setTransform(newT);
    }
  };

  // Reset World View
  const handleResetView = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="app-container">
      {/* HUD Header Bar */}
      <header className="hud-header">
        <div className="header-branding">
          <div className="radar-logo">
            <Icons.Plane size={22} className="logo-plane" />
            <div className="radar-sweep" />
          </div>
          <div className="branding-text">
            <h1 className="app-title">AERO-PATH</h1>
            <span className="app-subtitle">REAL-TIME FLIGHT PATHFINDING VISUALIZER</span>
          </div>
        </div>

        {/* Live Data Badge */}
        <div className="header-stats">
          <div className="data-source-badge">
            <span className="live-dot" />
            <span className="source-name">OPENFLIGHTS DATABASE</span>
            <span className="source-counts">
              {graph
                ? `${Object.keys(graph.airports).length.toLocaleString()} AIRPORTS • 37,041 ROUTES`
                : 'LOADING DATA...'}
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="header-actions">
          <button
            onClick={() => setIsBenchmarkOpen(true)}
            disabled={!graph || status === 'running'}
            className="header-btn benchmark"
          >
            <Icons.Trophy size={16} />
            <span>Race Mode</span>
          </button>

          <button
            onClick={() => setIsGuideOpen(true)}
            className="header-btn guide"
          >
            <Icons.Info size={16} />
            <span>Algorithm Guide</span>
          </button>
        </div>
      </header>

      {/* Main Cockpit Layout */}
      <div className="cockpit-layout">
        {/* Left Side Control Tower Deck */}
        <aside className="control-tower">
          <FlightDispatch
            graph={graph}
            startIata={startIata}
            targetIata={targetIata}
            onSelectStart={handleSelectStart}
            onSelectTarget={handleSelectTarget}
            onSwap={handleSwap}
            disabled={status === 'running'}
          />

          <AlgorithmSelector
            algorithm={algorithm}
            metric={metric}
            scope={scope}
            onSelectAlgorithm={handleSelectAlgorithm}
            onSelectMetric={handleSelectMetric}
            onSelectScope={handleSelectScope}
            disabled={status === 'running'}
            onOpenInfo={() => setIsGuideOpen(true)}
          />

          <PlaybackControls
            status={status}
            speed={speed}
            onSpeedChange={handleSpeedChange}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStep={handleStep}
            onReset={resetSearch}
            onOpenBenchmark={() => setIsBenchmarkOpen(true)}
            disabled={!graph || isLoadingData}
          />

          <TelemetryPanel
            status={status}
            algorithm={algorithm}
            currentStep={currentStep}
            graph={graph}
            targetIata={targetIata}
          />
        </aside>

        {/* Center / Right Radar Map Viewport */}
        <main className="radar-viewport">
          <FlightMapCanvas
            graph={graph}
            worldLand={worldLand}
            startIata={startIata}
            targetIata={targetIata}
            currentStep={currentStep}
            algorithm={algorithm}
            optimalPath={optimalPath}
            showBackgroundRoutes={showBackgroundRoutes}
            onSelectAirport={(iata) => {
              if (status !== 'running') {
                handleSelectTarget(iata);
              }
            }}
            transform={transform}
            onTransformChange={setTransform}
          />

          <MapControls
            transform={transform}
            onTransformChange={setTransform}
            onFitRoute={handleFitRoute}
            onResetView={handleResetView}
            showBackgroundRoutes={showBackgroundRoutes}
            onToggleBackgroundRoutes={() =>
              setShowBackgroundRoutes((prev) => !prev)
            }
            hasRoute={!!optimalPath && optimalPath.length >= 2}
          />

          {/* Floating Flight Itinerary Boarding Pass Card */}
          {routeSummary && (
            <div className="floating-itinerary-container">
              <FlightItinerary summary={routeSummary} />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <AlgorithmComparisonModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        graph={graph}
        startIata={startIata}
        targetIata={targetIata}
        metric={metric}
      />

      <AlgorithmGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
