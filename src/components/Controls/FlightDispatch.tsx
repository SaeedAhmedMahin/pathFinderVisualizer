'use client';

import React, { useMemo, useState } from 'react';
import { Airport, FlightGraph } from '@/types/flight';
import { Icons } from '../Common/Icons';

interface FlightDispatchProps {
  graph: FlightGraph | null;
  startIata: string;
  targetIata: string;
  onSelectStart: (iata: string) => void;
  onSelectTarget: (iata: string) => void;
  onSwap: () => void;
  disabled: boolean;
}

const PRESET_ROUTES = [
  { from: 'JFK', to: 'LHR', label: 'NYC ➔ London' },
  { from: 'LAX', to: 'SYD', label: 'LA ➔ Sydney' },
  { from: 'LHR', to: 'SIN', label: 'London ➔ Singapore' },
  { from: 'CDG', to: 'HND', label: 'Paris ➔ Tokyo' },
  { from: 'SFO', to: 'DXB', label: 'SFO ➔ Dubai' },
  { from: 'ORD', to: 'FRA', label: 'Chicago ➔ Frankfurt' },
];

export const FlightDispatch: React.FC<FlightDispatchProps> = ({
  graph,
  startIata,
  targetIata,
  onSelectStart,
  onSelectTarget,
  onSwap,
  disabled,
}) => {
  const [startQuery, setStartQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  // Filter airports for autocomplete
  const filterAirports = (query: string): Airport[] => {
    if (!graph || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const matches: Airport[] = [];

    for (const airport of Object.values(graph.airports)) {
      if (
        airport.iata.toLowerCase().startsWith(q) ||
        airport.city.toLowerCase().includes(q) ||
        airport.name.toLowerCase().includes(q) ||
        airport.country.toLowerCase().includes(q)
      ) {
        matches.push(airport);
        if (matches.length >= 8) break;
      }
    }
    return matches;
  };

  const startMatches = useMemo(() => filterAirports(startQuery), [startQuery, graph]);
  const targetMatches = useMemo(() => filterAirports(targetQuery), [targetQuery, graph]);

  const currentStart = graph?.airports[startIata];
  const currentTarget = graph?.airports[targetIata];

  return (
    <div className="dispatch-deck">
      <div className="dispatch-inputs-row">
        {/* Origin Airport */}
        <div className="dispatch-field">
          <label className="dispatch-label origin">
            <span className="dot origin-dot" /> DEPARTURE (ORIGIN)
          </label>
          <div className="airport-input-wrapper">
            <div className="iata-badge origin">{startIata}</div>
            <input
              type="text"
              placeholder={currentStart ? `${currentStart.city} (${currentStart.name})` : 'Search city or airport...'}
              value={startQuery}
              onChange={(e) => {
                setStartQuery(e.target.value);
                setShowStartDropdown(true);
              }}
              onFocus={() => setShowStartDropdown(true)}
              disabled={disabled}
              className="airport-text-input"
            />
            {startQuery && (
              <button
                onClick={() => {
                  setStartQuery('');
                  setShowStartDropdown(false);
                }}
                className="clear-input-btn"
              >
                <Icons.Close size={14} />
              </button>
            )}
          </div>

          {/* Origin Dropdown */}
          {showStartDropdown && startMatches.length > 0 && (
            <div className="airport-dropdown">
              {startMatches.map((a) => (
                <div
                  key={a.iata}
                  className="airport-dropdown-item"
                  onClick={() => {
                    onSelectStart(a.iata);
                    setStartQuery('');
                    setShowStartDropdown(false);
                  }}
                >
                  <span className="dropdown-iata origin">{a.iata}</span>
                  <div className="dropdown-info">
                    <div className="dropdown-city">{a.city}, {a.country}</div>
                    <div className="dropdown-name">{a.name}</div>
                  </div>
                  <span className="dropdown-routes">{a.routesCount} routes</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <button
          onClick={onSwap}
          disabled={disabled}
          title="Swap Departure and Destination"
          className="swap-airports-btn"
        >
          <Icons.Swap size={18} />
        </button>

        {/* Destination Airport */}
        <div className="dispatch-field">
          <label className="dispatch-label dest">
            <span className="dot dest-dot" /> ARRIVAL (DESTINATION)
          </label>
          <div className="airport-input-wrapper">
            <div className="iata-badge dest">{targetIata}</div>
            <input
              type="text"
              placeholder={currentTarget ? `${currentTarget.city} (${currentTarget.name})` : 'Search city or airport...'}
              value={targetQuery}
              onChange={(e) => {
                setTargetQuery(e.target.value);
                setShowTargetDropdown(true);
              }}
              onFocus={() => setShowTargetDropdown(true)}
              disabled={disabled}
              className="airport-text-input"
            />
            {targetQuery && (
              <button
                onClick={() => {
                  setTargetQuery('');
                  setShowTargetDropdown(false);
                }}
                className="clear-input-btn"
              >
                <Icons.Close size={14} />
              </button>
            )}
          </div>

          {/* Destination Dropdown */}
          {showTargetDropdown && targetMatches.length > 0 && (
            <div className="airport-dropdown">
              {targetMatches.map((a) => (
                <div
                  key={a.iata}
                  className="airport-dropdown-item"
                  onClick={() => {
                    onSelectTarget(a.iata);
                    setTargetQuery('');
                    setShowTargetDropdown(false);
                  }}
                >
                  <span className="dropdown-iata dest">{a.iata}</span>
                  <div className="dropdown-info">
                    <div className="dropdown-city">{a.city}, {a.country}</div>
                    <div className="dropdown-name">{a.name}</div>
                  </div>
                  <span className="dropdown-routes">{a.routesCount} routes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popular Route Chips */}
      <div className="preset-chips-row">
        <span className="preset-label">POPULAR ROUTES:</span>
        <div className="preset-chips">
          {PRESET_ROUTES.map((p) => {
            const isSelected = startIata === p.from && targetIata === p.to;
            return (
              <button
                key={`${p.from}-${p.to}`}
                onClick={() => {
                  onSelectStart(p.from);
                  onSelectTarget(p.to);
                }}
                disabled={disabled}
                className={`preset-chip ${isSelected ? 'active' : ''}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
