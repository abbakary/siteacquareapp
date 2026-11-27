import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Edit3,
  Footprints,
  Home,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Save,
  Search,
  Trash2,
  Upload,
  Waves,
  X,
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
import { FormError, INPUT_CLASS, useLanguage } from '../../ui';
import { tDomain, tr } from '../../i18n/translations';
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
  onFarmChange?: (farmId: string) => void;
  onCancel: () => void;
  onSavePond: (payload: SavePondGisPayload) => { ok: boolean; error?: string };
  bottomRightSlot?: React.ReactNode;
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

function buildCirclePolygon(
  center: [number, number],
  radiusM: number,
  segments = 16
): [number, number][] {
  const [lat, lng] = center;
  const latDegPerM = 1 / 111320;
  const lngDegPerM = 1 / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    pts.push([
      Number((lat + radiusM * Math.sin(theta) * latDegPerM).toFixed(7)),
      Number((lng + radiusM * Math.cos(theta) * lngDegPerM).toFixed(7)),
    ]);
  }
  return pts;
}

function buildRectPolygon(
  center: [number, number],
  widthM: number,
  lengthM: number
): [number, number][] {
  const [lat, lng] = center;
  const halfH = lengthM / 2 / 111320;
  const halfW = widthM / 2 / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [
    [Number((lat + halfH).toFixed(7)), Number((lng - halfW).toFixed(7))],
    [Number((lat + halfH).toFixed(7)), Number((lng + halfW).toFixed(7))],
    [Number((lat - halfH).toFixed(7)), Number((lng + halfW).toFixed(7))],
    [Number((lat - halfH).toFixed(7)), Number((lng - halfW).toFixed(7))],
  ];
}

export const PondRegistrationWorkspace: React.FC<PondRegistrationWorkspaceProps> = ({
  state,
  defaultFarmId,
  editingPond,
  onFarmChange,
  onCancel,
  onSavePond,
  bottomRightSlot,
}) => {
  const { language } = useLanguage();
  const initialFarmId =
    editingPond?.farmId ||
    (defaultFarmId !== 'all' && state.farms.some((f) => f.id === defaultFarmId)
      ? defaultFarmId
      : state.farms[0].id);

  const [code, setCode] = useState(
    editingPond?.code || `POND-${String(state.ponds.length + 1).padStart(3, '0')}`
  );
  const [name, setName] = useState(
    editingPond?.name ||
      `${tr(language, 'Bwawa', 'Pond')} ${state.ponds.length + 1}`
  );
  const [farmId, setFarmId] = useState(initialFarmId);
  const [unitType, setUnitType] = useState<Pond['unitType']>(
    editingPond?.unitType || 'Lined Pond'
  );
  const [operationStage, setOperationStage] = useState<OperationType>(
    editingPond?.operationStage || 'Grow-out Pond'
  );
  const [species, setSpecies] = useState(editingPond?.species || 'Nile Tilapia');
  const [maxCapacity, setMaxCapacity] = useState(editingPond?.maxCapacity ?? 12000);
  const [waterCapacityM3, setWaterCapacityM3] = useState(editingPond?.waterCapacityM3 ?? 900);
  const [dimensions, setDimensions] = useState(editingPond?.dimensions || '30m × 20m × 1.5m');

  // Cage-specific conditional fields
  const [cageWaterbody, setCageWaterbody] = useState('Ziwa Victoria — Ghuba ya Mwanza');
  const [cageShape, setCageShape] = useState<'Circular' | 'Square'>('Circular');
  const [cageSizeM, setCageSizeM] = useState(12);
  const [cageDepthM, setCageDepthM] = useState(4);

  // Tank-specific conditional fields
  const [tankShape, setTankShape] = useState<'Circular' | 'Rectangular'>('Circular');
  const [tankDiameterOrWidthM, setTankDiameterOrWidthM] = useState(6);
  const [tankLengthM, setTankLengthM] = useState(8);
  const [tankDepthM, setTankDepthM] = useState(1.5);

  const selectedFarm = useMemo(
    () => state.farms.find((f) => f.id === farmId) || state.farms[0],
    [state.farms, farmId]
  );

  // Capture method chosen by user for Ponds: 'gps' | 'walk' | 'map' | 'import' (null until chosen for new ponds)
  const [captureMethod, setCaptureMethod] = useState<'gps' | 'walk' | 'map' | 'import' | null>(
    () => {
      if (!editingPond) return null;
      if (editingPond.boundarySource === 'GPS_WALK') return 'walk';
      if (editingPond.boundarySource === 'IMPORT') return 'import';
      return 'map';
    }
  );

  // Collapsible accordions matching reference design
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street' | 'terrain'>('satellite');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [activeMapTool, setActiveMapTool] = useState<
    'none' | 'tap' | 'rect' | 'adjust' | 'infra' | 'place-unit'
  >('none');
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
  const [importStatus, setImportStatus] = useState<{
    fileName: string;
    pointsCount: number;
    valid: boolean;
    message: string;
  } | null>(null);

  const [measurement, setMeasurement] = useState<GeometryMeasurementResult | null>(() => {
    if (!editingPond?.polygon || editingPond.polygon.length < 3) return null;
    return measureAndValidatePolygon({
      polygonLatLng: editingPond.polygon,
      unitType: editingPond.unitType,
      farmGps: selectedFarm?.gps,
      maxRadiusM: selectedFarm?.authorizedRadiusM || 15000,
      language,
    });
  });

  const [inspectedNeighborPond, setInspectedNeighborPond] = useState<Pond | null>(null);

  const [draftInfraMarkers, setDraftInfraMarkers] = useState<DraftInfraMarker[]>(() => {
    if (!editingPond) return [];
    return (state.infrastructureMarkers || [])
      .filter(
        (m: FarmInfrastructureMarker) =>
          m.pondCode === editingPond.code || m.pondId === editingPond.id
      )
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
  const cageCfgRef = useRef({ cageShape, cageSizeM, cageDepthM, cageWaterbody });
  cageCfgRef.current = { cageShape, cageSizeM, cageDepthM, cageWaterbody };
  const tankCfgRef = useRef({ tankShape, tankDiameterOrWidthM, tankLengthM, tankDepthM });
  tankCfgRef.current = { tankShape, tankDiameterOrWidthM, tankLengthM, tankDepthM };

  // Sync external defaultFarmId if changed from top header
  useEffect(() => {
    if (
      !editingPond &&
      defaultFarmId !== 'all' &&
      state.farms.some((f) => f.id === defaultFarmId) &&
      defaultFarmId !== farmId
    ) {
      setFarmId(defaultFarmId);
    }
  }, [defaultFarmId, editingPond, farmId, state.farms]);

  // Auto-calculate Tank / Cage volume and dimensions when their fields change
  useEffect(() => {
    if (unitType === 'Concrete Tank') {
      const vol =
        tankShape === 'Circular'
          ? Math.PI * Math.pow(tankDiameterOrWidthM / 2, 2) * tankDepthM
          : tankDiameterOrWidthM * tankLengthM * tankDepthM;
      setWaterCapacityM3(Math.max(1, Math.round(vol * 10) / 10));
      setDimensions(
        tankShape === 'Circular'
          ? language === 'sw'
            ? `Tanki la Duara Ø${tankDiameterOrWidthM}m × kina ${tankDepthM}m`
            : `Circular Ø${tankDiameterOrWidthM}m × ${tankDepthM}m depth`
          : `${tankLengthM}m × ${tankDiameterOrWidthM}m × ${tankDepthM}m`
      );
    } else if (unitType === 'Lake Cage') {
      const vol =
        cageShape === 'Circular'
          ? Math.PI * Math.pow(cageSizeM / 2, 2) * cageDepthM
          : cageSizeM * cageSizeM * cageDepthM;
      setWaterCapacityM3(Math.max(1, Math.round(vol * 10) / 10));
      setDimensions(
        cageShape === 'Circular'
          ? language === 'sw'
            ? `Kizimba cha Duara Ø${cageSizeM}m × wavu ${cageDepthM}m (${cageWaterbody})`
            : `Circular Cage Ø${cageSizeM}m × ${cageDepthM}m net (${cageWaterbody})`
          : language === 'sw'
            ? `Kizimba cha Mraba ${cageSizeM}m × ${cageSizeM}m × ${cageDepthM}m (${cageWaterbody})`
            : `Square Cage ${cageSizeM}m × ${cageSizeM}m × ${cageDepthM}m (${cageWaterbody})`
      );
    }
  }, [
    unitType,
    tankShape,
    tankDiameterOrWidthM,
    tankLengthM,
    tankDepthM,
    cageShape,
    cageSizeM,
    cageDepthM,
    cageWaterbody,
    language,
  ]);

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
        language,
      });
      setMeasurement(m);
      setFormMsg('');
      if (m.valid) {
        setReviewOpen(true);
      }
    },
    [language]
  );

  const attachPolygonToMap = useCallback(
    (
      pts: [number, number][],
      opts?: {
        source?: PondBoundarySource;
        method?: MappingMethod;
        accuracy?: number;
        fit?: boolean;
        enableEdit?: boolean;
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
          color: '#2563eb',
          weight: 3.5,
          fillColor: '#38bdf8',
          fillOpacity: 0.3,
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
          map.fitBounds(poly.getBounds(), { padding: [48, 48], maxZoom: 19 });
        }
        if (opts?.enableEdit) {
          window.setTimeout(() => {
            if (activePolyLayerRef.current === poly) {
              map.pm.disableDraw();
              poly.pm.enable({ allowSelfIntersection: false, snappable: true });
              setActiveMapTool('adjust');
            }
          }, 80);
        }
      }

      if (opts?.source) setBoundarySource(opts.source);
      if (opts?.method) setMappingMethod(opts.method);
      if (opts?.accuracy !== undefined) setGpsAccuracyM(opts.accuracy);
      evaluatePolygon(pts, opts?.accuracy);
    },
    [evaluatePolygon]
  );

  // Initialize Leaflet Map with ResizeObserver & dynamic sizing
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
      templineStyle: { color: '#2563eb', weight: 2.5 },
      hintlineStyle: { color: '#2563eb', dashArray: [5, 5], weight: 2 },
    });

    map.on('pm:create', (e: { layer: L.Layer }) => {
      if (e.layer instanceof L.Polygon) {
        const pts = extractLatLngsFromLayer(e.layer);
        map.removeLayer(e.layer);
        attachPolygonToMap(pts, {
          source: 'MAP_EDIT',
          method: 'Satellite Drawing',
        });
        setCaptureMethod((prev) => prev || 'map');
        setActiveMapTool('none');
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const tool = activeToolRef.current;
      if (tool === 'infra') {
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
        return;
      }
      if (tool === 'place-unit') {
        const clickCenter: [number, number] = [
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ];
        const currentUnit = unitTypeRef.current;
        let pts: [number, number][];
        if (currentUnit === 'Lake Cage') {
          const { cageShape: shape, cageSizeM: size } = cageCfgRef.current;
          pts =
            shape === 'Circular'
              ? buildCirclePolygon(clickCenter, Math.max(2, size / 2))
              : buildRectPolygon(clickCenter, Math.max(3, size), Math.max(3, size));
        } else {
          const {
            tankShape: shape,
            tankDiameterOrWidthM: w,
            tankLengthM: l,
          } = tankCfgRef.current;
          pts =
            shape === 'Circular'
              ? buildCirclePolygon(clickCenter, Math.max(1.5, w / 2))
              : buildRectPolygon(clickCenter, Math.max(2, w), Math.max(2, l));
        }
        attachPolygonToMap(pts, {
          source: 'MAP_EDIT',
          method: 'Satellite Drawing',
          fit: true,
          enableEdit: true,
        });
        setActiveMapTool('adjust');
      }
    });

    mapRef.current = map;

    if (editingPond?.polygon && editingPond.polygon.length >= 3) {
      attachPolygonToMap(editingPond.polygon, {
        source: editingPond.boundarySource || 'MAP_EDIT',
        method: editingPond.mappingMethod || 'Satellite Drawing',
        accuracy: editingPond.gpsAccuracyM,
        fit: true,
      });
    } else if (selectedFarm) {
      const farmPonds = state.ponds.filter(
        (p) => p.farmId === selectedFarm.id && p.polygon?.length >= 3
      );
      if (farmPonds.length > 0) {
        map.fitBounds(L.latLngBounds(farmPonds.flatMap((p) => p.polygon)), {
          padding: [40, 40],
          maxZoom: 18,
        });
      }
    }

    const invalidate = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', invalidate);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      resizeObserver.observe(mapContainerRef.current);
    }
    const timer = window.setTimeout(invalidate, 160);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', invalidate);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-invalidate Leaflet dimensions on fullscreen toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t1 = window.setTimeout(() => map.invalidateSize({ animate: false }), 60);
    const t2 = window.setTimeout(() => map.invalidateSize({ animate: false }), 240);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) setIsMapFullscreen(false);
    };
    if (isMapFullscreen) window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('keydown', onKey);
    };
  }, [isMapFullscreen]);

  // Tile switcher (Satellite / Street / Terrain)
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

  // Auto-zoom map when farm selection changes
  const prevFarmRef = useRef(farmId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFarm) return;
    if (prevFarmRef.current !== farmId) {
      prevFarmRef.current = farmId;
      setInspectedNeighborPond(null);
      const farmPonds = state.ponds.filter(
        (p) => p.farmId === selectedFarm.id && p.polygon?.length >= 3
      );
      if (farmPonds.length > 0) {
        map.fitBounds(L.latLngBounds(farmPonds.flatMap((p) => p.polygon)), {
          padding: [40, 40],
          maxZoom: 18,
        });
      } else {
        map.flyTo(selectedFarm.gps, 18, { duration: 0.65 });
      }
    }
  }, [farmId, selectedFarm, state.ponds]);

  // Recompute measurements & geofence checks if unitType or farmId changes on a drawn polygon
  useEffect(() => {
    if (drawnPolygon.length >= 3) {
      evaluatePolygon(drawnPolygon, gpsAccuracyM);
    }
  }, [unitType, farmId, drawnPolygon, gpsAccuracyM, evaluatePolygon]);

  // Render neighboring ponds on the farm (clickable to inspect area & perimeter!)
  useEffect(() => {
    const group = refPondsGroupRef.current;
    if (!group) return;
    group.clearLayers();
    state.ponds
      .filter((p) => p.farmId === farmId && p.id !== editingPond?.id)
      .forEach((pond) => {
        if (pond.polygon && pond.polygon.length >= 3) {
          const isInspected = inspectedNeighborPond?.id === pond.id;
          const ref = L.polygon(pond.polygon, {
            color: isInspected ? '#059669' : '#f8fafc',
            weight: isInspected ? 3 : 1.75,
            dashArray: isInspected ? undefined : '4 4',
            fillColor: isInspected ? '#34d399' : '#10b981',
            fillOpacity: isInspected ? 0.3 : 0.16,
          }).addTo(group);
          ref.bindTooltip(pond.code, {
            permanent: true,
            direction: 'center',
            className: 'pond-code-label',
          });
          ref.on('click', (e) => {
            if (
              activeToolRef.current === 'none' ||
              activeToolRef.current === 'adjust'
            ) {
              L.DomEvent.stopPropagation(e);
              setInspectedNeighborPond(pond);
            }
          });
        }
      });
  }, [state.ponds, farmId, editingPond?.id, inspectedNeighborPond?.id]);

  // Update active polygon tooltip with live name + area
  useEffect(() => {
    const poly = activePolyLayerRef.current;
    if (!poly) return;
    poly.unbindTooltip();
    if (measurement?.valid) {
      const ha = measurement.areaSqm / 10000;
      const areaText =
        measurement.areaSqm >= 1000
          ? `${ha.toFixed(2)} ha`
          : `${measurement.areaSqm.toLocaleString()} m²`;
      poly.bindTooltip(`${name || code} · ${tr(language, 'Eneo', 'Area')}: ${areaText}`, {
        permanent: true,
        direction: 'center',
        className: 'pond-code-label',
      });
    }
  }, [measurement, name, code, language]);

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

  const toggleMapTool = (
    tool: 'none' | 'tap' | 'rect' | 'adjust' | 'infra' | 'place-unit'
  ) => {
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
    setImportStatus(null);
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
      setGpsError(
        tr(
          language,
          'GPS haitumiki kwenye kivinjari hiki. Tumia Tembea kuzunguka bwawa au Gusa kwenye satelaiti.',
          'Location is not supported by this browser. Use Walk around pond or Tap on satellite.'
        )
      );
      return;
    }
    setLocatingGps(true);
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
            .bindPopup(`${tr(language, 'Eneo lako la sasa', 'Your current location')} (±${acc} m)`)
            .addTo(group);
        }
        mapRef.current?.flyTo(coords, 19, { duration: 0.6 });
        setCurrentGpsFix({ gps: coords, accuracyM: acc });
        setLocatingGps(false);

        try {
          const res = await fetch(
            `/api/gis/reverse-geocode?lat=${encodeURIComponent(coords[0])}&lng=${encodeURIComponent(
              coords[1]
            )}`
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
            ? tr(
                language,
                'Ruhusa ya eneo ilizuiwa. Ruhusu Eneo kwenye upau wa anwani wa kivinjari kisha jaribu tena.',
                'Location permission was blocked. Allow Location in your browser address bar and try again.'
              )
            : tr(
                language,
                'Imeshindikana kupata mawimbi ya GPS sasa hivi. Hakikisha GPS imewashwa au gusa kwenye satelaiti.',
                'Could not get a GPS fix right now. Ensure device GPS is enabled or tap on satellite.'
              )
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handlePlaceStarterShapeAtGps = () => {
    if (!currentGpsFix) return;
    const starterRect =
      unitType === 'Concrete Tank'
        ? tankShape === 'Circular'
          ? buildCirclePolygon(currentGpsFix.gps, Math.max(1.5, tankDiameterOrWidthM / 2))
          : buildRectPolygon(
              currentGpsFix.gps,
              Math.max(2, tankDiameterOrWidthM),
              Math.max(2, tankLengthM)
            )
        : unitType === 'Lake Cage'
          ? cageShape === 'Circular'
            ? buildCirclePolygon(currentGpsFix.gps, Math.max(2, cageSizeM / 2))
            : buildRectPolygon(
                currentGpsFix.gps,
                Math.max(3, cageSizeM),
                Math.max(3, cageSizeM)
              )
          : buildRectPolygon(currentGpsFix.gps, 30, 20);

    if (unitType === 'Lined Pond' || unitType === 'Earthen Pond') {
      setCaptureMethod('gps');
    }
    attachPolygonToMap(starterRect, {
      source: 'MAP_EDIT',
      method: 'Satellite Drawing',
      accuracy: currentGpsFix.accuracyM,
      fit: true,
      enableEdit: true,
    });
  };

  const handlePlaceTankOrCageAtFarmCenter = () => {
    const center = selectedFarm?.gps || [-6.8664, 39.3278];
    const pts =
      unitType === 'Lake Cage'
        ? cageShape === 'Circular'
          ? buildCirclePolygon(center, Math.max(2, cageSizeM / 2))
          : buildRectPolygon(center, Math.max(3, cageSizeM), Math.max(3, cageSizeM))
        : tankShape === 'Circular'
          ? buildCirclePolygon(center, Math.max(1.5, tankDiameterOrWidthM / 2))
          : buildRectPolygon(
              center,
              Math.max(2, tankDiameterOrWidthM),
              Math.max(2, tankLengthM)
            );
    attachPolygonToMap(pts, {
      source: 'MAP_EDIT',
      method: 'Satellite Drawing',
      fit: true,
      enableEdit: true,
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lower = file.name.toLowerCase();
    setCaptureMethod('import');
    if (lower.endsWith('.gpx')) {
      const parsed = parseGpxToPolygonLatLngs(text, language);
      if (!parsed.ok) {
        setImportStatus({
          fileName: file.name,
          pointsCount: 0,
          valid: false,
          message: parsed.error || tr(language, 'Imeshindikana kusoma faili la GPX.', 'Could not read GPX file.'),
        });
        setFormMsg(parsed.error || tr(language, 'Imeshindikana kusoma faili la GPX.', 'Could not read GPX file.'));
        setFormShake((n) => n + 1);
      } else {
        const m = measureAndValidatePolygon({
          polygonLatLng: parsed.points,
          unitType,
          farmGps: selectedFarm?.gps,
          maxRadiusM: selectedFarm?.authorizedRadiusM || 15000,
          language,
        });
        setImportStatus({
          fileName: file.name,
          pointsCount: parsed.points.length,
          valid: m.valid,
          message: m.valid
            ? language === 'sw'
              ? `Majira ${parsed.points.length} yamethibitishwa (${m.areaSqm.toLocaleString()} m², mzingo ${m.perimeterM} m).`
              : `Validated ${parsed.points.length} coordinates (${m.areaSqm.toLocaleString()} m², ${m.perimeterM} m perimeter).`
            : m.error || tr(language, 'Uthibitishaji wa majira umeshindikana.', 'Coordinate validation failed.'),
        });
        attachPolygonToMap(parsed.points, {
          source: 'IMPORT',
          method: 'GPX/GeoJSON Import',
          fit: true,
        });
      }
    } else {
      const parsed = parseGeoJsonToPolygonLatLngs(text, language);
      if (!parsed.ok || parsed.polygons.length === 0) {
        setImportStatus({
          fileName: file.name,
          pointsCount: 0,
          valid: false,
          message: parsed.error || tr(language, 'Imeshindikana kusoma faili la GeoJSON.', 'Could not read GeoJSON file.'),
        });
        setFormMsg(parsed.error || tr(language, 'Imeshindikana kusoma faili la GeoJSON.', 'Could not read GeoJSON file.'));
        setFormShake((n) => n + 1);
      } else {
        const pts = parsed.polygons[0].points;
        const m = measureAndValidatePolygon({
          polygonLatLng: pts,
          unitType,
          farmGps: selectedFarm?.gps,
          maxRadiusM: selectedFarm?.authorizedRadiusM || 15000,
          language,
        });
        setImportStatus({
          fileName: file.name,
          pointsCount: pts.length,
          valid: m.valid,
          message: m.valid
            ? language === 'sw'
              ? `Majira ${pts.length} yamethibitishwa (${m.areaSqm.toLocaleString()} m², mzingo ${m.perimeterM} m).`
              : `Validated ${pts.length} coordinates (${m.areaSqm.toLocaleString()} m², ${m.perimeterM} m perimeter).`
            : m.error || tr(language, 'Uthibitishaji wa majira umeshindikana.', 'Coordinate validation failed.'),
        });
        attachPolygonToMap(pts, {
          source: 'IMPORT',
          method: 'GPX/GeoJSON Import',
          fit: true,
        });
      }
    }
    e.target.value = '';
  };

  const handleUnitTypeChange = (nextType: Pond['unitType']) => {
    setUnitType(nextType);
    setFormMsg('');
    if (nextType === 'Lake Cage') {
      setOperationStage('Cage Farming');
      if (!editingPond) {
        setCode(`CAGE-${String(state.ponds.length + 1).padStart(3, '0')}`);
        setName(`${tr(language, 'Kizimba Ziwani', 'Lake Cage')} ${state.ponds.length + 1}`);
      }
    } else if (nextType === 'Concrete Tank') {
      setOperationStage('Tank Farming');
      if (!editingPond) {
        setCode(`TANK-${String(state.ponds.length + 1).padStart(3, '0')}`);
        setName(`${tr(language, 'Tanki', 'Tank')} ${state.ponds.length + 1}`);
      }
    } else {
      setOperationStage('Grow-out Pond');
      if (!editingPond) {
        setCode(`POND-${String(state.ponds.length + 1).padStart(3, '0')}`);
        setName(`${tr(language, 'Bwawa', 'Pond')} ${state.ponds.length + 1}`);
      }
    }
  };

  const handleSave = async () => {
    setFormMsg('');
    if (!code.trim() || !name.trim()) {
      setDetailsOpen(true);
      setFormMsg(tr(language, 'Ingiza msimbo na jina la kituo kwenye Maelezo.', 'Enter a unit code and name in Details.'));
      setFormShake((n) => n + 1);
      return;
    }
    if (!measurement || !measurement.valid || drawnPolygon.length < 3) {
      setFormMsg(
        measurement?.error ||
          (unitType === 'Lake Cage'
            ? tr(language, 'Weka kizimba kwenye ramani ya ziwa kabla ya kuhifadhi.', 'Position the cage on the waterbody map before saving.')
            : unitType === 'Concrete Tank'
              ? tr(language, 'Weka eneo la tanki kwenye ramani ya shamba kabla ya kuhifadhi.', 'Place the tank footprint on the farm map before saving.')
              : tr(language, 'Chagua njia ya ramani na rekodi mpaka wa bwawa kabla ya kuhifadhi.', 'Select a mapping method and capture the pond boundary on the map before saving.'))
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
            setFormMsg(data.error || tr(language, 'Imeshindikana kuthibitisha mpaka.', 'Could not verify boundary.'));
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
        setFormMsg(tr(language, 'Imeshindikana kuandaa mpaka wa kituo.', 'Could not prepare unit boundary.'));
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
        waterSource:
          unitType === 'Lake Cage' ? cageWaterbody.trim() : selectedFarm?.waterSource || 'Chanzo cha Shamba',
        drainageSystem: selectedFarm?.drainageSystem || 'Mfumo wa Shamba',
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
        setFormMsg(saveRes.error || tr(language, 'Imeshindikana kuhifadhi kituo.', 'Could not save unit.'));
        setFormShake((n) => n + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const isPondUnit = unitType === 'Lined Pond' || unitType === 'Earthen Pond';
  const saveButtonLabel = editingPond
    ? tr(language, 'Hifadhi Mabadiliko', 'Save Changes')
    : unitType === 'Lake Cage'
      ? tr(language, 'Hifadhi Kizimba', 'Save Cage')
      : unitType === 'Concrete Tank'
        ? tr(language, 'Hifadhi Tanki', 'Save Tank')
        : tr(language, 'Hifadhi Bwawa', 'Save Pond');

  const handleZoomToFarm = () => {
    const map = mapRef.current;
    if (!map || !selectedFarm) return;
    const farmPonds = state.ponds.filter(
      (p) => p.farmId === selectedFarm.id && p.polygon?.length >= 3
    );
    if (farmPonds.length > 0) {
      map.fitBounds(L.latLngBounds(farmPonds.flatMap((p) => p.polygon)), {
        padding: [40, 40],
        maxZoom: 18,
      });
    } else {
      map.flyTo(selectedFarm.gps, 18, { duration: 0.65 });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* LEFT COLUMN: Guided Conditional Registration Workflow */}
      <div className="space-y-3 xl:col-span-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          {/* Step 1 Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D72E8] text-xs font-bold text-white">
                1
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingPond
                    ? tr(
                        language,
                        `Sasisha ${editingPond.code} (${editingPond.name})`,
                        `Update ${editingPond.code} (${editingPond.name})`
                      )
                    : tr(
                        language,
                        'Sajili Bwawa / Kizimba / Tanki Jipya',
                        'Register New Pond / Cage / Tank'
                      )}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {tr(
                    language,
                    'Chagua shamba, aina ya kituo, na njia ya kupima ramani.',
                    'Select your farm, facility type, and mapping method.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <FormError message={formMsg} shakeKey={formShake} className="mt-3" />

          {/* Farm Site & Facility Type */}
          <div className="mt-3.5 space-y-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {tr(language, 'Eneo la Shamba', 'Farm Site')}
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-2.5 flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-[#1D72E8] dark:bg-sky-950/60 dark:text-sky-400">
                  <Home className="h-3.5 w-3.5" />
                </span>
                <select
                  value={farmId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setFarmId(nextId);
                    onFarmChange?.(nextId);
                  }}
                  className={`${INPUT_CLASS} truncate pl-10 pr-8 font-semibold`}
                >
                  {state.farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {tr(language, 'Aina ya Kituo', 'Facility Type')}
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(
                  [
                    { id: 'Lined Pond' },
                    { id: 'Earthen Pond' },
                    { id: 'Lake Cage' },
                    { id: 'Concrete Tank' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUnitTypeChange(opt.id)}
                    className={`min-h-[40px] rounded-xl border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors ${
                      unitType === opt.id
                        ? 'border-[#1D72E8] bg-sky-50 text-[#1D72E8] dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {tDomain(language, opt.id)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Conditional Workflow */}
          <div className="mt-4 border-t border-slate-100 pt-3.5 dark:border-slate-800">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D72E8] text-xs font-bold text-white">
                2
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {unitType === 'Lake Cage'
                  ? tr(language, 'Eneo la Maji na Mkao wa Kizimba', 'Waterbody & Cage Positioning')
                  : unitType === 'Concrete Tank'
                    ? tr(language, 'Vipimo na Uwezo wa Tanki', 'Tank Dimensions & Capacity')
                    : tr(language, 'Chagua Njia ya Kupima Ramani', 'Choose Mapping Method')}
              </span>
            </div>

            {/* CONDITION A: POND (4 square method cards matching reference image) */}
            {isPondUnit && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      {
                        id: 'gps',
                        label: tr(language, 'Tumia Eneo Lilipo', 'Use Current Location'),
                        icon: MapPin,
                      },
                      {
                        id: 'walk',
                        label: tr(language, 'Tembea Kuzunguka Bwawa', 'Walk Around Pond'),
                        icon: Footprints,
                      },
                      {
                        id: 'map',
                        label: tr(language, 'Gusa kwenye Satelaiti', 'Tap on Satellite'),
                        icon: MousePointerClick,
                      },
                      {
                        id: 'import',
                        label: tr(language, 'Pakia GPX', 'Import GPX'),
                        icon: Upload,
                      },
                    ] as const
                  ).map((method) => {
                    const Icon = method.icon;
                    const active = captureMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setCaptureMethod(method.id);
                          setFormMsg('');
                          if (method.id === 'map') {
                            if (!activePolyLayerRef.current) {
                              toggleMapTool('tap');
                            } else {
                              toggleMapTool('none');
                            }
                          } else {
                            toggleMapTool('none');
                          }
                          if (method.id === 'gps' && !currentGpsFix && !locatingGps) {
                            handleLocateMe();
                          }
                        }}
                        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all ${
                          active
                            ? 'border-[#1D72E8] bg-sky-50/70 text-[#1D72E8] shadow-xs dark:border-sky-500 dark:bg-sky-950/35 dark:text-sky-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200'
                        }`}
                      >
                        {active && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1D72E8] text-white shadow-xs">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <Icon
                          className={`h-5 w-5 ${
                            active ? 'text-[#1D72E8] dark:text-sky-300' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        />
                        <span className="text-[11px] font-semibold leading-tight">
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* No method chosen yet */}
                {captureMethod === null && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                    <Info className="h-4 w-4 shrink-0 text-[#1D72E8]" />
                    <span>
                      {tr(
                        language,
                        'Chagua njia moja hapo juu — zana za njia uliyochagua pekee zitaonekana hapa.',
                        'Select one method above — only the tools for your chosen method will appear here.'
                      )}
                    </span>
                  </div>
                )}

                {/* Method 1: Use Current Location */}
                {captureMethod === 'gps' && (
                  <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/25">
                    {gpsError && (
                      <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{gpsError}</span>
                      </div>
                    )}

                    {drawnPolygon.length < 3 ? (
                      !currentGpsFix ? (
                        <button
                          type="button"
                          onClick={handleLocateMe}
                          disabled={locatingGps}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D72E8] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#155ec2] disabled:opacity-60"
                        >
                          {locatingGps ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Crosshair className="h-4 w-4" />
                          )}
                          {locatingGps
                            ? tr(language, 'Inaomba eneo la GPS...', 'Requesting GPS location...')
                            : tr(language, 'Tumia eneo langu la sasa', 'Use my current location')}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-bold text-emerald-900 dark:text-emerald-200">
                              {tr(
                                language,
                                `Eneo limepatikana (±${currentGpsFix.accuracyM} m)`,
                                `Location found (±${currentGpsFix.accuracyM} m)`
                              )}
                            </span>
                            <span className="font-mono text-slate-600 tabular-nums dark:text-slate-400">
                              {currentGpsFix.gps[0].toFixed(5)}, {currentGpsFix.gps[1].toFixed(5)}
                            </span>
                          </div>
                          {currentGpsFix.placeName && (
                            <div className="text-[11px] text-slate-700 dark:text-slate-300">
                              {currentGpsFix.placeName}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={handlePlaceStarterShapeAtGps}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {tr(
                                language,
                                'Weka bwawa hapa na rekebisha pembe kwenye satelaiti',
                                'Place pond here & adjust corners on satellite'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleLocateMe}
                              disabled={locatingGps}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <Crosshair className="h-3.5 w-3.5" />
                              {tr(language, 'Sasisha', 'Refresh')}
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          {activeMapTool === 'adjust'
                            ? tr(
                                language,
                                'Buruta nukta nyeupe yoyote kwenye ramani ya satelaiti kurekebisha ukingo wa bwawa.',
                                'Drag any white corner point on the satellite map to adjust the pond edge.'
                              )
                            : tr(
                                language,
                                'Bwawa la mwanzo limewekwa. Bofya "Rekebisha pembe" kuburuta kingo au hifadhi chini.',
                                'Starter pond placed. Click "Adjust corners" to drag edges or save below.'
                              )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              activeMapTool === 'adjust'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            {activeMapTool === 'adjust' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Nimemaliza kurekebisha', 'Done adjusting')}
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Rekebisha pembe', 'Adjust corners')}
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearShape}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 2: Walk Around Pond */}
                {captureMethod === 'walk' && (
                  <div className="space-y-2.5">
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
                    {drawnPolygon.length >= 3 && (
                      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/25">
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          {activeMapTool === 'adjust'
                            ? tr(
                                language,
                                'Buruta nukta nyeupe yoyote kwenye satelaiti ili kuboresha ukingo uliotembelewa.',
                                'Drag any white corner point on the satellite map to refine the walked edge.'
                              )
                            : tr(
                                language,
                                'Mpaka wa matembezi ya GPS umerekodiwa. Rekebisha pembe ikihitajika au hifadhi chini.',
                                'GPS walk boundary recorded. Adjust corners if needed or save below.'
                              )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              activeMapTool === 'adjust'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {activeMapTool === 'adjust' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Nimemaliza kurekebisha', 'Done adjusting')}
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Rekebisha pembe', 'Adjust corners')}
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearShape}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 3: Tap on Satellite */}
                {captureMethod === 'map' && (
                  <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/25">
                    {drawnPolygon.length < 3 ? (
                      <>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          {activeMapTool === 'tap'
                            ? tr(
                                language,
                                'Gusa kila pembe ya bwawa kwenye ramani ya satelaiti, kisha gusa pembe ya kwanza tena kulifunga.',
                                'Tap each corner of the pond on the satellite map, then tap the first corner again to close it.'
                              )
                            : tr(
                                language,
                                'Bofya "Gusa pembe za bwawa" chini, kisha gusa kila pembe kwenye satelaiti.',
                                'Click "Tap pond corners" below, then tap each corner on the satellite map.'
                              )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleMapTool('tap')}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              activeMapTool === 'tap'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#1D72E8] text-white hover:bg-[#155ec2]'
                            }`}
                          >
                            <MousePointerClick className="h-3.5 w-3.5" />
                            {activeMapTool === 'tap'
                              ? tr(language, 'Inagusa pembe (bofya kuacha)', 'Tapping corners (click to stop)')
                              : tr(language, 'Gusa pembe za bwawa', 'Tap pond corners')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          {activeMapTool === 'adjust'
                            ? tr(
                                language,
                                'Buruta nukta nyeupe yoyote kwenye ramani ya satelaiti kurekebisha ukingo wa bwawa.',
                                'Drag any white corner point on the satellite map to adjust the pond edge.'
                              )
                            : tr(
                                language,
                                'Mpaka wa bwawa umerekodiwa. Bofya "Rekebisha pembe" au "Futa" kuchora tena.',
                                'Pond boundary captured. Click "Adjust corners" to drag edges or "Clear" to redraw.'
                              )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              activeMapTool === 'adjust'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            {activeMapTool === 'adjust' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Nimemaliza kurekebisha', 'Done adjusting')}
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />{' '}
                                {tr(language, 'Rekebisha pembe', 'Adjust corners')}
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearShape}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Method 4: Import GPX / GeoJSON */}
                {captureMethod === 'import' && (
                  <div className="space-y-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/25">
                    <p className="text-[11px] text-slate-700 dark:text-slate-300">
                      {tr(
                        language,
                        'Pakia faili la upimaji la .gpx au .geojson. Majira yanathibitishwa moja kwa moja ndani ya mipaka ya shamba.',
                        'Upload a .gpx or .geojson survey file. Coordinates are validated automatically against farm geofence bounds.'
                      )}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".gpx,.geojson,.json"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D72E8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#155ec2]"
                      >
                        <Upload className="h-3.5 w-3.5" />{' '}
                        {tr(language, 'Chagua Faili la GPX / GeoJSON', 'Choose GPX / GeoJSON File')}
                      </button>
                      {drawnPolygon.length >= 3 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                              activeMapTool === 'adjust'
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            {activeMapTool === 'adjust'
                              ? tr(language, 'Tayari', 'Done')
                              : tr(language, 'Rekebisha', 'Adjust')}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearShape}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                          </button>
                        </>
                      )}
                    </div>
                    {importStatus && (
                      <div
                        className={`rounded-lg border p-2 text-[11px] ${
                          importStatus.valid
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        <div className="font-bold">{importStatus.fileName}</div>
                        <div>{importStatus.message}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CONDITION B: LAKE CAGE (Waterbody location & cage positioning only) */}
            {unitType === 'Lake Cage' && (
              <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/25">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Ziwa / Eneo la Maji', 'Waterbody / Lake Zone')}
                    </label>
                    <input
                      type="text"
                      value={cageWaterbody}
                      onChange={(e) => setCageWaterbody(e.target.value)}
                      placeholder={tr(language, 'mf. Ziwa Victoria — Ghuba ya Mwanza', 'e.g. Lake Victoria — Mwanza Gulf')}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Umbo la Kizimba', 'Cage Shape')}
                    </label>
                    <select
                      value={cageShape}
                      onChange={(e) => setCageShape(e.target.value as 'Circular' | 'Square')}
                      className={INPUT_CLASS}
                    >
                      <option value="Circular">{tr(language, 'Wavu wa Duara', 'Circular Net')}</option>
                      <option value="Square">{tr(language, 'Fremu ya Mraba', 'Square Frame')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {cageShape === 'Circular'
                        ? tr(language, 'Kipenyo (m)', 'Diameter (m)')
                        : tr(language, 'Urefu wa Upande (m)', 'Side Length (m)')}
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={cageSizeM}
                      onChange={(e) => setCageSizeM(Math.max(3, Number(e.target.value)))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Kina cha Wavu (m)', 'Net Depth (m)')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={cageDepthM}
                      onChange={(e) => setCageDepthM(Math.max(1, Number(e.target.value)))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Ujazo Uliokokotolewa', 'Calculated Volume')}
                    </label>
                    <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 font-mono font-bold text-slate-800 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {waterCapacityM3.toLocaleString()} m³
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-sky-200/70 pt-2.5 dark:border-sky-900/50">
                  {drawnPolygon.length < 3 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleMapTool('place-unit')}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                          activeMapTool === 'place-unit'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1D72E8] text-white hover:bg-[#155ec2]'
                        }`}
                      >
                        <MousePointerClick className="h-3.5 w-3.5" />
                        {activeMapTool === 'place-unit'
                          ? tr(language, 'Gusa maji kwenye ramani...', 'Tap waterbody on map...')
                          : tr(language, 'Gusa maji kwenye ramani', 'Tap waterbody on map')}
                      </button>
                      <button
                        type="button"
                        onClick={handlePlaceTankOrCageAtFarmCenter}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <MapPin className="h-3.5 w-3.5 text-sky-600" />{' '}
                        {tr(language, 'Weka shambani', 'Drop at farm site')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          activeMapTool === 'adjust'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {activeMapTool === 'adjust'
                          ? tr(language, 'Nimemaliza kurekebisha', 'Done adjusting')
                          : tr(language, 'Rekebisha eneo la kizimba', 'Adjust cage position')}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearShape}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* CONDITION C: CONCRETE TANK (Tank dimensions & capacity only) */}
            {unitType === 'Concrete Tank' && (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs dark:border-teal-900/60 dark:bg-teal-950/25">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Umbo la Tanki', 'Tank Shape')}
                    </label>
                    <select
                      value={tankShape}
                      onChange={(e) =>
                        setTankShape(e.target.value as 'Circular' | 'Rectangular')
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="Circular">{tr(language, 'Tanki la Duara', 'Circular Tank')}</option>
                      <option value="Rectangular">{tr(language, 'Tanki la Mstatili', 'Rectangular Tank')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tankShape === 'Circular'
                        ? tr(language, 'Kipenyo (m)', 'Diameter (m)')
                        : tr(language, 'Upana (m)', 'Width (m)')}
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={40}
                      step={0.5}
                      value={tankDiameterOrWidthM}
                      onChange={(e) =>
                        setTankDiameterOrWidthM(Math.max(2, Number(e.target.value)))
                      }
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  {tankShape === 'Rectangular' && (
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {tr(language, 'Urefu (m)', 'Length (m)')}
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={60}
                        step={0.5}
                        value={tankLengthM}
                        onChange={(e) => setTankLengthM(Math.max(2, Number(e.target.value)))}
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Kina cha Maji (m)', 'Water Depth (m)')}
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.1}
                      value={tankDepthM}
                      onChange={(e) => setTankDepthM(Math.max(0.5, Number(e.target.value)))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Ujazo Uliokokotolewa', 'Calculated Volume')}
                    </label>
                    <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 font-mono font-bold text-slate-800 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {waterCapacityM3.toLocaleString()} m³
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-teal-200/70 pt-2.5 dark:border-teal-900/50">
                  {drawnPolygon.length < 3 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleMapTool('place-unit')}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                          activeMapTool === 'place-unit'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1D72E8] text-white hover:bg-[#155ec2]'
                        }`}
                      >
                        <MousePointerClick className="h-3.5 w-3.5" />
                        {activeMapTool === 'place-unit'
                          ? tr(language, 'Gusa ramani kuweka tanki...', 'Tap map to place tank...')
                          : tr(language, 'Gusa ramani kuweka tanki', 'Tap map to place tank')}
                      </button>
                      <button
                        type="button"
                        onClick={handlePlaceTankOrCageAtFarmCenter}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />{' '}
                        {tr(language, 'Weka shambani', 'Place at farm site')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          toggleMapTool(activeMapTool === 'adjust' ? 'none' : 'adjust')
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          activeMapTool === 'adjust'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {activeMapTool === 'adjust'
                          ? tr(language, 'Nimemaliza kurekebisha', 'Done adjusting')
                          : tr(language, 'Rekebisha eneo la tanki', 'Adjust tank footprint')}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearShape}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {tr(language, 'Futa', 'Clear')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Pond / Facility Details Accordion */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-[#1D72E8]" />
                <span>
                  {unitType === 'Lake Cage'
                    ? tr(language, 'Maelezo ya Kizimba', 'Cage Details')
                    : unitType === 'Concrete Tank'
                      ? tr(language, 'Maelezo ya Tanki', 'Tank Details')
                      : tr(language, 'Maelezo ya Bwawa', 'Pond Details')}
                </span>
                <span className="font-mono text-[11px] font-normal text-slate-500">
                  ({code})
                </span>
              </span>
              {detailsOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {detailsOpen && (
              <div className="space-y-2.5 border-t border-slate-200 p-3 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Msimbo wa Kituo', 'Unit Code')}
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
                      {tr(language, 'Jina la Kituo', 'Unit Name')}
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
                      {tr(language, 'Spishi Kuu', 'Primary Species')}
                    </label>
                    <select
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {state.speciesCatalogue.map((s) => (
                        <option key={s.id} value={s.commonName}>
                          {tDomain(language, s.commonName)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Hatua ya Uendeshaji', 'Operation Stage')}
                    </label>
                    <select
                      value={operationStage}
                      onChange={(e) => setOperationStage(e.target.value as OperationType)}
                      className={INPUT_CLASS}
                    >
                      <option value="Hatchery">{tDomain(language, 'Hatchery')}</option>
                      <option value="Nursery">{tDomain(language, 'Nursery')}</option>
                      <option value="Grow-out Pond">{tDomain(language, 'Grow-out Pond')}</option>
                      <option value="Cage Farming">{tDomain(language, 'Cage Farming')}</option>
                      <option value="Tank Farming">{tDomain(language, 'Tank Farming')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Uwezo wa Juu wa Samaki', 'Max Fish Capacity')}
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
                      {tr(language, 'Ujazo (m³)', 'Volume (m³)')}
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

                {/* Infrastructure asset pin tool */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <select
                    value={infraTypeToPlace}
                    onChange={(e) =>
                      setInfraTypeToPlace(e.target.value as InfrastructureMarkerType)
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                  >
                    {INFRA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {tDomain(language, t)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => toggleMapTool('infra')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      activeMapTool === 'infra'
                        ? 'bg-[#1D72E8] text-white'
                        : 'border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                    }`}
                  >
                    {activeMapTool === 'infra'
                      ? tr(language, 'Gusa ramani kuweka...', 'Tap map to place...')
                      : tr(language, '+ Weka bomba / kihisi', '+ Pin inlet / outlet / sensor')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Review & Save Accordion */}
          <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setReviewOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    measurement?.valid ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span>{tr(language, 'Kagua na Hifadhi', 'Review & Save')}</span>
                {measurement?.valid && (
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                    {measurement.areaSqm.toLocaleString()} m² · {measurement.perimeterM} m
                  </span>
                )}
              </span>
              {reviewOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {reviewOpen && (
              <div className="space-y-2 border-t border-slate-200 p-3 text-xs dark:border-slate-800">
                {measurement && !measurement.valid && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
                    {measurement.error}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                    <div className="text-[10px] text-slate-500">{tr(language, 'Eneo', 'Area')}</div>
                    <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                      {measurement?.valid ? `${measurement.areaSqm.toLocaleString()} m²` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                    <div className="text-[10px] text-slate-500">{tr(language, 'Mzingo', 'Perimeter')}</div>
                    <div className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                      {measurement?.valid ? `${measurement.perimeterM.toLocaleString()} m` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                    <div className="text-[10px] text-slate-500">{tr(language, 'Chanzo', 'Source')}</div>
                    <div className="truncate font-semibold text-slate-800 dark:text-slate-200">
                      {boundarySource === 'GPS_WALK'
                        ? tr(language, 'Matembezi ya GPS', 'GPS Walk')
                        : boundarySource === 'IMPORT'
                          ? 'GPX/GeoJSON'
                          : tr(language, 'Ramani ya Satelaiti', 'Satellite Map')}
                    </div>
                  </div>
                </div>
                {rawGpsTrack && rawGpsTrack.length > 0 && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {tr(
                      language,
                      `Njia ya GPS (nukta ${rawGpsTrack.length}) imehifadhiwa pamoja na umbo la mwisho.`,
                      `GPS track (${rawGpsTrack.length} points) preserved with final geometry.`
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Row matching reference image */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <X className="h-3.5 w-3.5" /> {tr(language, 'Ghairi', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#15803d] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saveButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Leaflet Map + Compact Directory Preview Below */}
      <div className="space-y-4 xl:col-span-7">
        {isMapFullscreen && (
          <div
            className="fixed inset-0 z-[890] bg-slate-950/70 backdrop-blur-[2px]"
            onClick={() => setIsMapFullscreen(false)}
          />
        )}
        <div
          className={
            isMapFullscreen
              ? 'fixed inset-3 z-[900] flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-900 shadow-2xl dark:border-slate-700'
              : 'relative h-[340px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-rest sm:h-[430px] lg:h-[465px] dark:border-slate-700'
          }
        >
          <div ref={mapContainerRef} className="h-full w-full flex-1" />

          {/* Top Overlay Row: Zoom to Farm + Map Style Switcher (wraps cleanly on mobile) */}
          <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[400] flex flex-wrap items-center justify-between gap-1.5 sm:inset-x-3 sm:top-3">
            <button
              type="button"
              onClick={handleZoomToFarm}
              className="pointer-events-auto inline-flex max-w-[165px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-md backdrop-blur-xs hover:bg-white sm:max-w-none sm:px-3 sm:text-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">
                {tr(language, 'Kuza:', 'Zoom to')} {selectedFarm?.region || tr(language, 'Shamba', 'Farm')}
              </span>
            </button>

            <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
              {(['satellite', 'street', 'terrain'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setMapStyle(style)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap sm:px-2.5 ${
                    mapStyle === style
                      ? 'bg-[#1D72E8] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {style === 'satellite'
                    ? tr(language, 'Satelaiti', 'Satellite')
                    : style === 'street'
                      ? tr(language, 'Mtaa', 'Street')
                      : tr(language, 'Mandhari', 'Terrain')}
                </button>
              ))}
            </div>
          </div>

          {/* Left Floating Vertical Controls: + / - / GPS / Fullscreen */}
          <div className="pointer-events-auto absolute left-2.5 top-24 z-[400] flex flex-col gap-2 sm:left-3 sm:top-14">
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn()}
                aria-label={tr(language, 'Kuza zaidi', 'Zoom in')}
                className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut()}
                aria-label={tr(language, 'Punguza ukuzaji', 'Zoom out')}
                className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200"
              >
                −
              </button>
            </div>
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locatingGps}
              title={tr(language, 'Tumia eneo la GPS la sasa', 'Use current GPS location')}
              aria-label={tr(language, 'Tumia eneo la GPS la sasa', 'Use current GPS location')}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-sky-600 shadow-md backdrop-blur-xs hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/95 dark:text-sky-400"
            >
              {locatingGps ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsMapFullscreen((v) => !v)}
              title={
                isMapFullscreen
                  ? tr(language, 'Funga skrini nzima', 'Exit full-screen map')
                  : tr(language, 'Panua skrini nzima', 'Expand full-screen map')
              }
              aria-label={
                isMapFullscreen
                  ? tr(language, 'Funga skrini nzima', 'Exit full-screen map')
                  : tr(language, 'Panua skrini nzima', 'Expand full-screen map')
              }
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
            >
              {isMapFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Floating Selected / Active Boundary Inspection Card (matches reference image) */}
          {(measurement?.valid || inspectedNeighborPond) && (
            <div className="pointer-events-auto absolute inset-x-2.5 bottom-2.5 z-[400] rounded-2xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-xs sm:inset-x-auto sm:bottom-3 sm:left-3 sm:max-w-sm dark:border-slate-700 dark:bg-slate-900/95">
              {inspectedNeighborPond ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {inspectedNeighborPond.name} ({inspectedNeighborPond.code}){' '}
                        {tr(language, 'imechaguliwa', 'selected')}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-300">
                        {tr(language, 'Eneo:', 'Area:')}{' '}
                        {inspectedNeighborPond.areaSqm
                          ? `${(inspectedNeighborPond.areaSqm / 10000).toFixed(2)} ha (${inspectedNeighborPond.areaSqm.toLocaleString()} m²)`
                          : inspectedNeighborPond.dimensions}{' '}
                        | {tr(language, 'Mzingo:', 'Perimeter:')} {inspectedNeighborPond.perimeterM ?? '—'} m
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedNeighborPond(null)}
                    aria-label={tr(language, 'Funga ukaguzi wa bwawa', 'Close pond inspection')}
                    className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                measurement?.valid && (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {name || code} {tr(language, 'tayari', 'ready')}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-300">
                        {tr(language, 'Eneo:', 'Area:')} {(measurement.areaSqm / 10000).toFixed(2)} ha (
                        {measurement.areaSqm.toLocaleString()} m²) | {tr(language, 'Mzingo:', 'Perimeter:')}{' '}
                        {measurement.perimeterM.toLocaleString()} m
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Optional Registered Ponds preview table right below map */}
        {bottomRightSlot}
      </div>
    </div>
  );
};
