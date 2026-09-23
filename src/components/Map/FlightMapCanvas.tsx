'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Airport,
  AlgorithmStep,
  AlgorithmType,
  FlightGraph,
} from '@/types/flight';
import {
  getBoundingBoxTransform,
  interpolateGreatCircle,
  MapTransform,
  projectGeo,
} from '@/lib/geo';

interface FlightMapCanvasProps {
  graph: FlightGraph | null;
  worldLand: any | null;
  startIata: string | null;
  targetIata: string | null;
  currentStep: AlgorithmStep | null;
  algorithm: AlgorithmType;
  optimalPath: string[] | null;
  showBackgroundRoutes: boolean;
  onSelectAirport: (iata: string) => void;
  transform: MapTransform;
  onTransformChange: (t: MapTransform) => void;
}

export const FlightMapCanvas: React.FC<FlightMapCanvasProps> = ({
  graph,
  worldLand,
  startIata,
  targetIata,
  currentStep,
  optimalPath,
  showBackgroundRoutes,
  onSelectAirport,
  transform,
  onTransformChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hover state
  const [hoveredAirport, setHoveredAirport] = useState<{
    airport: Airport;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Interaction tracking refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const transformRef = useRef<MapTransform>(transform);
  transformRef.current = transform;

  // Animation frame & plane progress
  const planeProgressRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);

  // Canvas size
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });

  // Handle Resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 1200,
          height: clientHeight || 700,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pre-calculate Great Circle curves for the optimal path
  const [optimalPathCurves, setOptimalPathCurves] = useState<[number, number][][]>([]);

  useEffect(() => {
    if (!graph || !optimalPath || optimalPath.length < 2) {
      setOptimalPathCurves([]);
      return;
    }

    const segments: [number, number][][] = [];
    for (let i = 0; i < optimalPath.length - 1; i++) {
      const a = graph.airports[optimalPath[i]];
      const b = graph.airports[optimalPath[i + 1]];
      if (a && b) {
        const points = interpolateGreatCircle(a.lat, a.lon, b.lat, b.lon, 64);
        segments.push(points);
      }
    }
    setOptimalPathCurves(segments);
    planeProgressRef.current = 0;
  }, [graph, optimalPath]);

  // Main Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    // Set display buffer resolution
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Increment pulse phase for glowing animations
    pulsePhaseRef.current = (pulsePhaseRef.current + 0.03) % (Math.PI * 2);
    const pulseScale = 1 + Math.sin(pulsePhaseRef.current) * 0.15;

    // 1. Clear background (Deep dark space navy cockpit tone)
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw subtle latitude/longitude graticules
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Meridians
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x1, y1] = projectGeo(lon, -80, width, height, transformRef.current);
      const [x2, y2] = projectGeo(lon, 80, width, height, transformRef.current);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      const [x1, y1] = projectGeo(-180, lat, width, height, transformRef.current);
      const [x2, y2] = projectGeo(180, lat, width, height, transformRef.current);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Draw World Landmass GeoJSON
    if (worldLand && worldLand.coordinates) {
      ctx.fillStyle = '#0e172a';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1;

      const polygons =
        worldLand.type === 'MultiPolygon'
          ? worldLand.coordinates
          : [worldLand.coordinates];

      for (const poly of polygons) {
        for (const ring of poly) {
          ctx.beginPath();
          let first = true;
          let prevScreenX = 0;

          for (const [lon, lat] of ring) {
            const [sx, sy] = projectGeo(
              lon,
              lat,
              width,
              height,
              transformRef.current
            );
            // Handle antimeridian jump
            if (!first && Math.abs(sx - prevScreenX) > width * 0.4) {
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(sx, sy);
            } else {
              if (first) {
                ctx.moveTo(sx, sy);
                first = false;
              } else {
                ctx.lineTo(sx, sy);
              }
            }
            prevScreenX = sx;
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 4. Background routes (translucent arcs)
    if (showBackgroundRoutes && graph) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
      ctx.lineWidth = 0.8;
      const hubs = graph.majorHubs.slice(0, 100);

      for (const hubIata of hubs) {
        const edges = graph.forward[hubIata] || [];
        const srcAirport = graph.airports[hubIata];
        if (!srcAirport) continue;
        const [x1, y1] = projectGeo(
          srcAirport.lon,
          srcAirport.lat,
          width,
          height,
          transformRef.current
        );

        for (let j = 0; j < Math.min(6, edges.length); j++) {
          const dstAirport = graph.airports[edges[j].dst];
          if (!dstAirport) continue;
          const [x2, y2] = projectGeo(
            dstAirport.lon,
            dstAirport.lat,
            width,
            height,
            transformRef.current
          );

          if (Math.abs(x1 - x2) < width * 0.7) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            // Slight curve
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.08;
            ctx.quadraticCurveTo(midX, midY, x2, y2);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Active search edge beam
    if (currentStep?.activeEdge && graph) {
      const src = graph.airports[currentStep.activeEdge.src];
      const dst = graph.airports[currentStep.activeEdge.dst];
      if (src && dst) {
        const [x1, y1] = projectGeo(
          src.lon,
          src.lat,
          width,
          height,
          transformRef.current
        );
        const [x2, y2] = projectGeo(
          dst.lon,
          dst.lat,
          width,
          height,
          transformRef.current
        );

        if (Math.abs(x1 - x2) < width * 0.8) {
          ctx.save();
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00f2fe';
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.08;
          ctx.quadraticCurveTo(midX, midY, x2, y2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 6. Draw Airport circles
    if (graph) {
      const visitedSet = new Set(currentStep?.visitedNodes || []);
      const backwardVisitedSet = new Set(
        currentStep?.backwardVisitedNodes || []
      );
      const frontierSet = new Set(currentStep?.frontierNodes || []);
      const backwardFrontierSet = new Set(
        currentStep?.backwardFrontierNodes || []
      );
      const currentNode = currentStep?.currentNode;
      const meetingNode = currentStep?.meetingNode;

      for (const [iata, airport] of Object.entries(graph.airports)) {
        const [x, y] = projectGeo(
          airport.lon,
          airport.lat,
          width,
          height,
          transformRef.current
        );

        // Viewport culling
        if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;

        const isStart = iata === startIata;
        const isTarget = iata === targetIata;
        const isCurrent = iata === currentNode;
        const isMeeting = iata === meetingNode;
        const isFrontier = frontierSet.has(iata);
        const isBackwardFrontier = backwardFrontierSet.has(iata);
        const isVisited = visitedSet.has(iata);
        const isBackwardVisited = backwardVisitedSet.has(iata);
        const isHub = airport.routesCount >= 40;

        // Base airport dot
        if (isStart) {
          // Origin: Glowing emerald beacon
          ctx.save();
          ctx.shadowBlur = 16;
          ctx.shadowColor = '#10b981';
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing halo
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 9 * pulseScale, 0, Math.PI * 2);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText(`ORIGIN: ${iata}`, x + 10, y + 4);
          ctx.restore();
        } else if (isTarget) {
          // Destination: Glowing ruby beacon with crosshair
          ctx.save();
          ctx.shadowBlur = 16;
          ctx.shadowColor = '#f43f5e';
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing crosshair ring
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 9 * pulseScale, 0, Math.PI * 2);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText(`DEST: ${iata}`, x + 10, y + 4);
          ctx.restore();
        } else if (isMeeting) {
          // Meeting Point in Bi-directional search
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#eab308';
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 12 * pulseScale, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`INTERSECTION: ${iata}`, x + 9, y - 8);
          ctx.restore();
        } else if (isCurrent) {
          // Current node being expanded: cyan/amber radar ping
          ctx.save();
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#00f2fe';
          ctx.fillStyle = '#00f2fe';
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();

          // Expanding radar sweep ring
          ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 11 * pulseScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (isBackwardVisited) {
          // Backward Visited (Bi-directional search): Neon Magenta
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (isVisited) {
          // Forward Visited: Amber / Light Cyan
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (isBackwardFrontier) {
          // Backward Frontier: Ring of magenta
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (isFrontier) {
          // Forward Frontier: Ring of cyan
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (isHub) {
          // Major unvisited Hub
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Regional airport
          ctx.fillStyle = 'rgba(100, 116, 139, 0.28)';
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 7. Draw Optimal Path (Luminous Great-Circle Arcs)
    if (optimalPathCurves.length > 0) {
      ctx.save();
      // Outer radiant glow
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00f2fe';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3.5;

      for (const curve of optimalPathCurves) {
        ctx.beginPath();
        let first = true;
        let prevX = 0;

        for (const [lon, lat] of curve) {
          const [sx, sy] = projectGeo(
            lon,
            lat,
            width,
            height,
            transformRef.current
          );
          if (!first && Math.abs(sx - prevX) > width * 0.5) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, sy);
          } else {
            if (first) {
              ctx.moveTo(sx, sy);
              first = false;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          prevX = sx;
        }
        ctx.stroke();
      }

      // Inner bright core
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      for (const curve of optimalPathCurves) {
        ctx.beginPath();
        let first = true;
        let prevX = 0;
        for (const [lon, lat] of curve) {
          const [sx, sy] = projectGeo(
            lon,
            lat,
            width,
            height,
            transformRef.current
          );
          if (!first && Math.abs(sx - prevX) > width * 0.5) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, sy);
          } else {
            if (first) {
              ctx.moveTo(sx, sy);
              first = false;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          prevX = sx;
        }
        ctx.stroke();
      }

      // Waypoint Badges along the path
      if (optimalPath && graph) {
        for (let i = 1; i < optimalPath.length - 1; i++) {
          const wayIata = optimalPath[i];
          const airport = graph.airports[wayIata];
          if (airport) {
            const [wx, wy] = projectGeo(
              airport.lon,
              airport.lat,
              width,
              height,
              transformRef.current
            );
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00f2fe';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`STOP ${i}: ${wayIata}`, wx + 8, wy - 4);
          }
        }
      }

      // 8. Animated Aircraft gliding along optimal path
      planeProgressRef.current = (planeProgressRef.current + 0.003) % 1;
      const totalCurves = optimalPathCurves.length;
      const currentSegmentIndex = Math.min(
        totalCurves - 1,
        Math.floor(planeProgressRef.current * totalCurves)
      );
      const segment = optimalPathCurves[currentSegmentIndex];

      if (segment && segment.length >= 2) {
        const segProgress =
          (planeProgressRef.current * totalCurves) - currentSegmentIndex;
        const ptIndex = Math.min(
          segment.length - 2,
          Math.floor(segProgress * (segment.length - 1))
        );
        const [lon1, lat1] = segment[ptIndex];
        const [lon2, lat2] = segment[ptIndex + 1];

        const [px, py] = projectGeo(
          lon1,
          lat1,
          width,
          height,
          transformRef.current
        );
        const [nextPx, nextPy] = projectGeo(
          lon2,
          lat2,
          width,
          height,
          transformRef.current
        );

        const angle = Math.atan2(nextPy - py, nextPx - px);

        // Draw Jet Icon
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        // Glow trail
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00f2fe';

        // Stylized Jet
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -7);
        ctx.lineTo(-3, -2);
        ctx.lineTo(-8, -2);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-10, 5);
        ctx.lineTo(-8, 2);
        ctx.lineTo(-3, 2);
        ctx.lineTo(-6, 7);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }

    ctx.restore();
    animFrameIdRef.current = requestAnimationFrame(render);
  }, [
    dimensions,
    worldLand,
    showBackgroundRoutes,
    graph,
    currentStep,
    startIata,
    targetIata,
    optimalPathCurves,
    optimalPath,
  ]);

  // Start / Keep render loop alive
  useEffect(() => {
    animFrameIdRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [render]);

  // Mouse Interaction: Hover hit-test & Pan/Zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only primary mouse button
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const updated = {
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy,
      };
      onTransformChange(updated);
      return;
    }

    // Hover detection: find closest airport within 14px
    if (graph) {
      let closest: Airport | null = null;
      let minDistance = 14;

      for (const airport of Object.values(graph.airports)) {
        const [sx, sy] = projectGeo(
          airport.lon,
          airport.lat,
          dimensions.width,
          dimensions.height,
          transformRef.current
        );
        const dist = Math.hypot(sx - mouseX, sy - mouseY);
        if (dist < minDistance) {
          minDistance = dist;
          closest = airport;
        }
      }

      if (closest) {
        setHoveredAirport({
          airport: closest,
          screenX: mouseX,
          screenY: mouseY,
        });
      } else {
        setHoveredAirport(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredAirport) {
      onSelectAirport(hoveredAirport.airport.iata);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.8, Math.min(12, transformRef.current.scale * zoomFactor));

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom anchored to cursor position
    const cx = mouseX - dimensions.width / 2;
    const cy = mouseY - dimensions.height / 2;

    const scaleRatio = newScale / transformRef.current.scale;
    const newX = cx - (cx - transformRef.current.x) * scaleRatio;
    const newY = cy - (cy - transformRef.current.y) * scaleRatio;

    onTransformChange({
      scale: newScale,
      x: newX,
      y: newY,
    });
  };

  // Center on Route if optimalPath changes
  useEffect(() => {
    if (optimalPath && optimalPath.length >= 2 && graph) {
      const airports = optimalPath
        .map((iata) => graph.airports[iata])
        .filter(Boolean);
      if (airports.length >= 2) {
        const targetTransform = getBoundingBoxTransform(
          airports,
          dimensions.width,
          dimensions.height,
          120
        );
        onTransformChange(targetTransform);
      }
    }
  }, [optimalPath, graph, dimensions, onTransformChange]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: hoveredAirport
          ? 'pointer'
          : isDraggingRef.current
          ? 'grabbing'
          : 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Floating HUD Tooltip */}
      {hoveredAirport && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(dimensions.width - 240, hoveredAirport.screenX + 14)}px`,
            top: `${Math.max(10, hoveredAirport.screenY - 80)}px`,
            pointerEvents: 'none',
            zIndex: 40,
            background: 'rgba(9, 14, 26, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 242, 254, 0.2)',
            fontSize: '12px',
            minWidth: '200px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 800, color: '#00f2fe', fontSize: '14px', letterSpacing: '0.05em' }}>
              {hoveredAirport.airport.iata}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>
              {hoveredAirport.airport.country}
            </span>
          </div>
          <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hoveredAirport.airport.name}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>
            {hoveredAirport.airport.city}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', fontSize: '10px', color: '#38bdf8' }}>
            <span>Routes: {hoveredAirport.airport.routesCount}</span>
            <span>{hoveredAirport.airport.lat.toFixed(2)}°, {hoveredAirport.airport.lon.toFixed(2)}°</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: '#f59e0b', textAlign: 'center' }}>
            Click to set Destination
          </div>
        </div>
      )}
    </div>
  );
};
