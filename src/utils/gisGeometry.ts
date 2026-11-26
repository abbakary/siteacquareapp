import {
  area as turfArea,
  centroid as turfCentroid,
  distance as turfDistance,
  kinks as turfKinks,
  length as turfLength,
  polygon as turfPolygon,
  polygonToLine,
} from '@turf/turf';
import {
  Farm,
  FarmInfrastructureMarker,
  GeoJsonPolygon,
  Language,
  MappingMethod,
  Pond,
} from '../types/aquaculture';

export interface GeometryMeasurementResult {
  valid: boolean;
  error?: string;
  areaSqm: number;
  waterSurfaceSqm: number;
  perimeterM: number;
  centerGps: [number, number]; // [lat, lng]
  pointsCount: number;
  polygonLatLng: [number, number][]; // Open ring [lat, lng]
  geometry: GeoJsonPolygon | null; // Closed GeoJSON [lng, lat]
  distanceFromFarmM?: number;
  warnings: string[];
}

/**
 * Converts Leaflet [lat, lng] points into a closed GeoJSON Polygon ring [[lng, lat], ...].
 * Ensures coordinate order is strictly [longitude, latitude] per RFC 7946.
 */
export function latLngsToGeoJsonPolygon(points: [number, number][]): GeoJsonPolygon | null {
  const clean = stripClosingDuplicate(points).filter(
    ([lat, lng]) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
  );
  if (clean.length < 3) return null;

  const ring: [number, number][] = clean.map(([lat, lng]) => [
    Number(lng.toFixed(7)),
    Number(lat.toFixed(7)),
  ]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

/**
 * Converts a GeoJSON Polygon (coordinates in [lng, lat]) to Leaflet open ring ([lat, lng]).
 */
export function geoJsonPolygonToLatLngs(geometry: GeoJsonPolygon): [number, number][] {
  const outer = geometry?.coordinates?.[0] || [];
  const latLngs: [number, number][] = outer.map(([lng, lat]) => [lat, lng]);
  return stripClosingDuplicate(latLngs);
}

export function stripClosingDuplicate(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-8 && Math.abs(first[1] - last[1]) < 1e-8) {
    return points.slice(0, -1);
  }
  return points;
}

/**
 * Measures and validates a polygon boundary using geodesic Turf.js calculations.
 * Rejects incomplete polygons (< 3 unique vertices), self-intersections (kinks),
 * unrealistic footprints, or geometries outside the authorized farm boundary radius.
 */
export function measureAndValidatePolygon(opts: {
  polygonLatLng: [number, number][];
  unitType?: Pond['unitType'];
  farmGps?: [number, number];
  maxRadiusM?: number;
  gpsAccuracyM?: number;
  language?: Language;
}): GeometryMeasurementResult {
  const lang = opts.language ?? 'sw';
  const warnings: string[] = [];
  const cleanLatLng = stripClosingDuplicate(opts.polygonLatLng).map(
    ([lat, lng]) => [Number(lat.toFixed(7)), Number(lng.toFixed(7))] as [number, number]
  );

  if (cleanLatLng.length < 3) {
    return {
      valid: false,
      error:
        lang === 'sw'
          ? 'Chora au rekodi angalau pembe 3 za mpaka ili kuunda umbo lililofungwa la bwawa.'
          : 'Draw or record at least 3 boundary corners to form a closed pond polygon.',
      areaSqm: 0,
      waterSurfaceSqm: 0,
      perimeterM: 0,
      centerGps: opts.farmGps || [-6.8664, 39.3278],
      pointsCount: cleanLatLng.length,
      polygonLatLng: cleanLatLng,
      geometry: null,
      warnings,
    };
  }

  for (const [lat, lng] of cleanLatLng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        valid: false,
        error:
          lang === 'sw'
            ? 'Mpaka una majira ya WGS84 yasiyo sahihi.'
            : 'Polygon contains invalid WGS84 coordinates.',
        areaSqm: 0,
        waterSurfaceSqm: 0,
        perimeterM: 0,
        centerGps: opts.farmGps || [-6.8664, 39.3278],
        pointsCount: cleanLatLng.length,
        polygonLatLng: cleanLatLng,
        geometry: null,
        warnings,
      };
    }
  }

  const geojson = latLngsToGeoJsonPolygon(cleanLatLng);
  if (!geojson) {
    return {
      valid: false,
      error:
        lang === 'sw'
          ? 'Imeshindikana kutengeneza umbo halali la GeoJSON.'
          : 'Could not construct a valid GeoJSON polygon ring.',
      areaSqm: 0,
      waterSurfaceSqm: 0,
      perimeterM: 0,
      centerGps: opts.farmGps || [-6.8664, 39.3278],
      pointsCount: cleanLatLng.length,
      polygonLatLng: cleanLatLng,
      geometry: null,
      warnings,
    };
  }

  try {
    const feature = turfPolygon(geojson.coordinates);
    const intersections = turfKinks(feature);
    if (intersections.features.length > 0) {
      return {
        valid: false,
        error:
          lang === 'sw'
            ? 'Mistari ya mpaka inakatana yenyewe. Buruta nukta za pembe ili mistari isipishane.'
            : 'Boundary lines cross each other (self-intersection detected). Drag vertices so edges do not overlap.',
        areaSqm: 0,
        waterSurfaceSqm: 0,
        perimeterM: 0,
        centerGps: opts.farmGps || [-6.8664, 39.3278],
        pointsCount: cleanLatLng.length,
        polygonLatLng: cleanLatLng,
        geometry: geojson,
        warnings,
      };
    }

    const areaSqm = Math.round(turfArea(feature) * 10) / 10;
    const outline = polygonToLine(feature);
    const perimeterKm = turfLength(outline, { units: 'kilometers' });
    const perimeterM = Math.round(perimeterKm * 1000 * 10) / 10;

    const centerFeature = turfCentroid(feature);
    const [centerLng, centerLat] = centerFeature.geometry.coordinates;
    const centerGps: [number, number] = [
      Number(centerLat.toFixed(6)),
      Number(centerLng.toFixed(6)),
    ];

    if (areaSqm < 4) {
      return {
        valid: false,
        error:
          lang === 'sw'
            ? `Eneo la umbo (${areaSqm} m²) ni dogo mno. Kiwango cha chini halali ni 4 m².`
            : `Polygon area (${areaSqm} m²) is too small. Minimum valid unit footprint is 4 m².`,
        areaSqm,
        waterSurfaceSqm: areaSqm,
        perimeterM,
        centerGps,
        pointsCount: cleanLatLng.length,
        polygonLatLng: cleanLatLng,
        geometry: geojson,
        warnings,
      };
    }

    if (areaSqm > 2_000_000) {
      return {
        valid: false,
        error:
          lang === 'sw'
            ? `Eneo (${areaSqm.toLocaleString()} m²) limezidi kikomo cha bwawa moja (hekta 200). Kuza ramani karibu zaidi kupima kwa usahihi.`
            : `Polygon area (${areaSqm.toLocaleString()} m²) exceeds maximum single production unit limit (200 ha). Zoom closer to map the pond accurately.`,
        areaSqm,
        waterSurfaceSqm: areaSqm,
        perimeterM,
        centerGps,
        pointsCount: cleanLatLng.length,
        polygonLatLng: cleanLatLng,
        geometry: geojson,
        warnings,
      };
    }

    let distanceFromFarmM: number | undefined;
    if (opts.farmGps) {
      const distKm = turfDistance(
        [opts.farmGps[1], opts.farmGps[0]],
        [centerGps[1], centerGps[0]],
        { units: 'kilometers' }
      );
      distanceFromFarmM = Math.round(distKm * 1000);
      const maxRadius = opts.maxRadiusM ?? 15000; // 15 km default farm cluster boundary
      if (distanceFromFarmM > maxRadius) {
        return {
          valid: false,
          error:
            lang === 'sw'
              ? `Bwawa liko umbali wa km ${(distanceFromFarmM / 1000).toFixed(2)} kutoka tawi la shamba lililochaguliwa (mpaka unaoruhusiwa: km ${(maxRadius / 1000).toFixed(1)}).`
              : `Mapped pond is ${(distanceFromFarmM / 1000).toFixed(2)} km away from the selected farm branch (authorized geofence: ${(maxRadius / 1000).toFixed(1)} km).`,
          areaSqm,
          waterSurfaceSqm: areaSqm,
          perimeterM,
          centerGps,
          pointsCount: cleanLatLng.length,
          polygonLatLng: cleanLatLng,
          geometry: geojson,
          distanceFromFarmM,
          warnings,
        };
      }
      if (distanceFromFarmM > 2000) {
        warnings.push(
          lang === 'sw'
            ? `Katikati ya bwawa iko km ${(distanceFromFarmM / 1000).toFixed(2)} kutoka ofisi kuu ya shamba.`
            : `Pond center is ${(distanceFromFarmM / 1000).toFixed(2)} km from the farm headquarters pin.`
        );
      }
    }

    if (typeof opts.gpsAccuracyM === 'number' && opts.gpsAccuracyM > 10) {
      warnings.push(
        lang === 'sw'
          ? `Usahihi wa GPS ulikuwa ±${Math.round(opts.gpsAccuracyM)} m. Kwa upimaji sahihi zaidi, rekebisha pembe kwenye satelaiti.`
          : `GPS accuracy was ±${Math.round(opts.gpsAccuracyM)} m. For legal or engineering surveys, verify corners on satellite imagery or use survey-grade GNSS.`
      );
    }

    // Water surface ratio: earthen/lined ponds have ~8% embankment slope allowance; tanks/cages ~100%
    const waterRatio =
      opts.unitType === 'Concrete Tank' || opts.unitType === 'Lake Cage' ? 0.98 : 0.92;
    const waterSurfaceSqm = Math.round(areaSqm * waterRatio * 10) / 10;

    return {
      valid: true,
      areaSqm,
      waterSurfaceSqm,
      perimeterM,
      centerGps,
      pointsCount: cleanLatLng.length,
      polygonLatLng: cleanLatLng,
      geometry: geojson,
      distanceFromFarmM,
      warnings,
    };
  } catch {
    return {
      valid: false,
      error:
        lang === 'sw'
          ? 'Imeshindikana kuchakata jiometri ya mpaka. Tafadhali chora upya.'
          : 'Unable to process polygon geometry. Please redraw the boundary.',
      areaSqm: 0,
      waterSurfaceSqm: 0,
      perimeterM: 0,
      centerGps: opts.farmGps || [-6.8664, 39.3278],
      pointsCount: cleanLatLng.length,
      polygonLatLng: cleanLatLng,
      geometry: null,
      warnings,
    };
  }
}

export function buildGeoJsonFeatureCollection(opts: {
  ponds: Pond[];
  farms: Farm[];
  infrastructureMarkers?: FarmInfrastructureMarker[];
  mappingMethodFilter?: MappingMethod;
}) {
  const features: Array<Record<string, unknown>> = [];

  for (const pond of opts.ponds) {
    if (opts.mappingMethodFilter && pond.mappingMethod !== opts.mappingMethodFilter) continue;
    const farm = opts.farms.find((f) => f.id === pond.farmId);
    const geometry = pond.geometry || latLngsToGeoJsonPolygon(pond.polygon);
    if (!geometry) continue;

    features.push({
      type: 'Feature',
      id: pond.id,
      properties: {
        featureType: 'production_unit',
        pond_id: pond.id,
        pond_code: pond.code,
        name: pond.name,
        farm_id: pond.farmId,
        farm_name: farm?.name || pond.farmId,
        unit_type: pond.unitType,
        operation_stage: pond.operationStage,
        species: pond.species,
        status: pond.status,
        current_fish: pond.currentFish,
        max_capacity: pond.maxCapacity,
        volume_m3: pond.waterCapacityM3,
        area_sqm: pond.areaSqm ?? null,
        water_surface_sqm: pond.waterSurfaceSqm ?? null,
        perimeter_m: pond.perimeterM ?? null,
        mapping_method: pond.mappingMethod || 'Registry Seed',
        boundary_verified: Boolean(pond.boundaryVerified),
        mapped_by: pond.mappedBy || null,
        mapped_at: pond.mappedAt || null,
      },
      geometry,
    });
  }

  for (const marker of opts.infrastructureMarkers || []) {
    features.push({
      type: 'Feature',
      id: marker.id,
      properties: {
        featureType: 'infrastructure',
        marker_id: marker.id,
        farm_id: marker.farmId,
        pond_code: marker.pondCode || null,
        infrastructure_type: marker.type,
        label: marker.label,
        status: marker.status || 'Operational',
        created_by: marker.createdBy,
        created_at: marker.createdAt,
      },
      geometry: {
        type: 'Point',
        coordinates: [marker.gps[1], marker.gps[0]], // RFC 7946 [lng, lat]
      },
    });
  }

  return {
    type: 'FeatureCollection',
    name: 'DukaAquSmart_Aquaculture_GIS',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    exportedAt: new Date().toISOString(),
    features,
  };
}
