'use client';

import React from 'react';
import { RouteSummary } from '@/types/flight';
import { formatDistance, formatDuration, formatPrice } from '@/lib/geo';
import { Icons } from '../Common/Icons';

interface FlightItineraryProps {
  summary: RouteSummary | null;
}

export const FlightItinerary: React.FC<FlightItineraryProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="itinerary-card">
      <div className="itinerary-header">
        <div className="itinerary-title-row">
          <div className="itinerary-title">
            <Icons.Plane size={18} className="plane-icon" />
            <span>CONFIRMED FLIGHT ITINERARY</span>
          </div>
          <span className="stops-badge">
            {summary.transfersCount === 0
              ? 'Non-Stop Direct Flight'
              : `${summary.transfersCount} Stop${summary.transfersCount > 1 ? 's' : ''} Layover`}
          </span>
        </div>

        {/* Global Summary Stats */}
        <div className="itinerary-stats-row">
          <div className="stat-pill highlight-discovered">
            <span className="stat-label">AIRPORTS DISCOVERED</span>
            <div className="discovered-val-group">
              <span className="stat-value discovered">{summary.airportsDiscovered.toLocaleString()}</span>
              {summary.totalAirportsInNetwork > 0 && (
                <span className="stat-sub">
                  / {summary.totalAirportsInNetwork.toLocaleString()} ({Math.max(0.1, ((summary.airportsDiscovered / summary.totalAirportsInNetwork) * 100)).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="stat-pill">
            <span className="stat-label">TOTAL DISTANCE</span>
            <span className="stat-value">{formatDistance(summary.totalDistanceKm)}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">TRAVEL TIME</span>
            <span className="stat-value">{formatDuration(summary.totalDurationMinutes)}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">EST. FARE</span>
            <span className="stat-value price">{formatPrice(summary.totalPriceUsd)}</span>
          </div>
        </div>
      </div>

      {/* Legs List */}
      <div className="legs-list">
        {summary.legs.map((leg, index) => (
          <React.Fragment key={`${leg.from.iata}-${leg.to.iata}-${index}`}>
            {/* Flight Segment */}
            <div className="leg-card">
              <div className="leg-card-header">
                <span className="leg-flight-code">{leg.flightCode}</span>
                <span className="leg-dist-time">
                  {formatDistance(leg.distanceKm)} • {formatDuration(leg.durationMinutes)}
                </span>
                <span className="leg-price">{formatPrice(leg.priceUsd)}</span>
              </div>

              <div className="leg-airports-flow">
                <div className="leg-airport origin">
                  <span className="iata">{leg.from.iata}</span>
                  <div className="details">
                    <span className="city">{leg.from.city}</span>
                    <span className="name">{leg.from.name}</span>
                  </div>
                </div>

                <div className="leg-flight-line">
                  <div className="line" />
                  <Icons.Plane size={14} className="flight-arrow" />
                </div>

                <div className="leg-airport dest">
                  <span className="iata">{leg.to.iata}</span>
                  <div className="details">
                    <span className="city">{leg.to.city}</span>
                    <span className="name">{leg.to.name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Layover connecting card if not last leg */}
            {leg.layoverMinutes && (
              <div className="layover-card">
                <Icons.Clock size={14} />
                <span>
                  Connection Layover at <strong>{leg.to.city} ({leg.to.iata})</strong> •{' '}
                  {formatDuration(leg.layoverMinutes)} buffer
                </span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
