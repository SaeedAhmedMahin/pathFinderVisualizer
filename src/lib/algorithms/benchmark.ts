import {
  AlgorithmType,
  BenchmarkResult,
  CostMetric,
  FlightGraph,
} from '@/types/flight';
import { haversineDistance } from '../geo';
import { MinPriorityQueue } from '../priority-queue';
import { calculateHeuristic } from './astar';
import { getEdgeWeight } from './dijkstra';

function calculatePathDistance(graph: FlightGraph, path: string[]): number {
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = graph.airports[path[i]];
    const b = graph.airports[path[i + 1]];
    if (a && b) {
      total += haversineDistance(a.lat, a.lon, b.lat, b.lon);
    }
  }
  return total;
}

export function runDijkstraFast(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): BenchmarkResult {
  const t0 = performance.now();
  const distances: Record<string, number> = { [startIata]: 0 };
  const parents: Record<string, string | null> = { [startIata]: null };
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();
  let edgesRelaxed = 0;

  pq.push(startIata, 0);

  while (!pq.isEmpty()) {
    const u = pq.pop()!.item;
    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetIata) break;

    const edges = graph.forward[u] || [];
    for (const edge of edges) {
      const v = edge.dst;
      if (visited.has(v)) continue;

      const weight = getEdgeWeight(edge, metric);
      const newDist = (distances[u] ?? Infinity) + weight;
      if (newDist < (distances[v] ?? Infinity)) {
        distances[v] = newDist;
        parents[v] = u;
        pq.push(v, newDist);
        edgesRelaxed++;
      }
    }
  }

  const t1 = performance.now();
  const path: string[] = [];
  if (distances[targetIata] !== undefined) {
    let curr: string | null = targetIata;
    while (curr !== null) {
      path.unshift(curr);
      curr = parents[curr] ?? null;
    }
  }

  return {
    algorithm: 'dijkstra',
    name: "Dijkstra's Algorithm",
    nodesExplored: visited.size,
    edgesRelaxed,
    executionTimeMs: Math.round((t1 - t0) * 100) / 100,
    totalDistanceKm: calculatePathDistance(graph, path),
    pathLength: path.length,
    path,
    isOptimal: path.length > 0,
  };
}

export function runBidirectionalDijkstraFast(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): BenchmarkResult {
  const t0 = performance.now();
  if (startIata === targetIata) {
    return {
      algorithm: 'bidirectional-dijkstra',
      name: 'Bi-directional Dijkstra',
      nodesExplored: 1,
      edgesRelaxed: 0,
      executionTimeMs: 0.05,
      totalDistanceKm: 0,
      pathLength: 1,
      path: [startIata],
      isOptimal: true,
    };
  }

  const distF: Record<string, number> = { [startIata]: 0 };
  const distB: Record<string, number> = { [targetIata]: 0 };
  const parentF: Record<string, string | null> = { [startIata]: null };
  const parentB: Record<string, string | null> = { [targetIata]: null };

  const visitedF = new Set<string>();
  const visitedB = new Set<string>();

  const pqF = new MinPriorityQueue<string>();
  const pqB = new MinPriorityQueue<string>();

  pqF.push(startIata, 0);
  pqB.push(targetIata, 0);

  let bestDistance = Infinity;
  let meetingNode: string | null = null;
  let edgesRelaxed = 0;

  while (!pqF.isEmpty() && !pqB.isEmpty()) {
    const minF = pqF.peek()?.priority ?? Infinity;
    const minB = pqB.peek()?.priority ?? Infinity;

    if (minF + minB >= bestDistance) break;

    const expandForward = minF <= minB;
    if (expandForward) {
      const u = pqF.pop()!.item;
      if (visitedF.has(u)) continue;
      visitedF.add(u);

      if (distB[u] !== undefined && distF[u] + distB[u] < bestDistance) {
        bestDistance = distF[u] + distB[u];
        meetingNode = u;
      }

      for (const edge of graph.forward[u] || []) {
        const v = edge.dst;
        if (visitedF.has(v)) continue;

        const weight = getEdgeWeight(edge, metric);
        const newDist = distF[u] + weight;
        if (newDist < (distF[v] ?? Infinity)) {
          distF[v] = newDist;
          parentF[v] = u;
          pqF.push(v, newDist);
          edgesRelaxed++;

          if (distB[v] !== undefined && newDist + distB[v] < bestDistance) {
            bestDistance = newDist + distB[v];
            meetingNode = v;
          }
        }
      }
    } else {
      const u = pqB.pop()!.item;
      if (visitedB.has(u)) continue;
      visitedB.add(u);

      if (distF[u] !== undefined && distF[u] + distB[u] < bestDistance) {
        bestDistance = distF[u] + distB[u];
        meetingNode = u;
      }

      for (const edge of graph.backward[u] || []) {
        const v = edge.src;
        if (visitedB.has(v)) continue;

        const weight = getEdgeWeight(edge, metric);
        const newDist = distB[u] + weight;
        if (newDist < (distB[v] ?? Infinity)) {
          distB[v] = newDist;
          parentB[v] = u;
          pqB.push(v, newDist);
          edgesRelaxed++;

          if (distF[v] !== undefined && distF[v] + newDist < bestDistance) {
            bestDistance = distF[v] + newDist;
            meetingNode = v;
          }
        }
      }
    }
  }

  const t1 = performance.now();
  let fullPath: string[] = [];
  if (meetingNode && bestDistance < Infinity) {
    const fPath: string[] = [];
    let curr: string | null = meetingNode;
    while (curr !== null) {
      fPath.unshift(curr);
      curr = parentF[curr] ?? null;
    }
    const bPath: string[] = [];
    let bCurr = parentB[meetingNode] ?? null;
    while (bCurr !== null) {
      bPath.push(bCurr);
      bCurr = parentB[bCurr] ?? null;
    }
    fullPath = [...fPath, ...bPath];
  }

  return {
    algorithm: 'bidirectional-dijkstra',
    name: 'Bi-directional Dijkstra',
    nodesExplored: visitedF.size + visitedB.size,
    edgesRelaxed,
    executionTimeMs: Math.round((t1 - t0) * 100) / 100,
    totalDistanceKm: calculatePathDistance(graph, fullPath),
    pathLength: fullPath.length,
    path: fullPath,
    isOptimal: fullPath.length > 0,
  };
}

export function runAstarFast(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): BenchmarkResult {
  const t0 = performance.now();
  const gScore: Record<string, number> = { [startIata]: 0 };
  const parents: Record<string, string | null> = { [startIata]: null };
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();
  let edgesRelaxed = 0;

  const h0 = calculateHeuristic(graph, startIata, targetIata, metric);
  pq.push(startIata, h0);

  while (!pq.isEmpty()) {
    const u = pq.pop()!.item;
    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetIata) break;

    const currentG = gScore[u] ?? Infinity;
    for (const edge of graph.forward[u] || []) {
      const v = edge.dst;
      if (visited.has(v)) continue;

      const weight = getEdgeWeight(edge, metric);
      const tentativeG = currentG + weight;
      if (tentativeG < (gScore[v] ?? Infinity)) {
        parents[v] = u;
        gScore[v] = tentativeG;
        const h = calculateHeuristic(graph, v, targetIata, metric);
        pq.push(v, tentativeG + h);
        edgesRelaxed++;
      }
    }
  }

  const t1 = performance.now();
  const path: string[] = [];
  if (gScore[targetIata] !== undefined) {
    let curr: string | null = targetIata;
    while (curr !== null) {
      path.unshift(curr);
      curr = parents[curr] ?? null;
    }
  }

  return {
    algorithm: 'astar',
    name: 'A* Search (Admissible Heuristic)',
    nodesExplored: visited.size,
    edgesRelaxed,
    executionTimeMs: Math.round((t1 - t0) * 100) / 100,
    totalDistanceKm: calculatePathDistance(graph, path),
    pathLength: path.length,
    path,
    isOptimal: path.length > 0,
  };
}

export function runBellmanFordFast(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist',
  maxPasses: number = 6
): BenchmarkResult {
  const t0 = performance.now();
  const distances: Record<string, number> = { [startIata]: 0 };
  const parents: Record<string, string | null> = { [startIata]: null };
  const visited = new Set<string>([startIata]);
  let activeNodes = new Set<string>([startIata]);
  let edgesRelaxed = 0;

  for (let pass = 1; pass <= maxPasses; pass++) {
    let anyRelaxed = false;
    const nextActiveNodes = new Set<string>();

    for (const u of activeNodes) {
      const currentU = distances[u];
      if (currentU === undefined) continue;

      for (const edge of graph.forward[u] || []) {
        const v = edge.dst;
        const weight = getEdgeWeight(edge, metric);
        const newDist = currentU + weight;

        if (newDist < (distances[v] ?? Infinity)) {
          distances[v] = newDist;
          parents[v] = u;
          visited.add(v);
          nextActiveNodes.add(v);
          anyRelaxed = true;
          edgesRelaxed++;
        }
      }
    }

    if (!anyRelaxed || nextActiveNodes.size === 0) break;
    activeNodes = nextActiveNodes;
  }

  const t1 = performance.now();
  const path: string[] = [];
  if (distances[targetIata] !== undefined) {
    let curr: string | null = targetIata;
    const seen = new Set<string>();
    while (curr !== null && !seen.has(curr)) {
      path.unshift(curr);
      seen.add(curr);
      curr = parents[curr] ?? null;
    }
  }

  return {
    algorithm: 'bellman-ford',
    name: 'Bellman-Ford Algorithm',
    nodesExplored: visited.size,
    edgesRelaxed,
    executionTimeMs: Math.round((t1 - t0) * 100) / 100,
    totalDistanceKm: calculatePathDistance(graph, path),
    pathLength: path.length,
    path: path[0] === startIata ? path : [],
    isOptimal: path[0] === startIata,
  };
}

export function runAllBenchmarks(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): BenchmarkResult[] {
  return [
    runDijkstraFast(graph, startIata, targetIata, metric),
    runBidirectionalDijkstraFast(graph, startIata, targetIata, metric),
    runAstarFast(graph, startIata, targetIata, metric),
    runBellmanFordFast(graph, startIata, targetIata, metric),
  ];
}
