import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'data');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Haversine distance in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Estimate flight time in minutes (cruise ~820 km/h + 40 min taxi/climb/descent)
function estimateFlightTime(distanceKm) {
  const cruiseSpeed = 820; // km/h
  const cruiseHours = distanceKm / cruiseSpeed;
  return Math.round(cruiseHours * 60 + 40);
}

// Estimate realistic ticket price in USD
function estimatePrice(distanceKm) {
  // Base fee $50 + ~$0.075 per km with slight curve
  const base = 50;
  const cost = base + Math.pow(distanceKm, 0.92) * 0.16;
  return Math.max(45, Math.round(cost));
}

// Simple CSV parser that handles quotes
function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let insideQuote = false;
    let field = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  console.log('✈️  Starting OpenFlights data processing...');

  const airportsUrl =
    'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';
  const routesUrl =
    'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';
  const landUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

  console.log('📥 Fetching airports.dat...');
  const airportsRes = await fetch(airportsUrl);
  const airportsCsv = await airportsRes.text();

  console.log('📥 Fetching routes.dat...');
  const routesRes = await fetch(routesUrl);
  const routesCsv = await routesRes.text();

  console.log('📥 Fetching land-110m.json...');
  const landRes = await fetch(landUrl);
  const landTopo = await landRes.json();

  console.log('⚙️  Parsing airports...');
  const airportRows = parseCsv(airportsCsv);
  const rawAirports = {};

  for (const row of airportRows) {
    if (row.length >= 8) {
      const [aid, name, city, country, iata, icao, latStr, lonStr] = row;
      const cleanIata = iata?.replace(/\\N/g, '').trim().toUpperCase();
      if (cleanIata && cleanIata.length === 3 && /^[A-Z]{3}$/.test(cleanIata)) {
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (!isNaN(lat) && !isNaN(lon)) {
          rawAirports[cleanIata] = {
            iata: cleanIata,
            icao: icao?.replace(/\\N/g, '').trim() || '',
            name: name?.trim() || cleanIata,
            city: city?.trim() || '',
            country: country?.trim() || '',
            lat: parseFloat(lat.toFixed(4)),
            lon: parseFloat(lon.toFixed(4)),
            routesCount: 0,
            incomingCount: 0,
          };
        }
      }
    }
  }
  console.log(`✓ Parsed ${Object.keys(rawAirports).length} valid IATA airports.`);

  console.log('⚙️  Parsing and building flight routes graph...');
  const routeRows = parseCsv(routesCsv);
  const forwardAdj = {};
  const backwardAdj = {};
  const routePairs = new Set();

  for (const row of routeRows) {
    if (row.length >= 5) {
      const [, , srcIataRaw, , dstIataRaw] = row;
      const src = srcIataRaw?.trim().toUpperCase();
      const dst = dstIataRaw?.trim().toUpperCase();

      if (src && dst && src !== dst && rawAirports[src] && rawAirports[dst]) {
        const pairKey = `${src}->${dst}`;
        if (!routePairs.has(pairKey)) {
          routePairs.add(pairKey);

          const srcAirport = rawAirports[src];
          const dstAirport = rawAirports[dst];
          const distance = haversineDistance(
            srcAirport.lat,
            srcAirport.lon,
            dstAirport.lat,
            dstAirport.lon
          );
          const timeMinutes = estimateFlightTime(distance);
          const price = estimatePrice(distance);

          if (!forwardAdj[src]) forwardAdj[src] = [];
          forwardAdj[src].push({
            dst,
            dist: distance,
            time: timeMinutes,
            price,
          });

          if (!backwardAdj[dst]) backwardAdj[dst] = [];
          backwardAdj[dst].push({
            src,
            dist: distance,
            time: timeMinutes,
            price,
          });

          srcAirport.routesCount += 1;
          dstAirport.incomingCount += 1;
        }
      }
    }
  }

  // Filter to keep connected airports (degree >= 1)
  const connectedAirports = {};
  for (const [iata, airport] of Object.entries(rawAirports)) {
    if (airport.routesCount > 0 || airport.incomingCount > 0) {
      connectedAirports[iata] = airport;
    }
  }

  console.log(
    `✓ Filtered to ${Object.keys(connectedAirports).length} connected commercial airports.`
  );
  console.log(`✓ Processed ${routePairs.size} unique directed commercial flight routes.`);

  // Identify Top Major Hubs (e.g. degree >= 20)
  const sortedByDegree = Object.values(connectedAirports).sort(
    (a, b) => b.routesCount + b.incomingCount - (a.routesCount + a.incomingCount)
  );
  const majorHubs = sortedByDegree.slice(0, 350).map((a) => a.iata);
  console.log(`✓ Identified ${majorHubs.length} major global flight hubs.`);

  // Process world land TopoJSON into GeoJSON
  console.log('⚙️  Converting world land TopoJSON to GeoJSON features...');
  const landGeoJson = topojson.feature(landTopo, landTopo.objects.land);

  // Filter subset for Major Hubs
  const majorHubSet = new Set(majorHubs);
  const hubAirports = {};
  const hubForwardAdj = {};
  const hubBackwardAdj = {};

  for (const iata of majorHubs) {
    hubAirports[iata] = connectedAirports[iata];
  }

  for (const [src, edges] of Object.entries(forwardAdj)) {
    if (majorHubSet.has(src)) {
      const filtered = edges.filter((e) => majorHubSet.has(e.dst));
      if (filtered.length > 0) {
        hubForwardAdj[src] = filtered;
      }
    }
  }

  for (const [dst, edges] of Object.entries(backwardAdj)) {
    if (majorHubSet.has(dst)) {
      const filtered = edges.filter((e) => majorHubSet.has(e.src));
      if (filtered.length > 0) {
        hubBackwardAdj[dst] = filtered;
      }
    }
  }

  // Write outputs
  console.log('💾 Writing files to public/data/...');
  fs.writeFileSync(
    path.join(outputDir, 'airports.json'),
    JSON.stringify(connectedAirports)
  );
  fs.writeFileSync(
    path.join(outputDir, 'routes.json'),
    JSON.stringify({ forward: forwardAdj, backward: backwardAdj })
  );
  fs.writeFileSync(
    path.join(outputDir, 'airports-hubs.json'),
    JSON.stringify(hubAirports)
  );
  fs.writeFileSync(
    path.join(outputDir, 'routes-hubs.json'),
    JSON.stringify({ forward: hubForwardAdj, backward: hubBackwardAdj })
  );
  fs.writeFileSync(
    path.join(outputDir, 'major-hubs.json'),
    JSON.stringify(majorHubs)
  );
  fs.writeFileSync(
    path.join(outputDir, 'world-land.json'),
    JSON.stringify(landGeoJson)
  );

  const airportsSize = (
    fs.statSync(path.join(outputDir, 'airports.json')).size / 1024
  ).toFixed(1);
  const routesSize = (
    fs.statSync(path.join(outputDir, 'routes.json')).size / 1024
  ).toFixed(1);
  const landSize = (
    fs.statSync(path.join(outputDir, 'world-land.json')).size / 1024
  ).toFixed(1);

  console.log(`✅ Success! Data pipeline complete:`);
  console.log(`   - airports.json: ${airportsSize} KB`);
  console.log(`   - routes.json:   ${routesSize} KB`);
  console.log(`   - world-land.json: ${landSize} KB`);
  console.log(`   - major-hubs.json: ${majorHubs.length} hubs`);
}

main().catch((err) => {
  console.error('❌ Error processing OpenFlights data:', err);
  process.exit(1);
});
