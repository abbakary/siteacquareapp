import { InfrastructureMarkerType, Language, MapViewMode } from '../types/aquaculture';
import { stripClosingDuplicate } from './gisGeometry';

export interface TileLayerDefinition {
  primaryUrl: string;
  overlayUrl?: string;
  attribution: string;
  maxZoom: number;
  providerName: string;
}

export function getMapTilerKey(): string {
  const key = import.meta.env.VITE_MAPTILER_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

export function getTileConfigForMode(mode: MapViewMode | 'map'): TileLayerDefinition {
  const mapTilerKey = getMapTilerKey();
  const normalized: MapViewMode = mode === 'map' ? 'street' : mode;

  if (mapTilerKey) {
    switch (normalized) {
      case 'satellite':
        return {
          primaryUrl: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${mapTilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
          maxZoom: 20,
          providerName: 'MapTiler Satellite',
        };
      case 'hybrid':
        return {
          primaryUrl: `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${mapTilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
          maxZoom: 20,
          providerName: 'MapTiler Hybrid',
        };
      case 'terrain':
        return {
          primaryUrl: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
          maxZoom: 19,
          providerName: 'MapTiler Terrain',
        };
      case 'infrastructure':
        return {
          primaryUrl: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${mapTilerKey}`,
          overlayUrl: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
          maxZoom: 20,
          providerName: 'MapTiler Infrastructure',
        };
      case 'street':
      default:
        return {
          primaryUrl: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
          maxZoom: 20,
          providerName: 'MapTiler Streets',
        };
    }
  }

  // Zero-config live satellite / hybrid / street / terrain tile fallbacks
  switch (normalized) {
    case 'satellite':
      return {
        primaryUrl:
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
        providerName: 'Esri World Imagery (Set VITE_MAPTILER_API_KEY for MapTiler)',
      };
    case 'hybrid':
      return {
        primaryUrl:
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        overlayUrl:
          'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
        providerName: 'Satellite + Labels (Hybrid)',
      };
    case 'terrain':
      return {
        primaryUrl: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenTopoMap (CC-BY-SA)',
        maxZoom: 17,
        providerName: 'OpenTopoMap Terrain',
      };
    case 'infrastructure':
      return {
        primaryUrl:
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Farm Infrastructure Digital Twin Overlay',
        maxZoom: 19,
        providerName: 'Farm Infrastructure Twin',
      };
    case 'street':
    default:
      return {
        primaryUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        providerName: 'OpenStreetMap',
      };
  }
}

export const INFRASTRUCTURE_META: Record<
  InfrastructureMarkerType,
  { color: string; shortCode: string; category: 'Water' | 'Power & Equipment' | 'Sensors & Security' }
> = {
  'Water Inlet': { color: '#0284c7', shortCode: 'IN', category: 'Water' },
  'Water Outlet': { color: '#0d9488', shortCode: 'OUT', category: 'Water' },
  'Drainage Channel': { color: '#0369a1', shortCode: 'DRN', category: 'Water' },
  Borehole: { color: '#2563eb', shortCode: 'BH', category: 'Water' },
  Pump: { color: '#4f46e5', shortCode: 'PMP', category: 'Power & Equipment' },
  Aerator: { color: '#0891b2', shortCode: 'AER', category: 'Power & Equipment' },
  'Water Sensor': { color: '#059669', shortCode: 'SEN', category: 'Sensors & Security' },
  Feeder: { color: '#d97706', shortCode: 'FDR', category: 'Power & Equipment' },
  Generator: { color: '#ea580c', shortCode: 'GEN', category: 'Power & Equipment' },
  Security: { color: '#475569', shortCode: 'SEC', category: 'Sensors & Security' },
};

/**
 * Parses a GPX XML file (<trkpt>, <rtept>, or <wpt>) into Leaflet [lat, lng][] coordinates.
 */
export function parseGpxToPolygonLatLngs(
  xmlText: string,
  language: Language = 'sw'
): {
  ok: boolean;
  points: [number, number][];
  name?: string;
  error?: string;
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) {
      return {
        ok: false,
        points: [],
        error: language === 'sw' ? 'Faili la GPX XML si sahihi.' : 'Invalid GPX XML file.',
      };
    }

    const nameEl = doc.querySelector('trk > name, rte > name, metadata > name');
    const trkPts = Array.from(doc.querySelectorAll('trkpt'));
    const rtePts = Array.from(doc.querySelectorAll('rtept'));
    const wptPts = Array.from(doc.querySelectorAll('wpt'));

    const source = trkPts.length >= 3 ? trkPts : rtePts.length >= 3 ? rtePts : wptPts;
    const points: [number, number][] = [];

    for (const el of source) {
      const lat = parseFloat(el.getAttribute('lat') || '');
      const lon = parseFloat(el.getAttribute('lon') || '');
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push([lat, lon]);
      }
    }

    const cleaned = stripClosingDuplicate(points);
    if (cleaned.length < 3) {
      return {
        ok: false,
        points: [],
        error:
          language === 'sw'
            ? 'Faili la GPX lazima liwe na angalau nukta 3 halali za mpaka.'
            : 'GPX file must contain at least 3 valid track, route, or waypoint coordinates.',
      };
    }

    return {
      ok: true,
      points: cleaned,
      name: nameEl?.textContent?.trim() || undefined,
    };
  } catch {
    return {
      ok: false,
      points: [],
      error: language === 'sw' ? 'Imeshindikana kusoma faili la GPX.' : 'Failed to parse GPX file.',
    };
  }
}

/**
 * Parses a GeoJSON file (Polygon, MultiPolygon, Feature, or FeatureCollection)
 * converting GeoJSON [lng, lat] order into Leaflet [lat, lng] polygons.
 */
export function parseGeoJsonToPolygonLatLngs(
  jsonText: string,
  language: Language = 'sw'
): {
  ok: boolean;
  polygons: Array<{ name?: string; points: [number, number][] }>;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const polygons: Array<{ name?: string; points: [number, number][] }> = [];

    const extractGeometry = (geom: Record<string, unknown> | null | undefined, name?: string) => {
      if (!geom || typeof geom !== 'object') return;
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        const ring = (geom.coordinates[0] as unknown[]) || [];
        const pts: [number, number][] = [];
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            const lng = Number(coord[0]);
            const lat = Number(coord[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              pts.push([lat, lng]);
            }
          }
        }
        const cleaned = stripClosingDuplicate(pts);
        if (cleaned.length >= 3) polygons.push({ name, points: cleaned });
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        const firstPoly = (geom.coordinates[0] as unknown[]) || [];
        const ring = (firstPoly[0] as unknown[]) || [];
        const pts: [number, number][] = [];
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            const lng = Number(coord[0]);
            const lat = Number(coord[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              pts.push([lat, lng]);
            }
          }
        }
        const cleaned = stripClosingDuplicate(pts);
        if (cleaned.length >= 3) polygons.push({ name, points: cleaned });
      }
    };

    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      for (const feat of parsed.features) {
        if (feat && typeof feat === 'object') {
          const f = feat as Record<string, unknown>;
          const props = (f.properties || {}) as Record<string, unknown>;
          const label =
            typeof props.pond_code === 'string'
              ? props.pond_code
              : typeof props.name === 'string'
                ? props.name
                : undefined;
          extractGeometry(f.geometry as Record<string, unknown>, label);
        }
      }
    } else if (parsed.type === 'Feature') {
      const props = (parsed.properties || {}) as Record<string, unknown>;
      const label =
        typeof props.pond_code === 'string'
          ? props.pond_code
          : typeof props.name === 'string'
            ? props.name
            : undefined;
      extractGeometry(parsed.geometry as Record<string, unknown>, label);
    } else {
      extractGeometry(parsed);
    }

    if (polygons.length === 0) {
      return {
        ok: false,
        polygons: [],
        error:
          language === 'sw'
            ? 'Hakuna mipaka halali ya Polygon au MultiPolygon ndani ya faili la GeoJSON.'
            : 'No valid Polygon or MultiPolygon features found in the GeoJSON file.',
      };
    }

    return { ok: true, polygons };
  } catch {
    return {
      ok: false,
      polygons: [],
      error: language === 'sw' ? 'Muundo wa GeoJSON si sahihi.' : 'Invalid GeoJSON syntax.',
    };
  }
}

export function downloadGeoJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
