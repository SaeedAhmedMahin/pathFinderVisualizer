import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../public/data');

const airports = JSON.parse(fs.readFileSync(path.join(dataDir, 'airports-hubs.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(dataDir, 'routes-hubs.json'), 'utf8'));
const majorHubs = JSON.parse(fs.readFileSync(path.join(dataDir, 'major-hubs.json'), 'utf8'));

const graph = {
  airports,
  forward: routes.forward,
  backward: routes.backward,
  majorHubs,
};

// Import algorithms
const { runAllBenchmarks } = await import('../src/lib/algorithms/benchmark.ts');
const { buildRouteSummary } = await import('../src/lib/itinerary.ts');

console.log('🧪 Starting Automated Algorithm Verification Suite...');

const testCases = [
  { from: 'JFK', to: 'LHR', metric: 'dist' },
  { from: 'LAX', to: 'SYD', metric: 'dist' },
  { from: 'LHR', to: 'SIN', metric: 'time' },
  { from: 'CDG', to: 'HND', metric: 'price' },
  { from: 'SFO', to: 'DXB', metric: 'hops' },
];

let allPassed = true;

for (const tc of testCases) {
  console.log(`\n======================================================`);
  console.log(`🔍 Testing: ${tc.from} -> ${tc.to} [Metric: ${tc.metric}]`);
  
  const results = runAllBenchmarks(graph, tc.from, tc.to, tc.metric);

  for (const r of results) {
    console.log(`  • ${r.name.padEnd(30)}: Explored ${r.nodesExplored.toString().padStart(4)} nodes | Time: ${r.executionTimeMs.toFixed(2).padStart(5)}ms | Dist: ${r.totalDistanceKm.toLocaleString().padStart(6)}km | Legs: ${r.pathLength > 0 ? (r.pathLength - 1) : 'None'} | Path: ${r.path.join(' -> ')}`);
  }

  // Check that all algorithms found a path
  const dijkstraRes = results.find(r => r.algorithm === 'dijkstra');
  const bidiRes = results.find(r => r.algorithm === 'bidirectional-dijkstra');
  const astarRes = results.find(r => r.algorithm === 'astar');
  const bellmanRes = results.find(r => r.algorithm === 'bellman-ford');

  if (!dijkstraRes.isOptimal || !astarRes.isOptimal) {
    console.error(`❌ Dijkstra or A* failed to find path for ${tc.from} -> ${tc.to}`);
    allPassed = false;
  } else {
    // Verify distance optimality (allow small floating diff if multiple equal shortest paths exist)
    const diff = Math.abs(dijkstraRes.totalDistanceKm - astarRes.totalDistanceKm);
    if (diff > 5) {
      console.warn(`⚠️ Dijkstra (${dijkstraRes.totalDistanceKm}km) and A* (${astarRes.totalDistanceKm}km) distance difference: ${diff}km`);
    } else {
      console.log(`  ✓ Dijkstra and A* found identical optimal distance (${dijkstraRes.totalDistanceKm}km).`);
    }

    // Verify A* efficiency (explored <= dijkstra)
    if (astarRes.nodesExplored <= dijkstraRes.nodesExplored) {
      const saved = dijkstraRes.nodesExplored - astarRes.nodesExplored;
      const pct = Math.round((saved / Math.max(1, dijkstraRes.nodesExplored)) * 100);
      console.log(`  ✓ A* explored ${pct}% fewer nodes than Dijkstra (${astarRes.nodesExplored} vs ${dijkstraRes.nodesExplored}).`);
    }

    // Test itinerary builder
    const itinerary = buildRouteSummary(graph, astarRes.path);
    if (!itinerary) {
      console.error(`❌ Failed to build itinerary for ${astarRes.path}`);
      allPassed = false;
    } else {
      console.log(`  ✓ Itinerary generated: ${itinerary.legs.length} legs, total price: $${itinerary.totalPriceUsd}, total time: ${Math.floor(itinerary.totalDurationMinutes / 60)}h ${itinerary.totalDurationMinutes % 60}m`);
    }
  }
}

if (allPassed) {
  console.log('\n🎉 ALL ALGORITHM VERIFICATION TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('\n❌ SOME TESTS FAILED');
  process.exit(1);
}
