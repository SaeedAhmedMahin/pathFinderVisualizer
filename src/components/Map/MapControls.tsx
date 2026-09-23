'use client';

import React from 'react';
import { Icons } from '../Common/Icons';
import { MapTransform } from '@/lib/geo';

interface MapControlsProps {
  transform: MapTransform;
  onTransformChange: (t: MapTransform) => void;
  onFitRoute: () => void;
  onResetView: () => void;
  showBackgroundRoutes: boolean;
  onToggleBackgroundRoutes: () => void;
  hasRoute: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  transform,
  onTransformChange,
  onFitRoute,
  onResetView,
  showBackgroundRoutes,
  onToggleBackgroundRoutes,
  hasRoute,
}) => {
  const handleZoom = (factor: number) => {
    onTransformChange({
      ...transform,
      scale: Math.max(0.8, Math.min(12, transform.scale * factor)),
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: 'rgba(13, 18, 31, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '10px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        <button
          onClick={() => handleZoom(1.25)}
          title="Zoom In"
          className="map-ctrl-btn"
        >
          <Icons.ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          title="Zoom Out"
          className="map-ctrl-btn"
        >
          <Icons.ZoomOut size={18} />
        </button>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
        {hasRoute && (
          <button
            onClick={onFitRoute}
            title="Focus On Active Route"
            className="map-ctrl-btn highlight"
          >
            <Icons.Crosshair size={18} />
          </button>
        )}
        <button
          onClick={onResetView}
          title="Reset World View"
          className="map-ctrl-btn"
        >
          <Icons.RotateCcw size={18} />
        </button>
      </div>

      <button
        onClick={onToggleBackgroundRoutes}
        title={showBackgroundRoutes ? 'Hide Global Network Arcs' : 'Show Global Network Arcs'}
        className={`map-toggle-btn ${showBackgroundRoutes ? 'active' : ''}`}
      >
        <Icons.Layers size={16} />
        <span>Routes</span>
      </button>
    </div>
  );
};
