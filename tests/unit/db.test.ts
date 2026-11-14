import {
  validateCoordinates,
  validateBoundingBox,
  toPointWkt,
  crossesAntimeridian,
  getBoundingBoxEnvelopes,
  createPointGeographySql,
  createBoundingBoxWhereClause,
  BoundingBox,
} from "../../src/lib/db";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedTests++;
    console.log(`  âœ“ ${message}`);
  } else {
    failedTests++;
    console.error(`  âœ— FAIL: ${message}`);
  }
}

function assertThrows(fn: () => void, message: string) {
  try {
    fn();
    failedTests++;
    console.error(`  âœ— FAIL: Expected exception not thrown: ${message}`);
  } catch {
    passedTests++;
    console.log(`  âœ“ ${message}`);
  }
}

console.log("\n=======================================================");
console.log("Running Unit Tests for src/lib/db.ts (PostGIS Helpers)");
console.log("=======================================================\n");

// 1. Coordinate Validation Tests
console.log("Test Suite 1: Coordinate Validation");
assert(validateCoordinates(0, 0), "Coordinates (0, 0) are valid");
assert(validateCoordinates(75.9822, 11.0734), "Malappuram coordinates are valid");
assert(validateCoordinates(-180, -90), "Boundary [-180, -90] is valid");
assert(validateCoordinates(180, 90), "Boundary [180, 90] is valid");

assert(!validateCoordinates(180.001, 0), "Longitude > 180 is rejected");
assert(!validateCoordinates(-180.001, 0), "Longitude < -180 is rejected");
assert(!validateCoordinates(0, 90.001), "Latitude > 90 is rejected");
assert(!validateCoordinates(0, -90.001), "Latitude < -90 is rejected");

assert(!validateCoordinates(NaN, 10), "NaN longitude is rejected");
assert(!validateCoordinates(10, NaN), "NaN latitude is rejected");
assert(!validateCoordinates(Infinity, 10), "Infinity longitude is rejected");
assert(!validateCoordinates(10, -Infinity), "-Infinity latitude is rejected");
assert(!validateCoordinates("75" as unknown as number, 10), "String longitude is rejected");
assert(!validateCoordinates(null as unknown as number, 10), "Null longitude is rejected");
assert(!validateCoordinates(undefined as unknown as number, 10), "Undefined longitude is rejected");

// 2. toPointWkt Tests
console.log("\nTest Suite 2: toPointWkt Formatting");
assert(toPointWkt(75.98, 11.07) === "POINT(75.98 11.07)", "WKT POINT formatted correctly");
assert(toPointWkt(-122.4194, 37.7749) === "POINT(-122.4194 37.7749)", "WKT with negative coords formatted correctly");
assertThrows(() => toPointWkt(200, 45), "toPointWkt throws on invalid longitude");
assertThrows(() => toPointWkt(NaN, 45), "toPointWkt throws on NaN");
assertThrows(() => toPointWkt(45, Infinity), "toPointWkt throws on Infinity");

// 3. Bounding Box Validation Tests
console.log("\nTest Suite 3: Bounding Box Validation");
const validStandardBox: BoundingBox = { minLon: 75.0, minLat: 10.0, maxLon: 77.0, maxLat: 12.0 };
assert(validateBoundingBox(validStandardBox), "Standard bounding box is valid");

const validAntimeridianBox: BoundingBox = { minLon: 175.0, minLat: -20.0, maxLon: -175.0, maxLat: -10.0 };
assert(validateBoundingBox(validAntimeridianBox), "Antimeridian crossing bounding box is valid");

const invertedLatBox: BoundingBox = { minLon: 75.0, minLat: 15.0, maxLon: 77.0, maxLat: 10.0 };
assert(!validateBoundingBox(invertedLatBox), "Inverted latitude bounds (minLat > maxLat) rejected");

const outOfBoundsLat: BoundingBox = { minLon: 75.0, minLat: -95.0, maxLon: 77.0, maxLat: 10.0 };
assert(!validateBoundingBox(outOfBoundsLat), "Out of bounds latitude (< -90) rejected");

const outOfBoundsLon: BoundingBox = { minLon: -185.0, minLat: 10.0, maxLon: 77.0, maxLat: 12.0 };
assert(!validateBoundingBox(outOfBoundsLon), "Out of bounds longitude (< -180) rejected");

const nanBox: BoundingBox = { minLon: NaN, minLat: 10.0, maxLon: 77.0, maxLat: 12.0 };
assert(!validateBoundingBox(nanBox), "Bounding box with NaN rejected");

const infBox: BoundingBox = { minLon: 75.0, minLat: -Infinity, maxLon: 77.0, maxLat: 12.0 };
assert(!validateBoundingBox(infBox), "Bounding box with Infinity rejected");

// 4. Antimeridian Detection and Envelope Splitting Tests
console.log("\nTest Suite 4: Antimeridian Splitting");
assert(!crossesAntimeridian(validStandardBox), "Standard box does not cross antimeridian");
assert(crossesAntimeridian(validAntimeridianBox), "Antimeridian box correctly identified");

const standardEnvelopes = getBoundingBoxEnvelopes(validStandardBox);
assert(standardEnvelopes.length === 1, "Standard box returns exactly 1 envelope");
assert(
  standardEnvelopes[0].minLon === 75.0 && standardEnvelopes[0].maxLon === 77.0,
  "Standard envelope matches original bounds"
);

const splitEnvelopes = getBoundingBoxEnvelopes(validAntimeridianBox);
assert(splitEnvelopes.length === 2, "Antimeridian box splits into exactly 2 envelopes");
assert(
  splitEnvelopes[0].minLon === 175.0 &&
    splitEnvelopes[0].maxLon === 180 &&
    splitEnvelopes[0].minLat === -20.0 &&
    splitEnvelopes[0].maxLat === -10.0,
  "Eastern hemisphere envelope correctly capped at 180Â°"
);
assert(
  splitEnvelopes[1].minLon === -180 &&
    splitEnvelopes[1].maxLon === -175.0 &&
    splitEnvelopes[1].minLat === -20.0 &&
    splitEnvelopes[1].maxLat === -10.0,
  "Western hemisphere envelope correctly begins at -180Â°"
);

assertThrows(() => getBoundingBoxEnvelopes(invertedLatBox), "getBoundingBoxEnvelopes throws on invalid box");

// 5. Parameterized SQL Template Query Builders
console.log("\nTest Suite 5: Parameterized Spatial SQL Templates");
const pointSql = createPointGeographySql(75.98, 11.07);
assert(pointSql.values.length === 2, "createPointGeographySql uses parameterized values array");
assert(pointSql.values[0] === 75.98 && pointSql.values[1] === 11.07, "Parameters preserved safely without injection");

const standardWhereClause = createBoundingBoxWhereClause(validStandardBox);
assert(standardWhereClause.values.length === 4, "Standard bounding box uses 4 parameterized envelope values");

const antimeridianWhereClause = createBoundingBoxWhereClause(validAntimeridianBox);
assert(
  antimeridianWhereClause.values.length === 8,
  "Antimeridian bounding box uses 8 parameterized values (4 per envelope) joined with OR"
);

console.log("\n=======================================================");
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log("=======================================================\n");

if (failedTests > 0) {
  process.exit(1);
}
