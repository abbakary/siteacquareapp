import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  Fish,
  Home,
  List,
  MapPin,
  MoreVertical,
  PlusCircle,
  QrCode,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Waves,
  Wrench,
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
  Card,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  getStaggerDelay,
  MapSkeleton,
  PullToRefresh,
  useLanguage,
} from '../../ui';
import { tDomain, tr } from '../../i18n/translations';
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

export type FarmsModuleSection =
  | 'overview'
  | 'map'
  | 'register-pond'
  | 'register-farm'
  | 'directory';

interface FarmPondsModuleProps {
  state: AquacultureState;
  selectedFarmId: string;
  activeSection?: FarmsModuleSection;
  onSectionChange?: (section: FarmsModuleSection) => void;
  onSelectFarmId?: (farmId: string) => void;
  onSelectPondQr: (pond: Pond) => void;
  onSaveFarmLocation: (
    payload: SaveFarmLocationPayload
  ) => { ok: boolean; farmId?: string; error?: string };
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
  activeSection: controlledSection,
  onSectionChange,
  onSelectFarmId,
  onSelectPondQr,
  onSaveFarmLocation,
  onSavePondGis,
  onAddInfrastructureMarker,
  onToggleAerator,
}) => {
  const { language } = useLanguage();
  const [internalSection, setInternalSection] = useState<FarmsModuleSection>('register-pond');
  const currentSection = controlledSection ?? internalSection;

  const setSection = (next: FarmsModuleSection) => {
    setInternalSection(next);
    onSectionChange?.(next);
  };

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

  // Placing infrastructure directly on interactive map
  const [placingInfra, setPlacingInfra] = useState(false);
  const [placingInfraType, setPlacingInfraType] = useState<InfrastructureMarkerType>('Water Inlet');
  const [placingInfraPondCode, setPlacingInfraPondCode] = useState<string>('');

  const [editingPond, setEditingPond] = useState<Pond | null>(null);
  const [exportingGeoJson, setExportingGeoJson] = useState(false);

  // GPS locate on Farm Map
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [userLocation, setUserLocation] = useState<{
    gps: [number, number];
    accuracyM?: number;
    placeName?: string;
  } | null>(null);

  // Sync top-header farm selector without reloading
  useEffect(() => {
    if (selectedFarmId && selectedFarmId !== mapFarmId) {
      setMapFarmId(selectedFarmId);
      setFocusedPondId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmId]);

  const selectFarm = (fid: string) => {
    setMapFarmId(fid);
    setFocusedPondId(null);
    onSelectFarmId?.(fid);
  };

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

  // KPI summary stats matching the 4-card top strip
  const totalFarmsCount = state.farms.length;
  const totalUnitsCount = state.ponds.length;
  const totalFishCapacity = useMemo(
    () => state.ponds.reduce((sum, p) => sum + (p.maxCapacity || 0), 0),
    [state.ponds]
  );
  const operationalPct = useMemo(() => {
    if (state.ponds.length === 0) return 100;
    const healthyCount = state.ponds.filter(
      (p) => p.status === 'Healthy' || p.status === 'Harvest Ready'
    ).length;
    return Math.round((healthyCount / state.ponds.length) * 100);
  }, [state.ponds]);

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
      selectFarm(matchedFarm.id);
    }
  };

  const handleExportGeoJson = async () => {
    setExportingGeoJson(true);
    try {
      const payload = {
        ponds:
          mapFarmId === 'all'
            ? state.ponds
            : state.ponds.filter((p) => p.farmId === mapFarmId),
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

      downloadGeoJsonFile(
        `dukaaqusmart-gis-${mapFarmId}-${todayIso()}.geojson`,
        featureCollection
      );
    } finally {
      setExportingGeoJson(false);
    }
  };

  const handleUseMyLocationOnMap = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError(tr(language, 'Eneo halipatikani kwenye kivinjari hiki.', 'Location is unavailable on this browser.'));
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
            ? tr(
                language,
                'Ruhusa ya eneo imezuiwa. Ruhusu eneo kwenye mipangilio ya kivinjari.',
                'Location permission denied. Allow location access in browser settings.'
              )
            : tr(language, 'Imeshindikana kupata mawimbi ya GPS sasa hivi.', 'Could not get a GPS fix right now.')
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const openEditBoundary = (pond: Pond) => {
    setEditingPond(pond);
    setMapFarmId(pond.farmId);
    setSection('register-pond');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isRegistrationActive =
    currentSection === 'register-pond' || currentSection === 'register-farm';

  // Compact preview table shown below the map in Registration view (matching reference image)
  const registrationPreviewTable = (
    <Card className="p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-[#1D72E8]" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            {tr(language, 'Mabwawa, Matanki na Vizimba Vilivyosajiliwa', 'Registered Ponds, Tanks & Cages')}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />{' '}
          {tr(language, 'Udhibiti wa kuzuia kujaza samaki kupita kiasi umewashwa', 'Over-stocking capacity lock active')}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-2">{tr(language, 'Bwawa', 'Pond')}</th>
              <th className="py-2 px-2">{tr(language, 'Aina', 'Type')}</th>
              <th className="py-2 px-2">{tr(language, 'Spishi', 'Species')}</th>
              <th className="py-2 px-2 text-right">{tr(language, 'Idadi', 'Stocking')}</th>
              <th className="py-2 px-2 text-right">{tr(language, 'Eneo na Mzingo', 'Area & Perimeter')}</th>
              <th className="py-2 px-2">{tr(language, 'Hali', 'Status')}</th>
              <th className="py-2 pl-2 text-right">{tr(language, 'Vitendo', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPonds.slice(0, 5).map((pond) => (
              <tr
                key={pond.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="py-2 pr-2 font-mono font-bold text-slate-900 dark:text-white">
                  {pond.code}
                </td>
                <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                  {tDomain(language, pond.unitType)}
                </td>
                <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200">
                  {pond.species}
                </td>
                <td className="py-2 px-2 text-right font-semibold text-slate-900 tabular-nums dark:text-white">
                  {formatNumber(pond.currentFish)}
                </td>
                <td className="py-2 px-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                  <div>
                    {pond.areaSqm
                      ? pond.areaSqm >= 1000
                        ? `${(pond.areaSqm / 10000).toFixed(2)} ha`
                        : `${pond.areaSqm.toLocaleString()} m²`
                      : `${pond.waterCapacityM3} m³`}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {pond.perimeterM ? `(${pond.perimeterM} m)` : pond.dimensions}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <Badge
                    variant={
                      pond.status === 'Healthy' || pond.status === 'Harvest Ready'
                        ? 'success'
                        : pond.status === 'Attention'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {tDomain(language, pond.status)}
                  </Badge>
                </td>
                <td className="py-2 pl-2 text-right">
                  <button
                    type="button"
                    onClick={() => openEditBoundary(pond)}
                    title={tr(language, 'Hariri mpaka wa bwawa au angalia profaili', 'Edit pond boundary or view profile')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredPonds.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-500">
                  {tr(
                    language,
                    'Hakuna mabwawa, vizimba au matanki yaliyosajiliwa kwa shamba hili bado.',
                    'No ponds, cages, or tanks registered for this farm yet.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div className="space-y-4">
        {/* TOP 4 KPI SUMMARY CARDS (matching reference image) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-rest dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1D72E8] text-white shadow-xs">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold leading-tight text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={totalFarmsCount} />
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tr(language, 'Jumla ya Mashamba', 'Total Farms')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-rest dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#059669] text-white shadow-xs">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold leading-tight text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={totalUnitsCount} />
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tr(language, 'Mabwawa na Vizimba', 'Total Ponds & Units')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-rest dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#081C3A] text-white shadow-xs dark:bg-sky-700">
              <Fish className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold leading-tight text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber
                  value={totalFishCapacity}
                  formatter={(v) => formatNumber(v)}
                />
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tr(language, 'Uwezo wa Samaki', 'Fish Capacity')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-rest dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold leading-tight text-slate-900 tabular-nums dark:text-white">
                {operationalPct}%
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tr(language, 'Inafanya Kazi', 'Operational')}
              </div>
            </div>
          </div>
        </div>

        {/* 4-SECTION NAVIGATION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'overview', label: tr(language, 'Muhtasari wa Mashamba', 'Farm Overview'), icon: Building2 },
                { id: 'map', label: tr(language, 'Ramani ya Shamba', 'Farm Map'), icon: MapPin },
                { id: 'register-pond', label: tr(language, 'Usajili', 'Registration'), icon: PlusCircle },
                { id: 'directory', label: tr(language, 'Orodha ya Mabwawa', 'Pond & Cage Directory'), icon: List },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive =
                tab.id === 'register-pond'
                  ? isRegistrationActive
                  : currentSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id !== 'register-pond') {
                      setEditingPond(null);
                    }
                    setSection(tab.id);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#081C3A] text-white shadow-xs dark:bg-[#1D72E8]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Single Farm Filter Selector */}
          {!isRegistrationActive && (
            <div className="flex items-center gap-2 pr-1">
              <select
                value={mapFarmId}
                onChange={(e) => selectFarm(e.target.value)}
                aria-label={tr(language, 'Chuja kwa shamba', 'Filter by farm')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">
                  {tr(language, `Mashamba Yote (${state.farms.length})`, `All Farms (${state.farms.length})`)}
                </option>
                {state.farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.region} — {f.name.split('—')[1]?.trim() || f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* SECTION 1: FARM OVERVIEW */}
        {currentSection === 'overview' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.farms.map((farm, idx) => {
              const isSelected = mapFarmId === farm.id;
              const farmPonds = state.ponds.filter((p) => p.farmId === farm.id);
              const farmFish = farmPonds.reduce((s, p) => s + p.currentFish, 0);
              const farmCap = farmPonds.reduce((s, p) => s + p.maxCapacity, 0);
              const farmAttention = farmPonds.filter((p) => p.status === 'Attention').length;
              return (
                <motion.div
                  key={farm.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: getStaggerDelay(idx),
                    duration: DURATIONS.base,
                    ease: EASE_OUT,
                  }}
                >
                  <Card
                    className={`flex h-full flex-col justify-between transition-colors ${
                      isSelected
                        ? 'border-sky-400 ring-1 ring-sky-400/40 dark:border-sky-500'
                        : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              selectFarm(farm.id);
                              setSection('map');
                            }}
                            className="text-left text-sm font-bold text-slate-900 hover:text-[#1D72E8] dark:text-white dark:hover:text-sky-400"
                          >
                            {farm.name}
                          </button>
                          <div className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            {farm.placeName ? `${farm.placeName} · ` : ''}
                            {farm.gps[0].toFixed(4)}, {farm.gps[1].toFixed(4)}
                          </div>
                        </div>
                        <Badge variant={farmAttention > 0 ? 'warning' : 'success'}>
                          {farmAttention > 0
                            ? tr(language, `Tahadhari ${farmAttention}`, `${farmAttention} Attention`)
                            : tDomain(language, 'Operational')}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/60">
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {tr(language, 'Mabwawa/Vizimba', 'Units')}
                          </div>
                          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                            {farmPonds.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {tr(language, 'Samaki Hai', 'Live Fish')}
                          </div>
                          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                            {formatNumber(farmFish)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {tr(language, 'Uwezo', 'Capacity')}
                          </div>
                          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                            {formatNumber(farmCap)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {tr(language, 'Maji:', 'Water:')}
                          </span>{' '}
                          {farm.waterSource}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {tr(language, 'Kibali cha FiRCIS:', 'FiRCIS Permit:')}
                          </span>{' '}
                          <span className="font-mono">{farm.fircisPermitNo}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Wrench className="h-3.5 w-3.5 text-sky-600" />
                        {farm.equipment.length} {tr(language, 'vifaa', 'equipment unit(s)')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          selectFarm(farm.id);
                          setSection('map');
                        }}
                        className="font-semibold text-[#1D72E8] hover:underline dark:text-sky-400"
                      >
                        {tr(language, 'Fungua kwenye Ramani →', 'Open on Farm Map →')}
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* SECTION 2: FARM MAP */}
        {currentSection === 'map' && (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchJump(e.target.value)}
                    placeholder={tr(language, 'Tafuta bwawa au shamba...', 'Find pond or farm...')}
                    className="w-48 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {filteredPonds.length} {tr(language, 'mabwawa/vizimba vinaonekana', 'production unit(s) visible')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowMapTools((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showMapTools
                    ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> {tr(language, 'Tabaka za ramani na vifaa', 'Map layers & assets')}
              </button>
            </div>

            {gpsError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {userLocation && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    {tr(language, 'GPS imepangwa:', 'GPS positioned:')}
                  </span>{' '}
                  <span className="text-slate-700 dark:text-slate-200">
                    {userLocation.placeName || tr(language, 'Majira ya sasa', 'Current coordinates')}
                  </span>{' '}
                  <span className="font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                    ({userLocation.gps[0].toFixed(5)}, {userLocation.gps[1].toFixed(5)}
                    {userLocation.accuracyM !== undefined
                      ? ` · ±${userLocation.accuracyM} m`
                      : ''}
                    )
                  </span>
                </div>
              </div>
            )}

            {showMapTools && (
              <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Tabaka:', 'Layers:')}
                    </span>
                    {(
                      [
                        { key: 'ponds', label: tr(language, 'Mabwawa na Vizimba', 'Ponds & Cages') },
                        { key: 'infrastructure', label: tr(language, 'Maji na Vifaa', 'Water & Equipment') },
                        { key: 'sensors', label: tr(language, 'Sensor', 'Sensors') },
                        { key: 'labels', label: tr(language, 'Lebo', 'Labels') },
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
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
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
                    <Download className="h-3.5 w-3.5" /> {tr(language, 'Pakua GeoJSON', 'Export GeoJSON')}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Weka alama ya maji / kifaa:', 'Pin water inlet / equipment:')}
                  </span>
                  <select
                    value={placingInfraType}
                    onChange={(e) =>
                      setPlacingInfraType(e.target.value as InfrastructureMarkerType)
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                  >
                    {INFRA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {tDomain(language, t)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={placingInfraPondCode}
                    onChange={(e) => setPlacingInfraPondCode(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">{tr(language, 'Shamba zima', 'Farm-wide')}</option>
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
                        ? 'bg-[#1D72E8] text-white'
                        : 'border border-sky-200 bg-sky-50 text-sky-700'
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    {placingInfra
                      ? tr(language, 'Gusa ramani kuweka...', 'Tap map to place...')
                      : tr(language, 'Weka Alama', 'Drop Pin')}
                  </button>
                </div>
              </div>
            )}

            <Suspense fallback={<MapSkeleton heightClass="h-[520px]" />}>
              <LeafletFarmMap
                ponds={state.ponds}
                farms={state.farms}
                selectedFarmId={mapFarmId}
                mapMode={mapMode}
                heightClass="h-[520px]"
                infrastructureMarkers={state.infrastructureMarkers || []}
                waterReadings={state.waterReadings}
                visibleLayers={visibleLayers}
                focusedPondId={focusedPondId}
                userLocation={userLocation}
                placingInfraType={placingInfra ? placingInfraType : null}
                interactiveOverlay
                onMapModeChange={setMapMode}
                onRequestGps={handleUseMyLocationOnMap}
                locatingGps={locatingGps}
                onSelectFarm={(fid) => selectFarm(fid)}
                onSelectPond={(pond) => setFocusedPondId(pond.id)}
                onClearFocusedPond={() => setFocusedPondId(null)}
                onEditPondBoundary={openEditBoundary}
                onOpenPondProfile={onSelectPondQr}
                onPlaceInfraMarker={(gps) => {
                  const targetFarmId =
                    mapFarmId === 'all' ? state.farms[0].id : mapFarmId;
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

            <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              {tr(
                language,
                'Chagua bwawa, kizimba, au tanki lolote kwenye ramani kuona ukubwa, mzingo, na idadi ya samaki, au panua ramani kuwa skrini nzima.',
                'Select any pond, cage, or tank on the map to inspect its area, perimeter, and live stocking, or expand the map to full screen.'
              )}
            </p>
          </Card>
        )}

        {/* SECTION 3: GUIDED CONDITIONAL REGISTRATION */}
        {isRegistrationActive && (
          <div className="space-y-3">
            {/* Single unified registration mode selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPond(null);
                    setSection('register-pond');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentSection === 'register-pond'
                      ? 'bg-[#1D72E8] text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Waves className="h-3.5 w-3.5" />{' '}
                  {tr(language, 'Sajili Bwawa / Kizimba / Tanki', 'Register Pond / Cage / Tank')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPond(null);
                    setSection('register-farm');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentSection === 'register-farm'
                      ? 'bg-[#1D72E8] text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" /> {tr(language, 'Sajili Shamba', 'Register Farm')}
                </button>
              </div>
            </div>

            {currentSection === 'register-farm' ? (
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
                onCancel={() => setSection('overview')}
                onSaveFarm={(payload) => {
                  const res = onSaveFarmLocation(payload);
                  if (res.ok) {
                    if (res.farmId) selectFarm(res.farmId);
                    setSection('map');
                  }
                  return res;
                }}
              />
            ) : (
              <PondRegistrationWorkspace
                key={editingPond?.id || 'new-unit'}
                state={state}
                defaultFarmId={mapFarmId}
                editingPond={editingPond}
                onFarmChange={(fid) => selectFarm(fid)}
                onCancel={() => {
                  setEditingPond(null);
                  setSection('map');
                }}
                onSavePond={(payload) => {
                  const res = onSavePondGis(payload);
                  if (res.ok) {
                    selectFarm(payload.farmId);
                    setEditingPond(null);
                    setSection('directory');
                  }
                  return res;
                }}
                bottomRightSlot={registrationPreviewTable}
              />
            )}
          </div>
        )}

        {/* SECTION 4: POND & CAGE DIRECTORY */}
        {currentSection === 'directory' && (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-[#1D72E8] dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {tr(language, 'Mabwawa, Matanki na Vizimba Vilivyosajiliwa', 'Registered Ponds, Tanks & Cages')}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tr(language, 'Chuja kwa msimbo, spishi, aina...', 'Filter by code, species, type...')}
                    className="w-52 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />{' '}
                  {tr(language, 'Ulinzi wa uwezo wa kupakia umefungwa', 'Over-stocking capacity lock active')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">{tr(language, 'Bwawa / Kituo', 'Pond / Unit')}</th>
                    <th className="py-2">{tr(language, 'Aina', 'Type')}</th>
                    <th className="py-2">{tr(language, 'Spishi', 'Species')}</th>
                    <th className="py-2 text-right">{tr(language, 'Ujazaji', 'Stocking')}</th>
                    <th className="py-2 text-right">{tr(language, 'Eneo & Mzingo', 'Area & Perimeter')}</th>
                    <th className="py-2 pl-3">{tr(language, 'Njia ya Ramani', 'Mapped via')}</th>
                    <th className="py-2">{tr(language, 'Hali', 'Status')}</th>
                    <th className="py-2">{tr(language, 'Kipulizia Hewa', 'Aerator')}</th>
                    <th className="py-2 text-right">{tr(language, 'Vitendo', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPonds.map((pond) => (
                    <tr
                      key={pond.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => {
                            selectFarm(pond.farmId);
                            setFocusedPondId(pond.id);
                            setSection('map');
                          }}
                          className="text-left hover:text-[#1D72E8] dark:hover:text-sky-400"
                        >
                          {pond.code}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            ({pond.name})
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">
                        {tDomain(language, pond.unitType)}
                      </td>
                      <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                        {tDomain(language, pond.species)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatNumber(pond.currentFish)} /{' '}
                        <span className="font-normal text-slate-500">
                          {formatNumber(pond.maxCapacity)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-700 tabular-nums dark:text-slate-300">
                        <div className="font-semibold">
                          {pond.areaSqm
                            ? `${pond.areaSqm.toLocaleString()} m²`
                            : `${pond.waterCapacityM3} m³`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {pond.perimeterM ? `${pond.perimeterM} m` : pond.dimensions}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3 text-[11px]">
                        <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                          {pond.boundaryVerified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <span>
                            {pond.mappingMethod
                              ? tDomain(language, pond.mappingMethod)
                              : tr(language, 'Msingi wa Usajili', 'Registry Seed')}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            pond.status === 'Healthy' || pond.status === 'Harvest Ready'
                              ? 'success'
                              : pond.status === 'Attention'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {tDomain(language, pond.status)}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => onToggleAerator(pond.id)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            pond.aeratorRelayOn
                              ? 'bg-[#1D72E8] text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {pond.aeratorRelayOn
                            ? tr(language, 'Imewashwa', 'Relay ON')
                            : tr(language, 'Tayari', 'Standby')}
                        </button>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditBoundary(pond)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <Edit3 className="h-3 w-3" /> {tr(language, 'Hariri Ramani', 'Edit Map')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectPondQr(pond)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                          >
                            <QrCode className="h-3.5 w-3.5" /> {tr(language, 'Profaili', 'Profile')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPonds.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-xs text-slate-500">
                        {tr(
                          language,
                          'Hakuna mabwawa, vizimba, au matanki yanayolingana.',
                          'No matching ponds, cages, or tanks found.'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
};
