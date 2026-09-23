import { Airport, FlightGraph, ItineraryLeg, RouteSummary } from '@/types/flight';
import { haversineDistance } from './geo';

const AIRLINE_PREFIXES = ['AA', 'BA', 'EK', 'DL', 'UA', 'LH', 'AF', 'SQ', 'JL', 'QR', 'CX'];

function generateFlightCode(fromIata: string, toIata: string, index: number): string {
  const hash = (fromIata.charCodeAt(0) * 31 + toIata.charCodeAt(1) * 17 + index * 101) % 900 + 100;
  const prefix = AIRLINE_PREFIXES[(fromIata.charCodeAt(0) + index) % AIRLINE_PREFIXES.length];
  return `${prefix} ${hash}`;
}

export function buildRouteSummary(
  graph: FlightGraph,
  path: string[],
  airportsDiscovered: number = 0,
  totalAirportsInNetwork: number = 0,
  algorithmName?: string,
  searchDurationMs?: number
): RouteSummary | null {
  if (!path || path.length < 2) return null;

  const airports: Airport[] = [];
  for (const iata of path) {
    const a = graph.airports[iata];
    if (a) airports.push(a);
  }

  if (airports.length < 2) return null;

  const legs: ItineraryLeg[] = [];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let totalPriceUsd = 0;

  for (let i = 0; i < airports.length - 1; i++) {
    const from = airports[i];
    const to = airports[i + 1];

    // Find actual edge in graph forward list if available
    const edge = graph.forward[from.iata]?.find((e) => e.dst === to.iata);
    const dist = edge ? edge.dist : haversineDistance(from.lat, from.lon, to.lat, to.lon);
    const cruiseHours = dist / 820;
    const duration = edge ? edge.time : Math.round(cruiseHours * 60 + 40);
    const price = edge ? edge.price : Math.round(50 + Math.pow(dist, 0.92) * 0.16);

    const isLastLeg = i === airports.length - 2;
    const layoverMinutes = isLastLeg ? undefined : 105; // ~1h 45m standard hub transfer

    legs.push({
      legIndex: i + 1,
      from,
      to,
      flightCode: generateFlightCode(from.iata, to.iata, i),
      distanceKm: dist,
      durationMinutes: duration,
      priceUsd: price,
      layoverMinutes,
    });

    totalDistanceKm += dist;
    totalDurationMinutes += duration + (layoverMinutes || 0);
    totalPriceUsd += price;
  }

  return {
    path,
    airports,
    legs,
    totalDistanceKm,
    totalDurationMinutes,
    totalPriceUsd,
    transfersCount: legs.length - 1,
    airportsDiscovered: airportsDiscovered || airports.length,
    totalAirportsInNetwork: totalAirportsInNetwork || Object.keys(graph.airports).length,
    algorithmName,
    searchDurationMs,
  };
}
