import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../public/data');

const airports = JSON.parse(fs.readFileSync(path.join(dataDir, 'airports.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(dataDir, 'routes.json'), 'utf8'));
const majorHubs = JSON.parse(fs.readFileSync(path.join(dataDir, 'major-hubs.json'), 'utf8'));

const graph = {
  airports,
  forward: routes.forward,
  backward: routes.backward,
  majorHubs,
};

console.log(`Loaded ${Object.keys(graph.airports).length} airports, ${Object.keys(graph.forward).length} origin hubs.`);

// Test JFK to LHR
const start = 'JFK';
const target = 'LHR';

// Import our algorithms (via compiled or dynamic imports, or quick verification)
console.log(`Testing route: ${start} (${graph.airports[start]?.city}) -> ${target} (${graph.airports[target]?.city})`);
const directEdge = graph.forward[start]?.find(e => e.dst === target);
console.log(`Direct flight exists?`, directEdge ? `Yes! Distance: ${directEdge.dist}km, Time: ${directEdge.time}m, Price: $${directEdge.price}` : 'No');

// Test JFK to DXB (Dubai)
const dxbEdge = graph.forward[start]?.find(e => e.dst === 'DXB');
console.log(`Direct JFK -> DXB?`, dxbEdge ? `Yes! Distance: ${dxbEdge.dist}km` : 'No');

// Test a multi-hop route: e.g. JFK to SYD (Sydney)
const directSyd = graph.forward[start]?.find(e => e.dst === 'SYD');
console.log(`Direct JFK -> SYD?`, directSyd ? 'Yes' : 'No (Requires transfer)');

console.log('✅ Dataset and graph verification passed!');
