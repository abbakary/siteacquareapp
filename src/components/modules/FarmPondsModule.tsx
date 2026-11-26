import React, { lazy, Suspense, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Plus,
  QrCode,
  Wrench,
  ShieldCheck,
  Waves,
  Download,
  Search,
  SlidersHorizontal,
  Edit3,
  PlusCircle,
  Compass,
  CheckCircle2,
  Building2,
  Crosshair,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  AquacultureState,
  InfrastructureMarkerType,
  MapViewMode,
  Pond,
} from '../../types/aquaculture';
import { formatNumber, todayIso } from '../../utils/formatters';
import { downloadGeoJsonFile } from '../../utils/gis';
import { buildGeoJsonFeatureCollection } from '../../utils/gisGeometry';
import {
  Badge,
  Button,
  Card,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  getStaggerDelay,
  MapSkeleton,
  PullToRefresh,
} from '../../ui';
import {
  PondRegistrationWorkspace,
  SavePondGisPayload,
} from '../gis/PondRegistrationWorkspace';
import {
  FarmLocationAssistant,
  SaveFarmLocationPayload,
} from '../gis/FarmLocationAssistant';
import { GisLayerVisibility } from '../LeafletFarmMap';

const LeafletFarmMap = lazy(() =>
  import('../LeafletFarmMap').then((m) => ({ default: m.LeafletFarmMap }))
);

interface FarmPondsModuleProps {
  state: AquacultureState;
  selectedFarmId: string;
  onSelectPondQr: (pond: Pond) => void;
  onSaveFarmLocation: (payload: SaveFarmLocationPayload) => { ok: boolean; farmId?: string; error?: string };
  onSavePondGis: (payload: SavePondGisPayload) => { ok: boolean; error?: string };
  onAddInfrastructureMarker: (marker: {
    farmId: string;
    pondCode?: string;
    type: InfrastructureMarkerType;
    label: string;
    gps: [number, number];
  }) => void;
  onToggleAerator: (pondId: string) => void;
}

const INFRA_TYPES: InfrastructureMarkerType[] = [
  'Water Inlet',
  'Water Outlet',
  'Drainage Channel',
  'Borehole',
  'Pump',
  'Aerator',
  'Water Sensor',
  'Feeder',
  'Generator',
  'Security',
];

export const FarmPondsModule: React.FC<FarmPondsModuleProps> = ({
  state,
  selectedFarmId,
  onSelectPondQr,
  onSaveFarmLocation,
  onSavePondGis,
  onAddInfrastructureMarker,
  onToggleAerator,
}) => {
  const [mapMode, setMapMode] = useState<MapViewMode>('satellite');
  const [mapFarmId, setMapFarmId] = useState<string>(selectedFarmId || 'farm-dsm');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedPondId, setFocusedPondId] = useState<string | null>(null);
  const [showMapTools, setShowMapTools] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<GisLayerVisibility>({
    ponds: true,
    infrastructure: true,
    sensors: true,
    labels: true,
  });

  // Placing infrastructure directly on Digital Twin map
  const [placingInfra, setPlacingInfra] = useState(false);
  const [placingInfraType, setPlacingInfraType] = useState<InfrastructureMarkerType>('Water Inlet');
  const [placingInfraPondCode, setPlacingInfraPondCode] = useState<string>('');

  // Streamlined Assistant mode: none | 'farm' | 'pond'
  const [activeAssistant, setActiveAssistant] = useState<'none' | 'farm' | 'pond'>('none');
  const [editingPond, setEditingPond] = useState<Pond | null>(null);
  const [exportingGeoJson, setExportingGeoJson] = useState(false);

  // Direct "Use my current location" on the Farm Map
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [userLocation, setUserLocation] = useState<{
    gps: [number, number];
    accuracyM?: number;
    placeName?: string;
  } | null>(null);

  const filteredPonds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.ponds.filter((p) => {
      if (mapFarmId !== 'all' && p.farmId !== mapFarmId) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        p.unitType.toLowerCase().includes(q)
      );
    });
  }, [state.ponds, mapFarmId, searchQuery]);

  const handleSearchJump = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();
    if (!q) {
      setFocusedPondId(null);
      return;
    }
    const matchedPond = state.ponds.find(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );
    if (matchedPond) {
      setMapFarmId(matchedPond.farmId);
      setFocusedPondId(matchedPond.id);
      return;
    }
    const matchedFarm = state.farms.find(
      (f) => f.name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q)
    );
    if (matchedFarm) {
      setMapFarmId(matchedFarm.id);
      setFocusedPondId(null);
    }
  };

  const handleExportGeoJson = async () => {
    setExportingGeoJson(true);
    try {
      const payload = {
        ponds: mapFarmId === 'all' ? state.ponds : state.ponds.filter((p) => p.farmId === mapFarmId),
        farms: state.farms,
        infrastructureMarkers:
          mapFarmId === 'all'
            ? state.infrastructureMarkers || []
            : (state.infrastructureMarkers || []).filter((m) => m.farmId === mapFarmId),
      };

      let featureCollection: unknown;
      if (!state.offlineMode) {
        try {
          const res = await fetch('/api/gis/export-geojson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            featureCollection = await res.json();
          }
        } catch {
          // fallback to local GeoJSON builder
        }
      }

      if (!featureCollection) {
        featureCollection = buildGeoJsonFeatureCollection(payload);
      }

      downloadGeoJsonFile(`dukaaqusmart-gis-${mapFarmId}-${todayIso()}.geojson`, featureCollection);
    } finally {
      setExportingGeoJson(false);
    }
  };

  const handleUseMyLocationOnMap = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Location is unavailable on this browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracyM = Math.round(pos.coords.accuracy);
        let placeName = '';
        try {
          const res = await fetch(
            `/api/gis/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { placeName?: string };
            placeName = data.placeName || '';
          }
        } catch {
          // ignore offline
        }
        setUserLocation({ gps: [lat, lng], accuracyM, placeName });
        setLocatingGps(false);
      },
      (err) => {
        setLocatingGps(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Allow location access in browser settings or click Register Farm to search your village.'
            : 'Could not get a GPS fix right now. Click Register Farm to search your village or tap the satellite map.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const openNewFarmAssistant = () => {
    setEditingPond(null);
    setActiveAssistant('farm');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewPondAssistant = () => {
    setEditingPond(null);
    setActiveAssistant('pond');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditBoundary = (pond: Pond) => {
    setEditingPond(pond);
    setActiveAssistant('pond');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div className="space-y-4">
        {/* Clean Header with Two Primary Actions */}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Farms, Ponds & Satellite Map
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Locate farms with GPS or place search, walk pond boundaries on your phone, and inspect live stocking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openNewFarmAssistant}>
              <Building2 className="h-4 w-4" /> Register Farm
            </Button>
            <Button variant="primary" size="sm" onClick={openNewPondAssistant}>
              <Plus className="h-4 w-4" /> Register Pond / Cage / Tank
            </Button>
          </div>
        </Card>

        {/* Quick Location Farm Registration Assistant */}
        <AnimatePresence>
          {activeAssistant === 'farm' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            >
              <FarmLocationAssistant
                existingFarms={state.farms}
                initialLocation={
                  userLocation
                    ? {
                        gps: userLocation.gps,
                        accuracyM: userLocation.accuracyM,
                        placeName: userLocation.placeName,
                        source: 'GPS',
                      }
                    : null
                }
                onCancel={() => setActiveAssistant('none')}
                onSaveFarm={(payload) => {
                  const res = onSaveFarmLocation(payload);
                  if (res.ok) {
                    if (res.farmId) setMapFarmId(res.farmId);
                    setActiveAssistant('none');
                  }
                  return res;
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guided Pond Boundary Assistant (Walk GPS / Tap Satellite) */}
        <AnimatePresence>
          {activeAssistant === 'pond' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            >
              <PondRegistrationWorkspace
                state={state}
                defaultFarmId={mapFarmId}
                editingPond={editingPond}
                onCancel={() => {
                  setActiveAssistant('none');
                  setEditingPond(null);
                }}
                onSavePond={(payload) => {
                  const res = onSavePondGis(payload);
                  if (res.ok) {
                    setMapFarmId(payload.farmId);
                    setActiveAssistant('none');
                    setEditingPond(null);
                  }
                  return res;
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Farms List + Clean Google-Maps-Style Farm Map */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            {state.farms.map((farm, idx) => {
              const isSelected = mapFarmId === farm.id;
              const farmPondCount = state.ponds.filter((p) => p.farmId === farm.id).length;
              return (
                <motion.div
                  key={farm.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
                >
                  <Card
                    className={`transition-colors ${
                      isSelected
                        ? 'border-sky-400 ring-1 ring-sky-400/40 dark:border-sky-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setMapFarmId(farm.id);
                            setFocusedPondId(null);
                          }}
                          className="text-left text-sm font-bold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300"
                        >
                          {farm.name}
                        </button>
                        <div className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {farm.placeName ? `${farm.placeName} · ` : ''}
                          {farm.gps[0].toFixed(4)}, {farm.gps[1].toFixed(4)}
                        </div>
                      </div>
                      <Badge variant={isSelected ? 'info' : 'success'}>
                        {farm.region} · {farmPondCount}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Water:</span>{' '}
                        {farm.waterSource}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Permit:</span>{' '}
                        {farm.fircisPermitNo}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Wrench className="h-3.5 w-3.5 text-sky-600" />
                        {farm.equipment.length} equipment unit(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMapFarmId(farm.id);
                          setFocusedPondId(null);
                        }}
                        className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                      >
                        Show on map →
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* RIGHT 8 COLS: Uncluttered Google-Maps-Style Farm Map */}
          <Card className="lg:col-span-8">
            <div className="mb-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Live Farm Map
                  </h3>
                </div>

                {/* Clean View Mode Switcher */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  {(
                    [
                      { id: 'satellite', label: 'Satellite' },
                      { id: 'street', label: 'Street' },
                      { id: 'terrain', label: 'Terrain' },
                      { id: 'infrastructure', label: 'Farm Assets' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setMapMode(mode.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        mapMode === mode.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Search + Farm Selector + Use My Current Location + Optional Map Tools */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseMyLocationOnMap}
                    disabled={locatingGps}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284c7] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0369a1] disabled:opacity-60"
                  >
                    {locatingGps ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Crosshair className="h-3.5 w-3.5" />
                    )}
                    {locatingGps ? 'Finding location...' : 'Use my current location'}
                  </button>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchJump(e.target.value)}
                      placeholder="Find pond or farm..."
                      className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <select
                    value={mapFarmId}
                    onChange={(e) => {
                      setMapFarmId(e.target.value);
                      setFocusedPondId(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Farms ({state.farms.length})</option>
                    {state.farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.region} — {f.name.split('—')[1]?.trim() || f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMapTools((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showMapTools
                      ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Map tools
                </button>
              </div>

              {gpsError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{gpsError}</span>
                </div>
              )}

              {userLocation && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      Current location found:
                    </span>{' '}
                    <span className="text-slate-700 dark:text-slate-200">
                      {userLocation.placeName || 'GPS position ready'}
                    </span>{' '}
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                      ({userLocation.gps[0].toFixed(5)}, {userLocation.gps[1].toFixed(5)}
                      {userLocation.accuracyM !== undefined ? ` · ±${userLocation.accuracyM} m` : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openNewFarmAssistant}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                    >
                      Register Farm Here
                    </button>
                    <button
                      type="button"
                      onClick={openNewPondAssistant}
                      className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-800 dark:text-sky-300"
                    >
                      Register Pond Here
                    </button>
                  </div>
                </div>
              )}

              {/* Optional Map Tools Drawer (Layers, Asset Pins, GeoJSON Export) */}
              {showMapTools && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Show:</span>
                      {(
                        [
                          { key: 'ponds', label: 'Ponds' },
                          { key: 'infrastructure', label: 'Water & Equipment' },
                          { key: 'sensors', label: 'Sensors' },
                          { key: 'labels', label: 'Labels' },
                        ] as const
                      ).map((layer) => (
                        <button
                          key={layer.key}
                          type="button"
                          onClick={() =>
                            setVisibleLayers((prev) => ({
                              ...prev,
                              [layer.key]: !prev[layer.key],
                            }))
                          }
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            visibleLayers[layer.key]
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                          }`}
                        >
                          {layer.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleExportGeoJson}
                      disabled={exportingGeoJson}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Download className="h-3.5 w-3.5" /> Export GeoJSON
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Pin water inlet / equipment:
                    </span>
                    <select
                      value={placingInfraType}
                      onChange={(e) => setPlacingInfraType(e.target.value as InfrastructureMarkerType)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      {INFRA_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      value={placingInfraPondCode}
                      onChange={(e) => setPlacingInfraPondCode(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Farm-wide</option>
                      {state.ponds
                        .filter((p) => mapFarmId === 'all' || p.farmId === mapFarmId)
                        .map((p) => (
                          <option key={p.id} value={p.code}>
                            {p.code}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setPlacingInfra((v) => !v)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        placingInfra
                          ? 'bg-sky-600 text-white'
                          : 'border border-sky-200 bg-sky-50 text-sky-700'
                      }`}
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {placingInfra ? 'Tap map to place...' : 'Drop Pin'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Suspense fallback={<MapSkeleton heightClass="h-[420px]" />}>
              <LeafletFarmMap
                ponds={state.ponds}
                farms={state.farms}
                selectedFarmId={mapFarmId}
                mapMode={mapMode}
                heightClass="h-[420px]"
                infrastructureMarkers={state.infrastructureMarkers || []}
                waterReadings={state.waterReadings}
                visibleLayers={visibleLayers}
                focusedPondId={focusedPondId}
                userLocation={userLocation}
                placingInfraType={placingInfra ? placingInfraType : null}
                onSelectFarm={(fid) => setMapFarmId(fid)}
                onSelectPond={(pond) => {
                  setFocusedPondId(pond.id);
                  onSelectPondQr(pond);
                }}
                onPlaceInfraMarker={(gps) => {
                  const targetFarmId = mapFarmId === 'all' ? state.farms[0].id : mapFarmId;
                  onAddInfrastructureMarker({
                    farmId: targetFarmId,
                    pondCode: placingInfraPondCode || undefined,
                    type: placingInfraType,
                    label: placingInfraPondCode
                      ? `${placingInfraPondCode} ${placingInfraType}`
                      : placingInfraType,
                    gps,
                  });
                  setPlacingInfra(false);
                }}
              />
            </Suspense>

            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Tap any pond on the satellite map to view live stocking, area, water quality & QR profile.
            </p>
          </Card>
        </div>

        {/* Live Pond Status Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {filteredPonds.map((pond, idx) => {
            const fillPct = Math.min(
              100,
              Math.round((pond.currentFish / Math.max(1, pond.maxCapacity)) * 100)
            );
            return (
              <motion.div
                key={pond.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
              >
                <Card
                  hoverable
                  pondWaveStatus={pond.status === 'Harvest Ready' ? 'Healthy' : pond.status}
                  className="cursor-pointer p-3.5 text-xs"
                  onClick={() => {
                    setMapFarmId(pond.farmId);
                    setFocusedPondId(pond.id);
                    onSelectPondQr(pond);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {pond.code}
                    </span>
                    <Badge
                      variant={
                        pond.status === 'Healthy'
                          ? 'success'
                          : pond.status === 'Attention'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {pond.status}
                    </Badge>
                  </div>
                  <div className="mt-1 font-semibold text-slate-700 dark:text-slate-300">
                    {pond.name} · {pond.species}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    {pond.areaSqm ? `${pond.areaSqm.toLocaleString()} m²` : pond.dimensions} ·{' '}
                    {pond.perimeterM ? `${pond.perimeterM}m perim` : `${pond.waterCapacityM3} m³`}
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    <CountUpNumber value={pond.currentFish} formatter={(v) => formatNumber(v)} /> /{' '}
                    {formatNumber(pond.maxCapacity)} fish
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      className={`h-full rounded-full ${
                        pond.status === 'Attention'
                          ? 'bg-amber-500'
                          : pond.status === 'Preparing'
                            ? 'bg-slate-400'
                            : 'bg-emerald-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${fillPct}%` }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                    />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Ponds Directory Table */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Registered Ponds, Tanks & Cages
              </h3>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Over-stocking capacity lock active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">Pond</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Species</th>
                  <th className="py-2 text-right">Stocking</th>
                  <th className="py-2 text-right">Area & Perimeter</th>
                  <th className="py-2 pl-3">Mapped via</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Aerator</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPonds.map((pond) => (
                  <tr key={pond.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => {
                          setMapFarmId(pond.farmId);
                          setFocusedPondId(pond.id);
                        }}
                        className="text-left hover:text-sky-600 dark:hover:text-sky-400"
                      >
                        {pond.code}{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          ({pond.name})
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300">{pond.unitType}</td>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {pond.species}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums dark:text-white">
                      {formatNumber(pond.currentFish)} /{' '}
                      <span className="font-normal text-slate-500">{formatNumber(pond.maxCapacity)}</span>
                    </td>
                    <td className="py-2.5 text-right text-slate-700 tabular-nums dark:text-slate-300">
                      <div className="font-semibold">
                        {pond.areaSqm ? `${pond.areaSqm.toLocaleString()} m²` : `${pond.waterCapacityM3} m³`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {pond.perimeterM ? `${pond.perimeterM} m` : pond.dimensions}
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                        {pond.boundaryVerified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        <span>{pond.mappingMethod || 'Registry Seed'}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant={
                          pond.status === 'Healthy'
                            ? 'success'
                            : pond.status === 'Attention'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {pond.status}
                      </Badge>
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleAerator(pond.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          pond.aeratorRelayOn
                            ? 'bg-sky-600 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {pond.aeratorRelayOn ? 'Relay ON' : 'Standby'}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditBoundary(pond)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Edit3 className="h-3 w-3" /> Update map
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectPondQr(pond)}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
};
