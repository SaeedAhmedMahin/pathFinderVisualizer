'use client';

import React from 'react';
import { Icons } from '../Common/Icons';

interface AlgorithmGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmGuideModal: React.FC<AlgorithmGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card guide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-title">
              <Icons.Info size={20} className="info-icon" />
              <span>FLIGHT PATHFINDING ALGORITHMS GUIDE</span>
            </div>
            <div className="modal-subtitle">
              How real-world flight networks are traversed by graph algorithms
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <Icons.Close size={18} />
          </button>
        </div>

        <div className="guide-content">
          {/* Dijkstra */}
          <div className="guide-algo-section">
            <div className="guide-algo-title">
              <span className="badge dijkstra">Dijkstra</span>
              <span>Uniform-Cost Search (1959)</span>
            </div>
            <p>
              Dijkstra explores airports in strict order of cumulative distance from the origin. It maintains a priority queue of candidate airports, continually expanding the lowest-cost unvisited hub.
            </p>
            <div className="guide-props">
              <div><strong>Frontier Behavior:</strong> Expands outward in concentric ripples like a radar wave.</div>
              <div><strong>Optimality:</strong> Guaranteed to find the optimal shortest path for non-negative weights.</div>
              <div><strong>Limitation:</strong> Spreads equally in all directions, even backward away from the target destination.</div>
            </div>
          </div>

          {/* Bi-directional Dijkstra */}
          <div className="guide-algo-section">
            <div className="guide-algo-title">
              <span className="badge bidirectional">Bi-directional Dijkstra</span>
              <span>Dual-Frontier Wavefronts</span>
            </div>
            <p>
              Runs two simultaneous Dijkstra searches: a <strong>Forward search</strong> from the departure airport (in cyan) and a <strong>Backward search</strong> from the destination airport (in magenta). The searches meet at a central transfer hub (e.g. Dubai, Frankfurt, Singapore).
            </p>
            <div className="guide-props">
              <div><strong>Frontier Behavior:</strong> Two expanding circular waves rushing towards each other.</div>
              <div><strong>Search Area Reduction:</strong> Instead of searching an area proportional to $\pi r^2$, it searches approximately $2 \times \pi (r/2)^2 = \frac{1}{2}\pi r^2$—saving up to 50% or more explored nodes!</div>
            </div>
          </div>

          {/* A* Search */}
          <div className="guide-algo-section">
            <div className="guide-algo-title">
              <span className="badge astar">A* Search</span>
              <span>Heuristic-Guided Search (Hart, Nilsson, Raphael 1968)</span>
            </div>
            <p>
              A* evaluates airports by $f(n) = g(n) + h(n)$, where $g(n)$ is the true distance traveled and $h(n)$ is an estimate of remaining distance to the destination.
            </p>
            <div className="guide-props">
              <div><strong>Heuristic Formula:</strong> Admissible Great-Circle spherical Haversine distance. Because straight-line spherical distance is the shortest possible path between any two coordinates, $h(n) \le d^*(n)$, ensuring 100% mathematical optimality.</div>
              <div><strong>Visual Distinction:</strong> Pulls the search beam straight along the global flight corridor towards the destination, ignoring backward routes.</div>
            </div>
          </div>

          {/* Bellman-Ford */}
          <div className="guide-algo-section">
            <div className="guide-algo-title">
              <span className="badge bellman">Bellman-Ford</span>
              <span>Iterative Edge Relaxation Dynamic Programming</span>
            </div>
            <p>
              Bellman-Ford operates in relaxation passes. In pass 1, it discovers all direct flights (0 layovers). In pass 2, it explores all 1-layover routes. In pass 3, all 2-layover routes.
            </p>
            <div className="guide-props">
              <div><strong>Aviation Context:</strong> Perfectly models multi-hop flight transfer restrictions (e.g. "Find best itinerary with at most 2 transfers").</div>
              <div><strong>Visual Wave:</strong> You can observe edge relaxation waves washing across continents round by round until no further distance improvements can be made.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
