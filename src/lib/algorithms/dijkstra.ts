import {
  AlgorithmStep,
  CostMetric,
  FlightGraph,
} from '@/types/flight';
import { MinPriorityQueue } from '../priority-queue';

export function getEdgeWeight(
  edge: { dist: number; time: number; price: number },
  metric: CostMetric
): number {
  switch (metric) {
    case 'dist':
      return edge.dist;
    case 'time':
      return edge.time;
    case 'price':
      return edge.price;
    case 'hops':
      return 1;
    default:
      return edge.dist;
  }
}

export function* dijkstraGenerator(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): Generator<AlgorithmStep, void, unknown> {
  const distances: Record<string, number> = {};
  const parents: Record<string, string | null> = {};
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();

  distances[startIata] = 0;
  parents[startIata] = null;
  pq.push(startIata, 0);

  let stepNumber = 0;

  yield {
    stepNumber: stepNumber++,
    currentNode: startIata,
    visitedNodes: [],
    frontierNodes: [startIata],
    activeEdge: null,
    distances: { ...distances },
    parents: { ...parents },
    isComplete: false,
    pathFound: null,
  };

  while (!pq.isEmpty()) {
    const minNode = pq.pop()!;
    const u = minNode.item;

    if (visited.has(u)) continue;
    visited.add(u);

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
        distances: { ...distances },
        parents: { ...parents },
        isComplete: true,
        pathFound: path,
      };
      return;
    }

    yield {
      stepNumber: stepNumber++,
      currentNode: u,
      visitedNodes: Array.from(visited),
      frontierNodes: pq.toArray(),
      activeEdge: null,
      distances: { ...distances },
      parents: { ...parents },
      isComplete: false,
      pathFound: null,
    };

    const outgoingEdges = graph.forward[u] || [];
    for (const edge of outgoingEdges) {
      const v = edge.dst;
      if (visited.has(v)) continue;

      const weight = getEdgeWeight(edge, metric);
      const newDist = (distances[u] ?? Infinity) + weight;
      const currentDist = distances[v] ?? Infinity;

      if (newDist < currentDist) {
        distances[v] = newDist;
        parents[v] = u;
        pq.push(v, newDist);

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
          distances: { ...distances },
          parents: { ...parents },
          isComplete: false,
          pathFound: null,
        };
      }
    }
  }

  // If unreachable
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
