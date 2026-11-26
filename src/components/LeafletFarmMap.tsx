import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
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
}) => {
  const { isDark } = usePreferences();
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: selectedFarmId === 'all' ? 6 : 17,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: false,
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

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        map.fitBounds(L.latLngBounds(allPts), { padding: [35, 35], maxZoom: 18 });
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
      map.fitBounds(L.latLngBounds(target.polygon), { padding: [45, 45], maxZoom: 19 });
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

    // Always render farm pins when viewing all farms OR when selected farm has no ponds yet
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
            <div>Permit: <strong>${farm.fircisPermitNo}</strong></div>
            <div>Water Source: ${farm.waterSource}</div>
            <div style="margin-top:4px;color:#0284c7;font-weight:600;">${farmPondCount} mapped production units</div>
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
        ? '#38bdf8'
        : isAttention
          ? '#f59e0b'
          : isHarvestReady
            ? '#0284c7'
            : isPreparing
              ? '#94a3b8'
              : '#22c55e';
      const fillColor = isAttention
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
        <div>Type: <strong>${pond.unitType}</strong></div>
        <div>Species: <strong>${pond.species}</strong></div>
        <div>Stocking: <strong>${pond.currentFish.toLocaleString()}</strong> / ${pond.maxCapacity.toLocaleString()}</div>
        <div>Area / Perim: <strong>${areaLabel}</strong> · ${perimLabel}</div>
        ${wq ? `<div>Water: DO <strong>${wq.dissolvedOxygen} mg/L</strong> · pH ${wq.ph} · ${wq.temperature}°C</div>` : ''}
        <div>Status: <strong>${pond.status}</strong> ${pond.boundaryVerified ? '· Boundary Verified' : ''}</div>
      </div>`;

      if (pond.polygon && pond.polygon.length >= 3) {
        const poly = L.polygon(pond.polygon, {
          color: strokeColor,
          weight: isFocused ? 3.5 : isInfraMode ? 2.5 : 2,
          fillColor,
          fillOpacity:
            mapMode === 'satellite' || mapMode === 'hybrid'
              ? isFocused
                ? 0.34
                : 0.22
              : isInfraMode
                ? 0.42
                : 0.34,
        }).addTo(pondGroup);

        poly.bindPopup(popupHtml);
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
      const pinBg = isAttention
        ? '#ea580c'
        : isHarvestReady
          ? '#0284c7'
          : isPreparing
            ? '#475569'
            : '#16a34a';

      const icon = L.divIcon({
        className: 'custom-pond-pin',
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:26px;height:26px;border-radius:9999px;background:${pinBg};color:#fff;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);">${shortLabel}</div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${pinBg};margin-top:-1px;"></div>
        </div>`,
        iconSize: [26, 32],
        iconAnchor: [13, 32],
      });

      const marker = L.marker(pond.gps, { icon }).addTo(pondGroup);
      marker.bindPopup(popupHtml);
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
            <div>Type: <strong>${m.type}</strong>${m.pondCode ? ` · ${m.pondCode}` : ''}</div>
            <div>Status: <strong>${m.status || 'Operational'}</strong></div>
            ${m.notes ? `<div style="color:#64748b;margin-top:2px;">${m.notes}</div>` : ''}
          </div>`
        )
        .addTo(infraGroup);
    });

    // Draw schematic water supply & drainage network lines in Infrastructure mode
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
  ]);

  // Render live "You are here" GPS pin & fly map when user clicks Use my current location
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
        <div style="font-weight:700;color:#0284c7;">Your Current Location</div>
        ${userLocation.placeName ? `<div>${userLocation.placeName}</div>` : ''}
        <div style="font-family:monospace;font-size:11px;">${userLocation.gps[0].toFixed(5)}, ${userLocation.gps[1].toFixed(5)}</div>
        ${userLocation.accuracyM !== undefined ? `<div>GPS accuracy: ±${userLocation.accuracyM} m</div>` : ''}
      </div>`
    );

    map.flyTo(userLocation.gps, 17, { duration: 0.65 });
  }, [userLocation]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const isLightTile = mapMode === 'map' || mapMode === 'street' || mapMode === 'terrain';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${
        isDark && isLightTile ? 'leaflet-dark-tiles' : ''
      } ${placingInfraType ? 'cursor-crosshair' : ''} ${heightClass}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-auto absolute bottom-2.5 right-2.5 z-[400] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in farm map"
          className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out farm map"
          className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          −
        </button>
      </div>
    </div>
  );
};
