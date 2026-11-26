import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Edit3,
  Footprints,
  MapPin,
  MousePointerClick,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  AquacultureState,
  FarmInfrastructureMarker,
  GeoJsonPolygon,
  GpsTrackPoint,
  InfrastructureMarkerType,
  MappingMethod,
  OperationType,
  Pond,
  PondBoundarySource,
} from '../../types/aquaculture';
import { Button, Card, FormError, INPUT_CLASS } from '../../ui';
import {
  getTileConfigForMode,
  INFRASTRUCTURE_META,
  parseGeoJsonToPolygonLatLngs,
  parseGpxToPolygonLatLngs,
} from '../../utils/gis';
import {
  GeometryMeasurementResult,
  measureAndValidatePolygon,
  stripClosingDuplicate,
} from '../../utils/gisGeometry';
import { GuidedGpsWalkPanel } from './GuidedGpsWalkPanel';

export interface DraftInfraMarker {
  id: string;
  type: InfrastructureMarkerType;
  label: string;
  gps: [number, number];
}

export interface SavePondGisPayload {
  editingPondId?: string;
  code: string;
  name: string;
  farmId: string;
  unitType: Pond['unitType'];
  operationStage: OperationType;
  species: string;
  maxCapacity: number;
  dimensions: string;
  waterCapacityM3: number;
  waterSource: string;
  drainageSystem: string;
  gps: [number, number];
  polygon: [number, number][];
  geometry: GeoJsonPolygon;
  rawGpsTrack?: GpsTrackPoint[];
  boundarySource: PondBoundarySource;
  areaSqm: number;
  waterSurfaceSqm: number;
  perimeterM: number;
  boundaryPointsCount: number;
  mappingMethod: MappingMethod;
  gpsAccuracyM?: number;
  boundaryVerified: boolean;
  infraMarkers: DraftInfraMarker[];
}

interface PondRegistrationWorkspaceProps {
  state: AquacultureState;
  defaultFarmId: string;
  editingPond?: Pond | null;
  onCancel: () => void;
  onSavePond: (payload: SavePondGisPayload) => { ok: boolean; error?: string };
}

const INFRA_TYPES: InfrastructureMarkerType[] = [
  'Water Inlet',
  'Water Outlet',
  'Aerator',
  'Water Sensor',
  'Pump',
  'Borehole',
  'Drainage Channel',
  'Feeder',
];

export const PondRegistrationWorkspace: React.FC<PondRegistrationWorkspaceProps> = ({
  state,
  defaultFarmId,
  editingPond,
  onCancel,
  onSavePond,
}) => {
  const initialFarmId =
    editingPond?.farmId ||
    (defaultFarmId !== 'all' && state.farms.some((f) => f.id === defaultFarmId)
      ? defaultFarmId
      : state.farms[0].id);

  const [code, setCode] = useState(
    editingPond?.code || `POND-${String(state.ponds.length + 1).padStart(3, '0')}`
  );
  const [name, setName] = useState(editingPond?.name || `Pond ${state.ponds.length + 1}`);
  const [farmId, setFarmId] = useState(initialFarmId);
  const [unitType, setUnitType] = useState<Pond['unitType']>(editingPond?.unitType || 'Lined Pond');
  const [operationStage, setOperationStage] = useState<OperationType>(
    editingPond?.operationStage || 'Grow-out Pond'
  );
  const [species, setSpecies] = useState(editingPond?.species || 'Nile Tilapia');
  const [maxCapacity, setMaxCapacity] = useState(editingPond?.maxCapacity ?? 12000);
  const [waterCapacityM3, setWaterCapacityM3] = useState(editingPond?.waterCapacityM3 ?? 900);
  const [dimensions, setDimensions] = useState(editingPond?.dimensions || '30m × 20m × 1.5m');

  const selectedFarm = useMemo(
    () => state.farms.find((f) => f.id === farmId) || state.farms[0],
    [state.farms, farmId]
  );

  // Simple capture method: 'walk' or 'map'
  const [captureMethod, setCaptureMethod] = useState<'walk' | 'map'>(
    editingPond?.boundarySource === 'GPS_WALK' ? 'walk' : 'map'
  );
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street'>('satellite');
  const [activeMapTool, setActiveMapTool] = useState<'none' | 'tap' | 'rect' | 'adjust' | 'infra'>('none');
  const [infraTypeToPlace, setInfraTypeToPlace] = useState<InfrastructureMarkerType>('Water Inlet');

  const [drawnPolygon, setDrawnPolygon] = useState<[number, number][]>(editingPond?.polygon || []);
  const [rawGpsTrack, setRawGpsTrack] = useState<GpsTrackPoint[] | undefined>(
    editingPond?.rawGpsTrack
  );
  const [boundarySource, setBoundarySource] = useState<PondBoundarySource>(
    editingPond?.boundarySource || 'MAP_EDIT'
  );
  const [mappingMethod, setMappingMethod] = useState<MappingMethod>(
    editingPond?.mappingMethod || 'Satellite Drawing'
  );
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | undefined>(editingPond?.gpsAccuracyM);
  const [measurement, setMeasurement] = useState<GeometryMeasurementResult | null>(() => {
    if (!editingPond?.polygon || editingPond.polygon.length < 3) return null;
    return measureAndValidatePolygon({
      polygonLatLng: editingPond.polygon,
      unitType: editingPond.unitType,
      farmGps: selectedFarm?.gps,
      maxRadiusM: selectedFarm?.authorizedRadiusM || 15000,
    });
  });

  const [draftInfraMarkers, setDraftInfraMarkers] = useState<DraftInfraMarker[]>(() => {
    if (!editingPond) return [];
    return (state.infrastructureMarkers || [])
      .filter((m: FarmInfrastructureMarker) => m.pondCode === editingPond.code || m.pondId === editingPond.id)
      .map((m) => ({ id: m.id, type: m.type, label: m.label, gps: m.gps }));
  });

  const [formMsg, setFormMsg] = useState('');
  const [formShake, setFormShake] = useState(0);
  const [saving, setSaving] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const refPondsGroupRef = useRef<L.LayerGroup | null>(null);
  const walkGroupRef = useRef<L.LayerGroup | null>(null);
  const infraGroupRef = useRef<L.LayerGroup | null>(null);
  const activePolyLayerRef = useRef<L.Polygon | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeToolRef = useRef(activeMapTool);
  activeToolRef.current = activeMapTool;
  const infraTypeRef = useRef(infraTypeToPlace);
  infraTypeRef.current = infraTypeToPlace;
  const unitTypeRef = useRef(unitType);
  unitTypeRef.current = unitType;
  const farmGpsRef = useRef(selectedFarm?.gps);
  farmGpsRef.current = selectedFarm?.gps;
  const maxRadiusRef = useRef(selectedFarm?.authorizedRadiusM || 15000);
  maxRadiusRef.current = selectedFarm?.authorizedRadiusM || 15000;

  const extractLatLngsFromLayer = (layer: L.Polygon): [number, number][] => {
    const raw = layer.getLatLngs();
    const ring = Array.isArray(raw[0]) ? (raw[0] as L.LatLng[]) : (raw as L.LatLng[]);
    return stripClosingDuplicate(
      ring.map((ll) => [Number(ll.lat.toFixed(7)), Number(ll.lng.toFixed(7))] as [number, number])
    );
  };

  const evaluatePolygon = useCallback(
    (pts: [number, number][], acc?: number) => {
      setDrawnPolygon(pts);
      if (pts.length < 3) {
        setMeasurement(null);
        return;
      }
      const m = measureAndValidatePolygon({
        polygonLatLng: pts,
        unitType: unitTypeRef.current,
        farmGps: farmGpsRef.current,
        maxRadiusM: maxRadiusRef.current,
        gpsAccuracyM: acc,
      });
      setMeasurement(m);
      setFormMsg('');
    },
    []
  );

  const attachPolygonToMap = useCallback(
    (
      pts: [number, number][],
      opts?: {
        source?: PondBoundarySource;
        method?: MappingMethod;
        accuracy?: number;
        fit?: boolean;
      }
    ) => {
      const map = mapRef.current;
      if (!map) return;

      if (activePolyLayerRef.current) {
        map.removeLayer(activePolyLayerRef.current);
        activePolyLayerRef.current = null;
      }

      if (pts.length >= 3) {
        const poly = L.polygon(pts, {
          color: '#0284c7',
          weight: 3,
          fillColor: '#38bdf8',
          fillOpacity: 0.28,
        }).addTo(map);

        poly.on('pm:edit', () => {
          const updated = extractLatLngsFromLayer(poly);
          evaluatePolygon(updated, opts?.accuracy);
        });
        poly.on('pm:dragend', () => {
          const updated = extractLatLngsFromLayer(poly);
          evaluatePolygon(updated, opts?.accuracy);
        });

        activePolyLayerRef.current = poly;
        if (opts?.fit) {
          map.fitBounds(poly.getBounds(), { padding: [45, 45], maxZoom: 19 });
        }
      }

      if (opts?.source) setBoundarySource(opts.source);
      if (opts?.method) setMappingMethod(opts.method);
      if (opts?.accuracy !== undefined) setGpsAccuracyM(opts.accuracy);
      evaluatePolygon(pts, opts?.accuracy);
    },
    [evaluatePolygon]
  );

  // Initialize Satellite Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: selectedFarm?.gps || [-6.8664, 39.3278],
      zoom: 18,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: true,
    });

    refPondsGroupRef.current = L.layerGroup().addTo(map);
    walkGroupRef.current = L.layerGroup().addTo(map);
    infraGroupRef.current = L.layerGroup().addTo(map);

    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 15,
      allowSelfIntersection: false,
      templineStyle: { color: '#0284c7', weight: 2.5 },
      hintlineStyle: { color: '#0284c7', dashArray: [5, 5], weight: 2 },
    });

    map.on('pm:create', (e: { layer: L.Layer }) => {
      if (e.layer instanceof L.Polygon) {
        const pts = extractLatLngsFromLayer(e.layer);
        map.removeLayer(e.layer);
        attachPolygonToMap(pts, {
          source: 'MAP_EDIT',
          method: 'Satellite Drawing',
        });
        setActiveMapTool('none');
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (activeToolRef.current !== 'infra') return;
      const type = infraTypeRef.current;
      setDraftInfraMarkers((prev) => [
        ...prev,
        {
          id: `inf-draft-${Date.now()}`,
          type,
          label: type,
          gps: [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))],
        },
      ]);
      setActiveMapTool('none');
    });

    mapRef.current = map;

    if (editingPond?.polygon && editingPond.polygon.length >= 3) {
      attachPolygonToMap(editingPond.polygon, {
        source: editingPond.boundarySource || 'MAP_EDIT',
        method: editingPond.mappingMethod || 'Satellite Drawing',
        accuracy: editingPond.gpsAccuracyM,
        fit: true,
      });
    }

    const timer = window.setTimeout(() => map.invalidateSize(), 160);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile switcher
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const cfg = getTileConfigForMode(mapStyle);
    tileRef.current = L.tileLayer(cfg.primaryUrl, {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [mapStyle]);

  // Auto-zoom when farm selection changes
  const prevFarmRef = useRef(farmId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFarm) return;
    if (prevFarmRef.current !== farmId) {
      prevFarmRef.current = farmId;
      map.flyTo(selectedFarm.gps, 18, { duration: 0.65 });
    }
  }, [farmId, selectedFarm]);

  // Recompute measurements & geofence checks if unitType or farmId changes on a drawn polygon
  useEffect(() => {
    if (drawnPolygon.length >= 3) {
      evaluatePolygon(drawnPolygon, gpsAccuracyM);
    }
  }, [unitType, farmId, drawnPolygon, gpsAccuracyM, evaluatePolygon]);

  // Show neighboring ponds faintly for visual context
  useEffect(() => {
    const group = refPondsGroupRef.current;
    if (!group) return;
    group.clearLayers();
    state.ponds
      .filter((p) => p.farmId === farmId && p.id !== editingPond?.id)
      .forEach((pond) => {
        if (pond.polygon && pond.polygon.length >= 3) {
          const ref = L.polygon(pond.polygon, {
            color: '#f8fafc',
            weight: 1.5,
            dashArray: '4 4',
            fillColor: '#10b981',
            fillOpacity: 0.16,
          }).addTo(group);
          ref.bindTooltip(pond.code, {
            permanent: true,
            direction: 'center',
            className: 'pond-code-label',
          });
        }
      });
  }, [state.ponds, farmId, editingPond?.id]);

  // Render draft infrastructure markers
  useEffect(() => {
    const group = infraGroupRef.current;
    if (!group) return;
    group.clearLayers();
    draftInfraMarkers.forEach((m) => {
      const meta = INFRASTRUCTURE_META[m.type];
      const icon = L.divIcon({
        className: 'custom-infra-pin',
        html: `<div style="background:${meta.color};color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;border:1.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">${meta.shortCode}</div>`,
        iconSize: [34, 22],
        iconAnchor: [17, 11],
      });
      L.marker(m.gps, { icon }).addTo(group);
    });
  }, [draftInfraMarkers]);

  // Update live GPS walk track on satellite map
  const handleLiveTrackChange = useCallback(
    (track: GpsTrackPoint[], currentPos: [number, number] | null, accuracyM?: number) => {
      const group = walkGroupRef.current;
      const map = mapRef.current;
      if (!group) return;
      group.clearLayers();

      if (track.length > 0) {
        const latLngs: [number, number][] = track.map((t) => [t.lat, t.lng]);
        L.polyline(latLngs, { color: '#f97316', weight: 3.5 }).addTo(group);
        latLngs.forEach((pt, idx) => {
          L.circleMarker(pt, {
            radius: idx === 0 ? 6 : 4.5,
            color: '#ffffff',
            weight: 2,
            fillColor: idx === 0 ? '#16a34a' : '#f97316',
            fillOpacity: 1,
          }).addTo(group);
        });
      }

      if (currentPos) {
        if (accuracyM && accuracyM > 0) {
          L.circle(currentPos, {
            radius: Math.min(accuracyM, 120),
            color: accuracyM > 12 ? '#f59e0b' : '#0284c7',
            weight: 1.5,
            fillOpacity: 0.12,
          }).addTo(group);
        }
        L.circleMarker(currentPos, {
          radius: 7,
          color: '#ffffff',
          weight: 2.5,
          fillColor: '#0284c7',
          fillOpacity: 1,
        }).addTo(group);
        if (map && track.length === 1) {
          map.flyTo(currentPos, 19, { duration: 0.5 });
        }
      }
    },
    []
  );

  const toggleMapTool = (tool: 'none' | 'tap' | 'rect' | 'adjust' | 'infra') => {
    const map = mapRef.current;
    if (!map) return;
    map.pm.disableDraw();
    if (activePolyLayerRef.current) activePolyLayerRef.current.pm.disable();

    if (activeMapTool === tool) {
      setActiveMapTool('none');
      return;
    }

    setActiveMapTool(tool);
    if (tool === 'tap') {
      map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 15 });
    } else if (tool === 'rect') {
      map.pm.enableDraw('Rectangle', { snappable: true, snapDistance: 15 });
    } else if (tool === 'adjust' && activePolyLayerRef.current) {
      activePolyLayerRef.current.pm.enable({
        allowSelfIntersection: false,
        snappable: true,
      });
    }
  };

  const handleClearShape = () => {
    const map = mapRef.current;
    if (!map) return;
    map.pm.disableDraw();
    if (activePolyLayerRef.current) {
      map.removeLayer(activePolyLayerRef.current);
      activePolyLayerRef.current = null;
    }
    setActiveMapTool('none');
    setDrawnPolygon([]);
    setMeasurement(null);
    setRawGpsTrack(undefined);
  };

  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [currentGpsFix, setCurrentGpsFix] = useState<{
    gps: [number, number];
    accuracyM: number;
    placeName?: string;
  } | null>(null);

  const handleLocateMe = () => {
    setFormMsg('');
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Location is not supported by this browser. Use Walk around pond or Tap pond corners.');
      return;
    }
    setLocatingGps(true);
    // Call synchronously inside click handler so every browser triggers the Allow Location prompt
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6)),
        ];
        const acc = Math.round(pos.coords.accuracy);
        const group = walkGroupRef.current;
        if (group) {
          group.clearLayers();
          if (acc > 0) {
            L.circle(coords, {
              radius: Math.min(acc, 150),
              color: acc > 15 ? '#f59e0b' : '#0284c7',
              weight: 1.5,
              fillOpacity: 0.14,
            }).addTo(group);
          }
          L.circleMarker(coords, {
            radius: 7,
            color: '#ffffff',
            weight: 2.5,
            fillColor: '#0284c7',
            fillOpacity: 1,
          })
            .bindPopup(`Your current location (±${acc} m)`)
            .addTo(group);
        }
        mapRef.current?.flyTo(coords, 19, { duration: 0.6 });
        setCurrentGpsFix({ gps: coords, accuracyM: acc });
        setLocatingGps(false);

        try {
          const res = await fetch(
            `/api/gis/reverse-geocode?lat=${encodeURIComponent(coords[0])}&lng=${encodeURIComponent(coords[1])}`
          );
          if (res.ok) {
            const data = (await res.json()) as { placeName?: string };
            if (data.placeName) {
              setCurrentGpsFix((prev) => (prev ? { ...prev, placeName: data.placeName } : prev));
            }
          }
        } catch {
          // ignore offline
        }
      },
      (err) => {
        setLocatingGps(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was blocked. Click the lock/site-info icon in your browser address bar, allow Location, and click Use my current location again.'
            : 'Could not get a GPS fix right now. Ensure device location/GPS is turned on, or tap the satellite map directly.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handlePlaceStarterShapeAtGps = () => {
    if (!currentGpsFix) return;
    const [lat, lng] = currentGpsFix.gps;
    const isSmall = unitType === 'Concrete Tank' || unitType === 'Lake Cage';
    // Approximate meters to degrees (~111,320 m/deg lat; cos(lat) for lng)
    const halfHeightDeg = (isSmall ? 6 : 10) / 111320;
    const halfWidthDeg =
      (isSmall ? 6 : 15) / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    const starterRect: [number, number][] = [
      [Number((lat + halfHeightDeg).toFixed(7)), Number((lng - halfWidthDeg).toFixed(7))],
      [Number((lat + halfHeightDeg).toFixed(7)), Number((lng + halfWidthDeg).toFixed(7))],
      [Number((lat - halfHeightDeg).toFixed(7)), Number((lng + halfWidthDeg).toFixed(7))],
      [Number((lat - halfHeightDeg).toFixed(7)), Number((lng - halfWidthDeg).toFixed(7))],
    ];

    setCaptureMethod('map');
    attachPolygonToMap(starterRect, {
      source: 'MAP_EDIT',
      method: 'Satellite Drawing',
      accuracy: currentGpsFix.accuracyM,
      fit: true,
    });
    window.setTimeout(() => {
      if (activePolyLayerRef.current) {
        mapRef.current?.pm.disableDraw();
        activePolyLayerRef.current.pm.enable({
          allowSelfIntersection: false,
          snappable: true,
        });
        setActiveMapTool('adjust');
      }
    }, 80);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.gpx')) {
      const parsed = parseGpxToPolygonLatLngs(text);
      if (!parsed.ok) {
        setFormMsg(parsed.error || 'Could not read GPX file.');
        setFormShake((n) => n + 1);
      } else {
        attachPolygonToMap(parsed.points, {
          source: 'IMPORT',
          method: 'GPX/GeoJSON Import',
          fit: true,
        });
      }
    } else {
      const parsed = parseGeoJsonToPolygonLatLngs(text);
      if (!parsed.ok || parsed.polygons.length === 0) {
        setFormMsg(parsed.error || 'Could not read GeoJSON file.');
        setFormShake((n) => n + 1);
      } else {
        attachPolygonToMap(parsed.polygons[0].points, {
          source: 'IMPORT',
          method: 'GPX/GeoJSON Import',
          fit: true,
        });
      }
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    setFormMsg('');
    if (!code.trim() || !name.trim()) {
      setFormMsg('Enter a pond code and name.');
      setFormShake((n) => n + 1);
      return;
    }
    if (!measurement || !measurement.valid || drawnPolygon.length < 3) {
      setFormMsg(
        measurement?.error ||
          'Walk around the pond or tap its corners on the satellite map before saving.'
      );
      setFormShake((n) => n + 1);
      return;
    }

    setSaving(true);
    try {
      let authoritative = measurement;
      if (!state.offlineMode) {
        try {
          const res = await fetch('/api/gis/validate-geometry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              farmId,
              farmGps: selectedFarm?.gps,
              maxRadiusM: selectedFarm?.authorizedRadiusM || 15000,
              unitType,
              gpsAccuracyM,
              polygonLatLng: drawnPolygon,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setFormMsg(data.error || 'Could not verify pond boundary.');
            setFormShake((n) => n + 1);
            setSaving(false);
            return;
          }
          authoritative = data as GeometryMeasurementResult;
        } catch {
          // Offline graceful fallback
        }
      }

      if (!authoritative.geometry) {
        setFormMsg('Could not prepare pond boundary.');
        setFormShake((n) => n + 1);
        setSaving(false);
        return;
      }

      const saveRes = onSavePond({
        editingPondId: editingPond?.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        farmId,
        unitType,
        operationStage,
        species,
        maxCapacity,
        dimensions: dimensions.trim(),
        waterCapacityM3,
        waterSource: selectedFarm?.waterSource || 'Farm Supply',
        drainageSystem: selectedFarm?.drainageSystem || 'Farm Drainage',
        gps: authoritative.centerGps,
        polygon: authoritative.polygonLatLng,
        geometry: authoritative.geometry,
        rawGpsTrack,
        boundarySource,
        areaSqm: authoritative.areaSqm,
        waterSurfaceSqm: authoritative.waterSurfaceSqm,
        perimeterM: authoritative.perimeterM,
        boundaryPointsCount: authoritative.pointsCount,
        mappingMethod,
        gpsAccuracyM,
        boundaryVerified: true,
        infraMarkers: draftInfraMarkers,
      });

      if (!saveRes.ok) {
        setFormMsg(saveRes.error || 'Could not save pond.');
        setFormShake((n) => n + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-sky-200 dark:border-sky-800/70">
      {/* Clean Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {editingPond
              ? `Update Pond Location — ${editingPond.code} (${editingPond.name})`
              : 'Register New Pond / Cage / Tank'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select your farm, then walk around the pond or tap its corners on the satellite view.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </div>

      <FormError message={formMsg} shakeKey={formShake} className="mb-4" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* LEFT COLUMN: Simple 3-Step Guided Form */}
        <div className="space-y-4 xl:col-span-5">
          {/* Step 1: Pond Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-2.5 text-xs font-bold text-slate-900 dark:text-white">
              1. Pond details
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Farm site
                </label>
                <select
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {state.farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Pond code
                </label>
                <input
                  type="text"
                  value={code}
                  disabled={Boolean(editingPond)}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${INPUT_CLASS} font-mono disabled:opacity-70`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Pond name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Type
                </label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as Pond['unitType'])}
                  className={INPUT_CLASS}
                >
                  <option value="Lined Pond">Lined Pond</option>
                  <option value="Earthen Pond">Earthen Pond</option>
                  <option value="Concrete Tank">Concrete Tank</option>
                  <option value="Lake Cage">Lake Cage</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Primary species
                </label>
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {state.speciesCatalogue.map((s) => (
                    <option key={s.id} value={s.commonName}>
                      {s.commonName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Max fish capacity
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Volume (m³)
                </label>
                <input
                  type="number"
                  min={1}
                  value={waterCapacityM3}
                  onChange={(e) => setWaterCapacityM3(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>
          </div>

          {/* Step 2: Choose Simple Boundary Method */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              2. Capture pond boundary
            </div>

            {/* Direct Use My Current Location Trigger inside Pond Boundary Step */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locatingGps}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0284c7] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0369a1] disabled:opacity-60"
            >
              {locatingGps ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
              {locatingGps ? 'Requesting location access...' : 'Use my current location'}
            </button>

            {gpsError && (
              <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {currentGpsFix && (
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px] dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    Location found (±{currentGpsFix.accuracyM} m)
                  </span>
                  <span className="font-mono text-slate-600 tabular-nums dark:text-slate-400">
                    {currentGpsFix.gps[0].toFixed(5)}, {currentGpsFix.gps[1].toFixed(5)}
                  </span>
                </div>
                {currentGpsFix.placeName && (
                  <div className="text-slate-700 dark:text-slate-300">{currentGpsFix.placeName}</div>
                )}
                <button
                  type="button"
                  onClick={handlePlaceStarterShapeAtGps}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Place pond here & adjust corners on satellite
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCaptureMethod('walk');
                  toggleMapTool('none');
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                  captureMethod === 'walk'
                    ? 'border-orange-500 bg-orange-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <Footprints className="h-4 w-4" /> Walk around pond
              </button>

              <button
                type="button"
                onClick={() => {
                  setCaptureMethod('map');
                  if (!activePolyLayerRef.current) {
                    toggleMapTool('tap');
                  }
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                  captureMethod === 'map'
                    ? 'border-sky-600 bg-[#0284c7] text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <MousePointerClick className="h-4 w-4" /> Tap on satellite
              </button>
            </div>

            {captureMethod === 'walk' ? (
              <GuidedGpsWalkPanel
                unitType={unitType}
                farmGps={selectedFarm?.gps}
                onLiveTrackChange={handleLiveTrackChange}
                onFinishPolygon={({ polygonLatLng, rawTrack, avgAccuracyM }) => {
                  setRawGpsTrack(rawTrack);
                  attachPolygonToMap(polygonLatLng, {
                    source: 'GPS_WALK',
                    method: 'GPS Boundary Walk',
                    accuracy: avgAccuracyM,
                    fit: true,
                  });
                }}
              />
            ) : (
              <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/25">
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  {activeMapTool === 'tap'
                    ? 'Tap each corner of the pond on the satellite photo, then tap the first corner again to close it.'
                    : activeMapTool === 'adjust'
                      ? 'Drag any white corner point on the satellite map to adjust the pond edge.'
                      : 'Tap "Tap pond corners" to mark the pond on satellite imagery, or drag points to fine-tune.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMapTool('tap')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      activeMapTool === 'tap'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0284c7] text-white hover:bg-[#0369a1]'
                    }`}
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    {activeMapTool === 'tap' ? 'Tapping corners...' : 'Tap pond corners'}
                  </button>
                  {drawnPolygon.length >= 3 && (
                    <button
                      type="button"
                      onClick={() => toggleMapTool('adjust')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        activeMapTool === 'adjust'
                          ? 'bg-amber-600 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Adjust corners
                    </button>
                  )}
                  {drawnPolygon.length >= 3 && (
                    <button
                      type="button"
                      onClick={handleClearShape}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible Advanced Options — Hidden unless needed */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showMoreOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                More options (GPX/survey import, water inlet/outlet pins, stage)
              </button>

              {showMoreOptions && (
                <div className="mt-2.5 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Operation stage
                      </label>
                      <select
                        value={operationStage}
                        onChange={(e) => setOperationStage(e.target.value as OperationType)}
                        className={INPUT_CLASS}
                      >
                        <option value="Hatchery">Hatchery</option>
                        <option value="Nursery">Nursery</option>
                        <option value="Grow-out Pond">Grow-out Pond</option>
                        <option value="Cage Farming">Cage Farming</option>
                        <option value="Tank Farming">Tank Farming</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Dimensions note
                      </label>
                      <input
                        type="text"
                        value={dimensions}
                        onChange={(e) => setDimensions(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Upload className="h-3.5 w-3.5" /> Import GPX / GeoJSON
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".gpx,.geojson,.json"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                    <button
                      type="button"
                      onClick={() => toggleMapTool('rect')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Quick rectangle
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                    <select
                      value={infraTypeToPlace}
                      onChange={(e) => setInfraTypeToPlace(e.target.value as InfrastructureMarkerType)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                    >
                      {INFRA_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleMapTool('infra')}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        activeMapTool === 'infra'
                          ? 'bg-sky-600 text-white'
                          : 'border border-sky-200 bg-sky-50 text-sky-700'
                      }`}
                    >
                      {activeMapTool === 'infra' ? 'Tap map to place...' : '+ Pin inlet/outlet/asset'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Clean Review & Save */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">3. Review measurements</span>
              {measurement?.valid && (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready to save
                </span>
              )}
            </div>

            {measurement && !measurement.valid && (
              <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
                {measurement.error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <div className="text-[10px] text-slate-500">Area</div>
                <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                  {measurement?.valid ? `${measurement.areaSqm.toLocaleString()} m²` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <div className="text-[10px] text-slate-500">Perimeter</div>
                <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                  {measurement?.valid ? `${measurement.perimeterM.toLocaleString()} m` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <div className="text-[10px] text-slate-500">Source</div>
                <div className="truncate font-semibold text-slate-800 dark:text-slate-200">
                  {boundarySource === 'GPS_WALK'
                    ? 'GPS Walk'
                    : boundarySource === 'IMPORT'
                      ? 'Survey File'
                      : 'Satellite Map'}
                </div>
              </div>
            </div>

            {rawGpsTrack && rawGpsTrack.length > 0 && (
              <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                Original GPS walk ({rawGpsTrack.length} points) preserved alongside final pond shape.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="success" size="md" loading={saving} onClick={handleSave}>
              <ShieldCheck className="h-4 w-4" />
              {editingPond ? 'Save pond changes' : 'Save pond'}
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Clean Google-Maps-Style Satellite Map */}
        <div className="space-y-2.5 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingGps}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284c7] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369a1] disabled:opacity-60"
              >
                <Crosshair className="h-3.5 w-3.5" />
                {locatingGps ? 'Finding location...' : 'Use my current location'}
              </button>
              <button
                type="button"
                onClick={() => selectedFarm && mapRef.current?.flyTo(selectedFarm.gps, 18, { duration: 0.6 })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Zoom to {selectedFarm?.region}
              </button>
              {drawnPolygon.length >= 3 && activeMapTool !== 'adjust' && (
                <button
                  type="button"
                  onClick={() => toggleMapTool('adjust')}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Adjust corners
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold ${
                  mapStyle === 'satellite' ? 'bg-[#0284c7] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('street')}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold ${
                  mapStyle === 'street' ? 'bg-[#0284c7] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Street
              </button>
            </div>
          </div>

          <div className="relative h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-rest lg:h-[540px] dark:border-slate-700">
            <div ref={mapContainerRef} className="h-full w-full" />
            <div className="pointer-events-auto absolute bottom-3 right-3 z-[400] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn()}
                className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut()}
                className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200"
              >
                −
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Note: Satellite imagery is a visual guide. For legal boundaries or engineering construction, walk with high-accuracy GPS or import GNSS survey data.
          </p>
        </div>
      </div>
    </Card>
  );
};
