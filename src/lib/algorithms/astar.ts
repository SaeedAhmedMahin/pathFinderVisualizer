import {
  AlgorithmStep,
  CostMetric,
  FlightGraph,
} from '@/types/flight';
import { haversineDistance } from '../geo';
import { MinPriorityQueue } from '../priority-queue';
import { getEdgeWeight } from './dijkstra';

export function calculateHeuristic(
  graph: FlightGraph,
  nodeIata: string,
  targetIata: string,
  metric: CostMetric
): number {
  const node = graph.airports[nodeIata];
  const target = graph.airports[targetIata];
  if (!node || !target) return 0;

  const directDist = haversineDistance(
    node.lat,
    node.lon,
    target.lat,
    target.lon
  );

  switch (metric) {
    case 'dist':
      return directDist;
    case 'time':
      // Admissible: max cruise speed 950 km/h in minutes
      return (directDist / 950) * 60;
    case 'price':
      // Admissible lower bound: $0.05 / km
      return directDist * 0.05;
    case 'hops':
      // Admissible: a single flight rarely exceeds 15,000 km
      return Math.ceil(directDist / 15000);
    default:
      return directDist;
  }
}

export function* astarGenerator(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): Generator<AlgorithmStep, void, unknown> {
  const gScore: Record<string, number> = { [startIata]: 0 };
  const fScore: Record<string, number> = {
    [startIata]: calculateHeuristic(graph, startIata, targetIata, metric),
  };
  const parents: Record<string, string | null> = { [startIata]: null };
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();

  pq.push(startIata, fScore[startIata]);

  let stepNumber = 0;

  yield {
    stepNumber: stepNumber++,
    currentNode: startIata,
    visitedNodes: [],
    frontierNodes: [startIata],
    activeEdge: null,
    distances: { ...gScore },
    parents: { ...parents },
    isComplete: false,
    pathFound: null,
    fScore: fScore[startIata],
    gScore: 0,
    hScore: fScore[startIata],
  };

  while (!pq.isEmpty()) {
    const minNode = pq.pop()!;
    const u = minNode.item;

    if (visited.has(u)) continue;
    visited.add(u);

    const currentG = gScore[u] ?? Infinity;
    const currentH = calculateHeuristic(graph, u, targetIata, metric);
    const currentF = currentG + currentH;

    // Check if reached destination
    if (u === targetIata) {
      const path: string[] = [];
      let curr: string | null = targetIata;
      while (curr !== null) {
        path.unshift(curr);
        curr = parents[curr] ?? null;
      }

      yield {
        stepNumber: stepNumber++,
        currentNode: u,
        visitedNodes: Array.from(visited),
        frontierNodes: pq.toArray(),
        activeEdge: null,
        distances: { ...gScore },
        parents: { ...parents },
        isComplete: true,
        pathFound: path,
        fScore: currentF,
        gScore: currentG,
        hScore: 0,
      };
      return;
    }

    yield {
      stepNumber: stepNumber++,
      currentNode: u,
      visitedNodes: Array.from(visited),
      frontierNodes: pq.toArray(),
      activeEdge: null,
      distances: { ...gScore },
      parents: { ...parents },
      isComplete: false,
      pathFound: null,
      fScore: currentF,
      gScore: currentG,
      hScore: currentH,
    };

    const edges = graph.forward[u] || [];
    for (const edge of edges) {
      const v = edge.dst;
      if (visited.has(v)) continue;

      const weight = getEdgeWeight(edge, metric);
      const tentativeG = currentG + weight;
      const prevG = gScore[v] ?? Infinity;

      if (tentativeG < prevG) {
        parents[v] = u;
        gScore[v] = tentativeG;
        const h = calculateHeuristic(graph, v, targetIata, metric);
        const f = tentativeG + h;
        fScore[v] = f;
        pq.push(v, f);

        yield {
          stepNumber: stepNumber++,
          currentNode: u,
          visitedNodes: Array.from(visited),
          frontierNodes: pq.toArray(),
          activeEdge: {
            src: u,
            dst: v,
            relaxed: true,
            weight,
          },
          distances: { ...gScore },
          parents: { ...parents },
          isComplete: false,
          pathFound: null,
          fScore: f,
          gScore: tentativeG,
          hScore: h,
        };
      }
    }
  }

  // Destination unreachable
  yield {
    stepNumber: stepNumber++,
    currentNode: null,
    visitedNodes: Array.from(visited),
    frontierNodes: [],
    activeEdge: null,
    distances: { ...gScore },
    parents: { ...parents },
    isComplete: true,
    pathFound: null,
  };
}
