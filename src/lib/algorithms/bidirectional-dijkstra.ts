import {
  AlgorithmStep,
  CostMetric,
  FlightGraph,
} from '@/types/flight';
import { MinPriorityQueue } from '../priority-queue';
import { getEdgeWeight } from './dijkstra';

export function* bidirectionalDijkstraGenerator(
  graph: FlightGraph,
  startIata: string,
  targetIata: string,
  metric: CostMetric = 'dist'
): Generator<AlgorithmStep, void, unknown> {
  if (startIata === targetIata) {
    yield {
      stepNumber: 0,
      currentNode: startIata,
      visitedNodes: [startIata],
      frontierNodes: [],
      activeEdge: null,
      distances: { [startIata]: 0 },
      parents: { [startIata]: null },
      isComplete: true,
      pathFound: [startIata],
    };
    return;
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
  let stepNumber = 0;

  yield {
    stepNumber: stepNumber++,
    currentNode: startIata,
    currentDirection: 'forward',
    visitedNodes: [],
    backwardVisitedNodes: [],
    frontierNodes: [startIata],
    backwardFrontierNodes: [targetIata],
    activeEdge: null,
    distances: { ...distF },
    backwardDistances: { ...distB },
    parents: { ...parentF },
    backwardParents: { ...parentB },
    meetingNode: null,
    isComplete: false,
    pathFound: null,
  };

  while (!pqF.isEmpty() && !pqB.isEmpty()) {
    const minF = pqF.peek()?.priority ?? Infinity;
    const minB = pqB.peek()?.priority ?? Infinity;

    // Termination condition: minimum keys sum >= best candidate path
    if (minF + minB >= bestDistance) {
      break;
    }

    // Expand whichever side has smaller top key
    const expandForward = minF <= minB;

    if (expandForward) {
      const u = pqF.pop()!.item;
      if (visitedF.has(u)) continue;
      visitedF.add(u);

      yield {
        stepNumber: stepNumber++,
        currentNode: u,
        currentDirection: 'forward',
        visitedNodes: Array.from(visitedF),
        backwardVisitedNodes: Array.from(visitedB),
        frontierNodes: pqF.toArray(),
        backwardFrontierNodes: pqB.toArray(),
        activeEdge: null,
        distances: { ...distF },
        backwardDistances: { ...distB },
        parents: { ...parentF },
        backwardParents: { ...parentB },
        meetingNode,
        isComplete: false,
        pathFound: null,
      };

      // Check if this node is also known in backward search
      if (distB[u] !== undefined && distF[u] + distB[u] < bestDistance) {
        bestDistance = distF[u] + distB[u];
        meetingNode = u;
      }

      const edges = graph.forward[u] || [];
      for (const edge of edges) {
        const v = edge.dst;
        if (visitedF.has(v)) continue;

        const weight = getEdgeWeight(edge, metric);
        const newDist = distF[u] + weight;
        const currentDist = distF[v] ?? Infinity;

        if (newDist < currentDist) {
          distF[v] = newDist;
          parentF[v] = u;
          pqF.push(v, newDist);

          if (distB[v] !== undefined && newDist + distB[v] < bestDistance) {
            bestDistance = newDist + distB[v];
            meetingNode = v;
          }

          yield {
            stepNumber: stepNumber++,
            currentNode: u,
            currentDirection: 'forward',
            visitedNodes: Array.from(visitedF),
            backwardVisitedNodes: Array.from(visitedB),
            frontierNodes: pqF.toArray(),
            backwardFrontierNodes: pqB.toArray(),
            activeEdge: {
              src: u,
              dst: v,
              relaxed: true,
              weight,
            },
            distances: { ...distF },
            backwardDistances: { ...distB },
            parents: { ...parentF },
            backwardParents: { ...parentB },
            meetingNode,
            isComplete: false,
            pathFound: null,
          };
        }
      }
    } else {
      // Expand backward search
      const u = pqB.pop()!.item;
      if (visitedB.has(u)) continue;
      visitedB.add(u);

      yield {
        stepNumber: stepNumber++,
        currentNode: u,
        currentDirection: 'backward',
        visitedNodes: Array.from(visitedF),
        backwardVisitedNodes: Array.from(visitedB),
        frontierNodes: pqF.toArray(),
        backwardFrontierNodes: pqB.toArray(),
        activeEdge: null,
        distances: { ...distF },
        backwardDistances: { ...distB },
        parents: { ...parentF },
        backwardParents: { ...parentB },
        meetingNode,
        isComplete: false,
        pathFound: null,
      };

      if (distF[u] !== undefined && distF[u] + distB[u] < bestDistance) {
        bestDistance = distF[u] + distB[u];
        meetingNode = u;
      }

      // Backward edges: incoming flights into u (flight is from edge.src -> u)
      const backwardEdges = graph.backward[u] || [];
      for (const edge of backwardEdges) {
        const v = edge.src; // origin of flight to u
        if (visitedB.has(v)) continue;

        const weight = getEdgeWeight(edge, metric);
        const newDist = distB[u] + weight;
        const currentDist = distB[v] ?? Infinity;

        if (newDist < currentDist) {
          distB[v] = newDist;
          parentB[v] = u;
          pqB.push(v, newDist);

          if (distF[v] !== undefined && distF[v] + newDist < bestDistance) {
            bestDistance = distF[v] + newDist;
            meetingNode = v;
          }

          yield {
            stepNumber: stepNumber++,
            currentNode: u,
            currentDirection: 'backward',
            visitedNodes: Array.from(visitedF),
            backwardVisitedNodes: Array.from(visitedB),
            frontierNodes: pqF.toArray(),
            backwardFrontierNodes: pqB.toArray(),
            activeEdge: {
              src: v,
              dst: u,
              relaxed: true,
              weight,
            },
            distances: { ...distF },
            backwardDistances: { ...distB },
            parents: { ...parentF },
            backwardParents: { ...parentB },
            meetingNode,
            isComplete: false,
            pathFound: null,
          };
        }
      }
    }
  }

  // Reconstruct path if meeting node found
  if (meetingNode && bestDistance < Infinity) {
    const forwardPath: string[] = [];
    let curr: string | null = meetingNode;
    while (curr !== null) {
      forwardPath.unshift(curr);
      curr = parentF[curr] ?? null;
    }

    const backwardPath: string[] = [];
    let bCurr = parentB[meetingNode] ?? null;
    while (bCurr !== null) {
      backwardPath.push(bCurr);
      bCurr = parentB[bCurr] ?? null;
    }

    const fullPath = [...forwardPath, ...backwardPath];

    yield {
      stepNumber: stepNumber++,
      currentNode: meetingNode,
      visitedNodes: Array.from(visitedF),
      backwardVisitedNodes: Array.from(visitedB),
      frontierNodes: pqF.toArray(),
      backwardFrontierNodes: pqB.toArray(),
      activeEdge: null,
      distances: { ...distF },
      backwardDistances: { ...distB },
      parents: { ...parentF },
      backwardParents: { ...parentB },
      meetingNode,
      isComplete: true,
      pathFound: fullPath,
    };
  } else {
    yield {
      stepNumber: stepNumber++,
      currentNode: null,
      visitedNodes: Array.from(visitedF),
      backwardVisitedNodes: Array.from(visitedB),
      frontierNodes: [],
      backwardFrontierNodes: [],
      activeEdge: null,
      distances: { ...distF },
      backwardDistances: { ...distB },
      parents: { ...parentF },
      backwardParents: { ...parentB },
      meetingNode: null,
      isComplete: true,
      pathFound: null,
    };
  }
}
