import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  Crosshair,
  Edit3,
  Loader2,
  Maximize2,
  Minimize2,
  QrCode,
  Search,
  X,
} from 'lucide-react';
import {
  Farm,
  FarmInfrastructureMarker,
  InfrastructureMarkerType,
  MapViewMode,
  Pond,
  WaterQualityReading,
} from '../types/aquaculture';
import { usePreferences } from '../ui';
import { getTileConfigForMode, INFRASTRUCTURE_META } from '../utils/gis';
import { tDomain, tr } from '../i18n/translations';

export interface GisLayerVisibility {
  ponds: boolean;
  infrastructure: boolean;
  sensors: boolean;
  labels: boolean;
}

interface LeafletFarmMapProps {
  ponds: Pond[];
  farms: Farm[];
  selectedFarmId: string;
  mapMode: 'map' | MapViewMode;
  heightClass?: string;
  onSelectPond?: (pond: Pond) => void;
  onSelectFarm?: (farmId: string) => void;
  infrastructureMarkers?: FarmInfrastructureMarker[];
  waterReadings?: WaterQualityReading[];
  visibleLayers?: GisLayerVisibility;
  focusedPondId?: string | null;
  placingInfraType?: InfrastructureMarkerType | null;
  onPlaceInfraMarker?: (gps: [number, number]) => void;
  userLocation?: { gps: [number, number]; accuracyM?: number; placeName?: string } | null;
  /** Enables floating map controls (Zoom to Farm, Satellite/Street/Terrain, Fullscreen, GPS locate, Pond inspection card) */
  interactiveOverlay?: boolean;
  onMapModeChange?: (mode: MapViewMode) => void;
  onRequestGps?: () => void;
  locatingGps?: boolean;
  onEditPondBoundary?: (pond: Pond) => void;
  onOpenPondProfile?: (pond: Pond) => void;
  onClearFocusedPond?: () => void;
}

const DEFAULT_LAYERS: GisLayerVisibility = {
  ponds: true,
  infrastructure: true,
  sensors: true,
  labels: true,
};

export const LeafletFarmMap: React.FC<LeafletFarmMapProps> = ({
  ponds,
  farms,
  selectedFarmId,
  mapMode,
  heightClass = 'h-[195px]',
  onSelectPond,
  onSelectFarm,
  infrastructureMarkers = [],
  waterReadings = [],
  visibleLayers = DEFAULT_LAYERS,
  focusedPondId,
  placingInfraType,
  onPlaceInfraMarker,
  userLocation,
  interactiveOverlay = false,
  onMapModeChange,
  onRequestGps,
  locatingGps = false,
  onEditPondBoundary,
  onOpenPondProfile,
  onClearFocusedPond,
}) => {
  const { isDark, language } = usePreferences();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const primaryTileRef = useRef<L.TileLayer | null>(null);
  const overlayTileRef = useRef<L.TileLayer | null>(null);
  const pondGroupRef = useRef<L.LayerGroup | null>(null);
  const infraGroupRef = useRef<L.LayerGroup | null>(null);
  const userGroupRef = useRef<L.LayerGroup | null>(null);

  const placingRef = useRef(placingInfraType);
  placingRef.current = placingInfraType;
  const onPlaceRef = useRef(onPlaceInfraMarker);
  onPlaceRef.current = onPlaceInfraMarker;
  const onSelectPondRef = useRef(onSelectPond);
  onSelectPondRef.current = onSelectPond;
  const onSelectFarmRef = useRef(onSelectFarm);
  onSelectFarmRef.current = onSelectFarm;

  const activeFarm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const center: [number, number] = activeFarm ? activeFarm.gps : [-6.8664, 39.3278];
  const focusedPond = focusedPondId ? ponds.find((p) => p.id === focusedPondId) || null : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: selectedFarmId === 'all' ? 6 : 17,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: interactiveOverlay,
    });

    pondGroupRef.current = L.layerGroup().addTo(map);
    infraGroupRef.current = L.layerGroup().addTo(map);
    userGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (placingRef.current && onPlaceRef.current) {
        onPlaceRef.current([
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ]);
      }
    });

    const invalidate = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', invalidate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(containerRef.current);
    }

    const timer = window.setTimeout(invalidate, 150);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', invalidate);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-invalidate Leaflet dimensions smoothly on fullscreen toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t1 = window.setTimeout(() => map.invalidateSize({ animate: false }), 60);
    const t2 = window.setTimeout(() => map.invalidateSize({ animate: false }), 240);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    if (isFullscreen) {
      window.addEventListener('keydown', onKey);
    }
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  // Switch tile layers cleanly without losing selected pond or overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (primaryTileRef.current) {
      map.removeLayer(primaryTileRef.current);
      primaryTileRef.current = null;
    }
    if (overlayTileRef.current) {
      map.removeLayer(overlayTileRef.current);
      overlayTileRef.current = null;
    }

    const cfg = getTileConfigForMode(mapMode);
    primaryTileRef.current = L.tileLayer(cfg.primaryUrl, {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    }).addTo(map);
    primaryTileRef.current.bringToBack();

    if (cfg.overlayUrl) {
      overlayTileRef.current = L.tileLayer(cfg.overlayUrl, {
        maxZoom: cfg.maxZoom,
        opacity: mapMode === 'infrastructure' ? 0.45 : 0.9,
      }).addTo(map);
    }
  }, [mapMode]);

  // Recenter smoothly when selected farm changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedFarmId === 'all') {
      if (farms.length > 1) {
        const bounds = L.latLngBounds(farms.map((f) => f.gps));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 7 });
      }
      return;
    }
    if (activeFarm) {
      const farmPonds = ponds.filter((p) => p.farmId === activeFarm.id && p.polygon?.length >= 3);
      if (farmPonds.length > 0) {
        const allPts = farmPonds.flatMap((p) => p.polygon);
        map.fitBounds(L.latLngBounds(allPts), { padding: [38, 38], maxZoom: 18 });
      } else {
        map.flyTo(activeFarm.gps, 17, { duration: 0.65 });
      }
    }
  }, [selectedFarmId, activeFarm, farms, ponds.length]);

  // Fly to focused pond when selected from table or search
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedPondId) return;
    const target = ponds.find((p) => p.id === focusedPondId);
    if (!target) return;
    if (target.polygon && target.polygon.length >= 3) {
      map.fitBounds(L.latLngBounds(target.polygon), { padding: [48, 48], maxZoom: 19 });
    } else {
      map.flyTo(target.gps, 18, { duration: 0.6 });
    }
  }, [focusedPondId, ponds]);

  // Render pond polygons, labels, and farm pins
  useEffect(() => {
    const map = mapRef.current;
    const pondGroup = pondGroupRef.current;
    if (!map || !pondGroup) return;

    pondGroup.clearLayers();

    const visiblePonds =
      selectedFarmId === 'all' ? ponds : ponds.filter((p) => p.farmId === selectedFarmId);

    if (selectedFarmId === 'all' || visiblePonds.length === 0) {
      const farmsToPin = selectedFarmId === 'all' ? farms : activeFarm ? [activeFarm] : [];
      farmsToPin.forEach((farm) => {
        const farmPondCount = ponds.filter((p) => p.farmId === farm.id).length;
        const markerIcon = L.divIcon({
          className: 'custom-pond-pin',
          html: `<div style="background:#081c3a;color:#fff;font-weight:700;font-size:11px;padding:4px 10px;border-radius:9999px;border:2px solid #38bdf8;box-shadow:0 3px 8px rgba(0,0,0,0.4);white-space:nowrap;">${farm.region} (${farmPondCount})</div>`,
          iconSize: [120, 28],
          iconAnchor: [60, 14],
        });
        const fm = L.marker(farm.gps, { icon: markerIcon }).addTo(pondGroup);
        fm.bindPopup(
          `<div style="font-size:12px;line-height:1.45;min-width:190px;">
            <div style="font-weight:700;">${farm.name}</div>
            <div>${tr(language, 'Kibali cha FiRCIS', 'Permit')}: <strong>${farm.fircisPermitNo}</strong></div>
            <div>${tr(language, 'Chanzo cha Maji', 'Water Source')}: ${farm.waterSource}</div>
            <div style="margin-top:4px;color:#0284c7;font-weight:600;">${farmPondCount} ${tr(language, 'mabwawa/vizimba vilivyosajiliwa', 'mapped production units')}</div>
          </div>`
        );
        if (onSelectFarmRef.current) {
          fm.on('click', () => onSelectFarmRef.current?.(farm.id));
        }
      });
    }

    if (!visibleLayers.ponds) return;

    const isInfraMode = mapMode === 'infrastructure';

    visiblePonds.forEach((pond, idx) => {
      const isFocused = focusedPondId === pond.id;
      const isAttention = pond.status === 'Attention';
      const isPreparing = pond.status === 'Preparing';
      const isHarvestReady = pond.status === 'Harvest Ready';
      const strokeColor = isFocused
        ? '#2563eb'
        : isAttention
          ? '#f59e0b'
          : isHarvestReady
            ? '#0284c7'
            : isPreparing
              ? '#94a3b8'
              : '#22c55e';
      const fillColor = isFocused
        ? '#38bdf8'
        : isAttention
          ? '#fef3c7'
          : isHarvestReady
            ? '#bae6fd'
            : isPreparing
              ? '#cbd5e1'
              : '#10b981';

      const wq = waterReadings.find((w) => w.pondCode === pond.code);
      const areaLabel = pond.areaSqm ? `${pond.areaSqm.toLocaleString()} m²` : pond.dimensions;
      const perimLabel = pond.perimeterM ? `${pond.perimeterM.toLocaleString()} m` : '—';

      const popupHtml = `<div style="min-width:195px;font-size:12px;line-height:1.45;">
        <div style="font-weight:700;margin-bottom:2px;">${pond.code} · ${pond.name}</div>
        <div>${tr(language, 'Aina', 'Type')}: <strong>${tDomain(language, pond.unitType)}</strong></div>
        <div>${tr(language, 'Spishi', 'Species')}: <strong>${pond.species}</strong></div>
        <div>${tr(language, 'Idadi ya Samaki', 'Stocking')}: <strong>${pond.currentFish.toLocaleString()}</strong> / ${pond.maxCapacity.toLocaleString()}</div>
        <div>${tr(language, 'Eneo / Mzingo', 'Area / Perim')}: <strong>${areaLabel}</strong> · ${perimLabel}</div>
        ${wq ? `<div>${tr(language, 'Maji', 'Water')}: DO <strong>${wq.dissolvedOxygen} mg/L</strong> · pH ${wq.ph} · ${wq.temperature}°C</div>` : ''}
        <div>${tr(language, 'Hali', 'Status')}: <strong>${tDomain(language, pond.status)}</strong> ${pond.boundaryVerified ? `· ${tr(language, 'Mpaka Umethibitishwa', 'Boundary Verified')}` : ''}</div>
      </div>`;

      if (pond.polygon && pond.polygon.length >= 3) {
        const poly = L.polygon(pond.polygon, {
          color: strokeColor,
          weight: isFocused ? 4 : isInfraMode ? 2.5 : 2,
          dashArray: isFocused ? undefined : '5 4',
          fillColor,
          fillOpacity:
            mapMode === 'satellite' || mapMode === 'hybrid'
              ? isFocused
                ? 0.36
                : 0.2
              : isInfraMode
                ? 0.42
                : 0.34,
        }).addTo(pondGroup);

        if (!interactiveOverlay) {
          poly.bindPopup(popupHtml);
        }
        if (visibleLayers.labels) {
          poly.bindTooltip(`${pond.code}`, {
            permanent: true,
            direction: 'center',
            className: 'pond-code-label',
          });
        }
        poly.on('click', () => {
          onSelectPondRef.current?.(pond);
        });
      }

      const shortLabel = `P${idx + 1}`;
      const pinBg = isFocused
        ? '#2563eb'
        : isAttention
          ? '#ea580c'
          : isHarvestReady
            ? '#0284c7'
            : isPreparing
              ? '#475569'
              : '#16a34a';

      const icon = L.divIcon({
        className: 'custom-pond-pin',
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:24px;height:24px;border-radius:9999px;background:${pinBg};color:#fff;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);">${shortLabel}</div>
          <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${pinBg};margin-top:-1px;"></div>
        </div>`,
        iconSize: [24, 30],
        iconAnchor: [12, 30],
      });

      const marker = L.marker(pond.gps, { icon }).addTo(pondGroup);
      if (!interactiveOverlay) {
        marker.bindPopup(popupHtml);
      }
      marker.on('click', () => {
        onSelectPondRef.current?.(pond);
      });
    });
  }, [
    ponds,
    farms,
    selectedFarmId,
    mapMode,
    activeFarm,
    visibleLayers.ponds,
    visibleLayers.labels,
    focusedPondId,
    waterReadings,
    interactiveOverlay,
    language,
  ]);

  // Render water network, equipment, and sensor infrastructure markers
  useEffect(() => {
    const infraGroup = infraGroupRef.current;
    if (!infraGroup) return;

    infraGroup.clearLayers();

    const showInfra =
      visibleLayers.infrastructure || mapMode === 'infrastructure';
    const showSensors = visibleLayers.sensors || mapMode === 'infrastructure';

    const scopedMarkers =
      selectedFarmId === 'all'
        ? infrastructureMarkers
        : infrastructureMarkers.filter((m) => m.farmId === selectedFarmId);

    scopedMarkers.forEach((m) => {
      const isSensor = m.type === 'Water Sensor';
      if (isSensor && !showSensors) return;
      if (!isSensor && !showInfra) return;

      const meta = INFRASTRUCTURE_META[m.type];
      const icon = L.divIcon({
        className: 'custom-infra-pin',
        html: `<div style="background:${meta.color};color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:5px;border:1.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.38);white-space:nowrap;">${meta.shortCode}</div>`,
        iconSize: [30, 20],
        iconAnchor: [15, 10],
      });
      L.marker(m.gps, { icon })
        .bindPopup(
          `<div style="font-size:12px;line-height:1.4;min-width:170px;">
            <div style="font-weight:700;">${m.label}</div>
            <div>${tr(language, 'Aina', 'Type')}: <strong>${tDomain(language, m.type)}</strong>${m.pondCode ? ` · ${m.pondCode}` : ''}</div>
            <div>${tr(language, 'Hali', 'Status')}: <strong>${tDomain(language, m.status || 'Operational')}</strong></div>
            ${m.notes ? `<div style="color:#64748b;margin-top:2px;">${m.notes}</div>` : ''}
          </div>`
        )
        .addTo(infraGroup);
    });

    if (showInfra && selectedFarmId !== 'all') {
      const borehole = scopedMarkers.find((m) => m.type === 'Borehole');
      const pump = scopedMarkers.find((m) => m.type === 'Pump');
      const inlets = scopedMarkers.filter((m) => m.type === 'Water Inlet');
      const outlets = scopedMarkers.filter((m) => m.type === 'Water Outlet');
      const canal = scopedMarkers.find((m) => m.type === 'Drainage Channel');

      if (borehole && pump) {
        L.polyline([borehole.gps, pump.gps], {
          color: '#38bdf8',
          weight: 3,
          opacity: 0.85,
        }).addTo(infraGroup);
      }
      if (pump && inlets.length > 0) {
        inlets.forEach((inlet) => {
          L.polyline([pump.gps, inlet.gps], {
            color: '#0ea5e9',
            weight: 2.5,
            dashArray: '6 4',
            opacity: 0.85,
          }).addTo(infraGroup);
        });
      }
      if (canal && outlets.length > 0) {
        outlets.forEach((outlet) => {
          L.polyline([outlet.gps, canal.gps], {
            color: '#14b8a6',
            weight: 2.5,
            dashArray: '4 4',
            opacity: 0.85,
          }).addTo(infraGroup);
        });
      }
    }
  }, [
    infrastructureMarkers,
    selectedFarmId,
    mapMode,
    visibleLayers.infrastructure,
    visibleLayers.sensors,
    language,
  ]);

  // Render live "You are here" GPS pin & fly map when userLocation changes
  useEffect(() => {
    const map = mapRef.current;
    const userGroup = userGroupRef.current;
    if (!map || !userGroup) return;

    userGroup.clearLayers();
    if (!userLocation) return;

    if (userLocation.accuracyM && userLocation.accuracyM > 0) {
      L.circle(userLocation.gps, {
        radius: Math.min(userLocation.accuracyM, 250),
        color: userLocation.accuracyM > 20 ? '#f59e0b' : '#0284c7',
        weight: 1.5,
        fillOpacity: 0.14,
      }).addTo(userGroup);
    }

    const userPin = L.circleMarker(userLocation.gps, {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#0284c7',
      fillOpacity: 1,
    }).addTo(userGroup);

    userPin.bindPopup(
      `<div style="font-size:12px;line-height:1.45;">
        <div style="font-weight:700;color:#0284c7;">${tr(language, 'Eneo Lako la Sasa', 'Your Current Location')}</div>
        ${userLocation.placeName ? `<div>${userLocation.placeName}</div>` : ''}
        <div style="font-family:monospace;font-size:11px;">${userLocation.gps[0].toFixed(5)}, ${userLocation.gps[1].toFixed(5)}</div>
        ${userLocation.accuracyM !== undefined ? `<div>${tr(language, 'Usahihi wa GPS', 'GPS accuracy')}: ±${userLocation.accuracyM} m</div>` : ''}
      </div>`
    );

    map.flyTo(userLocation.gps, 17, { duration: 0.65 });
  }, [userLocation, language]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleZoomToFarm = () => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedFarmId === 'all') {
      if (farms.length > 1) {
        map.fitBounds(L.latLngBounds(farms.map((f) => f.gps)), { padding: [36, 36], maxZoom: 7 });
      }
      return;
    }
    if (activeFarm) {
      const farmPonds = ponds.filter((p) => p.farmId === activeFarm.id && p.polygon?.length >= 3);
      if (farmPonds.length > 0) {
        map.fitBounds(L.latLngBounds(farmPonds.flatMap((p) => p.polygon)), {
          padding: [38, 38],
          maxZoom: 18,
        });
      } else {
        map.flyTo(activeFarm.gps, 17, { duration: 0.65 });
      }
    }
  };

  const isLightTile = mapMode === 'map' || mapMode === 'street' || mapMode === 'terrain';

  const mapWrapperClass = isFullscreen
    ? 'fixed inset-3 z-[900] flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-900 shadow-2xl dark:border-slate-700'
    : `relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${heightClass}`;

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[890] bg-slate-950/70 backdrop-blur-[2px]"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      <div
        className={`${mapWrapperClass} ${isDark && isLightTile ? 'leaflet-dark-tiles' : ''} ${
          placingInfraType ? 'cursor-crosshair' : ''
        }`}
      >
        <div ref={containerRef} className="h-full w-full flex-1" />

        {/* Interactive Overlay Controls matching visual design */}
        {interactiveOverlay ? (
          <>
            {/* Top-Left: Zoom to Selected Farm */}
            <div className="pointer-events-auto absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleZoomToFarm}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-xs transition-colors hover:bg-white whitespace-nowrap dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
              >
                <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>
                  {tr(language, 'Kuza:', 'Zoom to')}{' '}
                  {selectedFarmId === 'all'
                    ? tr(language, 'Mashamba Yote', 'All Farms')
                    : activeFarm?.region || tr(language, 'Shamba', 'Farm')}
                </span>
              </button>
            </div>

            {/* Top-Right: Satellite | Street | Terrain Layer Switcher */}
            {onMapModeChange && (
              <div className="pointer-events-auto absolute top-3 right-3 z-[400] flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
                {(
                  [
                    { id: 'satellite', label: tr(language, 'Satelaiti', 'Satellite') },
                    { id: 'street', label: tr(language, 'Mtaa', 'Street') },
                    { id: 'terrain', label: tr(language, 'Mandhari', 'Terrain') },
                    { id: 'infrastructure', label: tr(language, 'Miundombinu', 'Assets') },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onMapModeChange(mode.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mapMode === mode.id
                        ? 'bg-[#1D72E8] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            {/* Left Vertical Floating Stack: + / - / GPS / Fullscreen */}
            <div className="pointer-events-auto absolute top-14 left-3 z-[400] flex flex-col gap-2">
              <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  aria-label={tr(language, 'Kuza ramani', 'Zoom in farm map')}
                  className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  aria-label={tr(language, 'Punguza ramani', 'Zoom out farm map')}
                  className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  −
                </button>
              </div>

              {onRequestGps && (
                <button
                  type="button"
                  onClick={onRequestGps}
                  disabled={locatingGps}
                  title={tr(language, 'Tumia eneo langu la sasa', 'Use my current location')}
                  aria-label={tr(language, 'Tumia eneo langu la sasa', 'Use my current location')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {locatingGps ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  ) : (
                    <Crosshair className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                title={
                  isFullscreen
                    ? tr(language, 'Toka kwenye skrini nzima', 'Exit full-screen map')
                    : tr(language, 'Panua ramani skrini nzima', 'Expand full-screen map')
                }
                aria-label={
                  isFullscreen
                    ? tr(language, 'Toka kwenye skrini nzima', 'Exit full-screen map')
                    : tr(language, 'Panua ramani skrini nzima', 'Expand full-screen map')
                }
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                )}
              </button>
            </div>

            {/* Selected Pond Floating Inspection Card */}
            {focusedPond && (
              <div className="pointer-events-auto absolute bottom-3 left-3 z-[400] max-w-sm rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {focusedPond.name} ({focusedPond.code}) {tr(language, 'imechaguliwa', 'selected')}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-300">
                        {tr(language, 'Eneo:', 'Area:')}{' '}
                        {focusedPond.areaSqm
                          ? `${(focusedPond.areaSqm / 10000).toFixed(2)} ha (${focusedPond.areaSqm.toLocaleString()} m²)`
                          : focusedPond.dimensions}{' '}
                        | {tr(language, 'Mzingo:', 'Perimeter:')}{' '}
                        {focusedPond.perimeterM ? `${focusedPond.perimeterM.toLocaleString()} m` : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        {tDomain(language, focusedPond.unitType)} · {focusedPond.species} ·{' '}
                        {focusedPond.currentFish.toLocaleString()} /{' '}
                        {focusedPond.maxCapacity.toLocaleString()} {tr(language, 'samaki', 'fish')}
                      </div>
                    </div>
                  </div>
                  {onClearFocusedPond && (
                    <button
                      type="button"
                      onClick={onClearFocusedPond}
                      aria-label={tr(language, 'Funga maelezo ya bwawa', 'Close pond details')}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {(onEditPondBoundary || onOpenPondProfile) && (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                    {onEditPondBoundary && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFullscreen(false);
                          onEditPondBoundary(focusedPond);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Edit3 className="h-3 w-3" /> {tr(language, 'Hariri Mpaka', 'Edit Boundary')}
                      </button>
                    )}
                    {onOpenPondProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenPondProfile(focusedPond)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#0284c7] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0369a1]"
                      >
                        <QrCode className="h-3 w-3" /> {tr(language, 'Fungua Profaili ya QR', 'Open QR Profile')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="pointer-events-auto absolute bottom-2.5 right-2.5 z-[400] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label={tr(language, 'Kuza ramani', 'Zoom in farm map')}
              className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label={tr(language, 'Punguza ramani', 'Zoom out farm map')}
              className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              −
            </button>
          </div>
        )}
      </div>
    </>
  );
};
