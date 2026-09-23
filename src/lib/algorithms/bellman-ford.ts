import {
  AlgorithmStep,
  CostMetric,
  FlightGraph,
} from '@/types/flight';
import { getEdgeWeight } from './dijkstra';

export function* bellmanFordGenerator(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist',
  maxPasses: number = 8
): Generator<AlgorithmStep, void, unknown> {
  const distances: Record<string, number> = { [startIata]: 0 };
  const parents: Record<string, string | null> = { [startIata]: null };
  const visited = new Set<string>([startIata]);

  let stepNumber = 0;

  yield {
    stepNumber: stepNumber++,
    currentNode: startIata,
    visitedNodes: [startIata],
    frontierNodes: [startIata],
    activeEdge: null,
    distances: { ...distances },
    parents: { ...parents },
    pass: 0,
    isComplete: false,
    pathFound: null,
  };

  // Up to maxPasses (commercial flights rarely exceed 6 legs)
  let activeNodes = new Set<string>([startIata]);

  for (let pass = 1; pass <= maxPasses; pass++) {
    let anyRelaxed = false;
    const nextActiveNodes = new Set<string>();

    for (const u of activeNodes) {
      const edges = graph.forward[u] || [];
      const currentU = distances[u];
      if (currentU === undefined) continue;

      for (const edge of edges) {
        const v = edge.dst;
        const weight = getEdgeWeight(edge, metric);
        const newDist = currentU + weight;
        const currentV = distances[v] ?? Infinity;

        if (newDist < currentV) {
          distances[v] = newDist;
          parents[v] = u;
          visited.add(v);
          nextActiveNodes.add(v);
          anyRelaxed = true;

          yield {
            stepNumber: stepNumber++,
            currentNode: u,
            visitedNodes: Array.from(visited),
            frontierNodes: Array.from(nextActiveNodes),
            activeEdge: {
              src: u,
              dst: v,
              relaxed: true,
              weight,
            },
            distances: { ...distances },
            parents: { ...parents },
            pass,
            isComplete: false,
            pathFound: null,
          };
        }
      }
    }

    if (!anyRelaxed || nextActiveNodes.size === 0) {
      break;
    }

    activeNodes = nextActiveNodes;
  }

  // Path reconstruction
  if (distances[targetIata] !== undefined && distances[targetIata] < Infinity) {
    const path: string[] = [];
    let curr: string | null = targetIata;
    const seen = new Set<string>();

    while (curr !== null && !seen.has(curr)) {
      path.unshift(curr);
      seen.add(curr);
      curr = parents[curr] ?? null;
    }

    yield {
      stepNumber: stepNumber++,
      currentNode: targetIata,
      visitedNodes: Array.from(visited),
      frontierNodes: [],
      activeEdge: null,
      distances: { ...distances },
      parents: { ...parents },
      isComplete: true,
      pathFound: path[0] === startIata ? path : null,
    };
  } else {
    yield {
      stepNumber: stepNumber++,
      currentNode: null,
      visitedNodes: Array.from(visited),
      frontierNodes: [],
      activeEdge: null,
      distances: { ...distances },
      parents: { ...parents },
      isComplete: true,
      pathFound: null,
    };
  }
}
