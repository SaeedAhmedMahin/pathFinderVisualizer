export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  routesCount: number;
  incomingCount: number;
}

export interface FlightEdge {
  dst: string;
  dist: number; // in km
  time: number; // in minutes
  price: number; // in USD
}

export interface ReverseFlightEdge {
  src: string;
  dist: number;
  time: number;
  price: number;
}

export interface FlightGraph {
  airports: Record<string, Airport>;
  forward: Record<string, FlightEdge[]>;
  backward: Record<string, ReverseFlightEdge[]>;
  majorHubs: string[];
}

export type AlgorithmType =
  | 'dijkstra'
  | 'bidirectional-dijkstra'
  | 'astar'
  | 'bellman-ford';

export type CostMetric = 'dist' | 'time' | 'price' | 'hops';

export type DatasetScope = 'global' | 'hubs';

export type AlgorithmStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'found'
  | 'not-found';

export interface AlgorithmStep {
  stepNumber: number;
  currentNode: string | null;
  currentDirection?: 'forward' | 'backward';
  visitedNodes: string[];
  backwardVisitedNodes?: string[];
  frontierNodes: string[];
  backwardFrontierNodes?: string[];
  activeEdge?: {
    src: string;
    dst: string;
    relaxed: boolean;
    weight: number;
  } | null;
  distances: Record<string, number>;
  backwardDistances?: Record<string, number>;
  parents: Record<string, string | null>;
  backwardParents?: Record<string, string | null>;
  meetingNode?: string | null;
  pass?: number; // for Bellman-Ford
  isComplete: boolean;
  pathFound: string[] | null;
  fScore?: number;
  gScore?: number;
  hScore?: number;
}

export interface ItineraryLeg {
  legIndex: number;
  from: Airport;
  to: Airport;
  flightCode: string;
  distanceKm: number;
  durationMinutes: number;
  priceUsd: number;
  layoverMinutes?: number;
}

export interface RouteSummary {
  path: string[];
  airports: Airport[];
  legs: ItineraryLeg[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalPriceUsd: number;
  transfersCount: number;
  airportsDiscovered: number;
  totalAirportsInNetwork: number;
  algorithmName?: string;
  searchDurationMs?: number;
}

export interface BenchmarkResult {
  algorithm: AlgorithmType;
  name: string;
  nodesExplored: number;
  edgesRelaxed: number;
  executionTimeMs: number;
  totalDistanceKm: number;
  pathLength: number;
  path: string[];
  isOptimal: boolean;
}
