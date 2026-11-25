import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Farm, Pond } from '../types/aquaculture';

interface LeafletFarmMapProps {
  ponds: Pond[];
  farms: Farm[];
  selectedFarmId: string;
  mapMode: 'map' | 'satellite';
  heightClass?: string;
  onSelectPond?: (pond: Pond) => void;
}

export const LeafletFarmMap: React.FC<LeafletFarmMapProps> = ({
  ponds,
  farms,
  selectedFarmId,
  mapMode,
  heightClass = 'h-[195px]',
  onSelectPond,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);

  const activeFarm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const center: [number, number] = activeFarm ? activeFarm.gps : [-6.8664, 39.3278];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayGroupRef.current = group;

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch between OpenStreetMap (Map) and Esri World Imagery (Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      mapMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const layer = L.tileLayer(tileUrl, {
      maxZoom: 19,
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [mapMode]);

  // Recenter when selected farm changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeFarm) return;
    map.setView(activeFarm.gps, selectedFarmId === 'all' ? 6 : 17, { animate: true });
  }, [selectedFarmId, activeFarm]);

  // Render pond polygons and green/amber pin markers (P1, P2, P3, P4, P5)
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const visiblePonds =
      selectedFarmId === 'all' ? ponds : ponds.filter((p) => p.farmId === selectedFarmId);

    // If selected farm has no individual pond polygons (e.g. Mwanza / Morogoro), show farm pin
    if (visiblePonds.length === 0 && activeFarm) {
      const markerIcon = L.divIcon({
        className: 'custom-pond-pin',
        html: `<div style="background:#16a34a;color:#fff;font-weight:700;font-size:11px;padding:4px 8px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;">${activeFarm.region}</div>`,
        iconSize: [72, 26],
        iconAnchor: [36, 13],
      });
      L.marker(activeFarm.gps, { icon: markerIcon })
        .bindPopup(
          `<div style="font-size:12px;line-height:1.4"><strong>${activeFarm.name}</strong><br/>Permit: ${activeFarm.fircisPermitNo}<br/>Source: ${activeFarm.waterSource}</div>`
        )
        .addTo(group);
      return;
    }

    visiblePonds.forEach((pond, idx) => {
      const isAttention = pond.status === 'Attention';
      const isPreparing = pond.status === 'Preparing';
      const strokeColor = isAttention ? '#f59e0b' : isPreparing ? '#64748b' : '#22c55e';
      const fillColor = isAttention ? '#fef3c7' : isPreparing ? '#cbd5e1' : '#10b981';

      if (pond.polygon && pond.polygon.length >= 3) {
        L.polygon(pond.polygon, {
          color: strokeColor,
          weight: 2,
          fillColor,
          fillOpacity: mapMode === 'satellite' ? 0.22 : 0.35,
        }).addTo(group);
      }

      const shortLabel = `P${idx + 1}`;
      const pinBg = isAttention ? '#ea580c' : isPreparing ? '#475569' : '#22a447';

      const icon = L.divIcon({
        className: 'custom-pond-pin',
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:28px;height:28px;border-radius:9999px;background:${pinBg};color:#fff;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);">${shortLabel}</div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${pinBg};margin-top:-1px;"></div>
        </div>`,
        iconSize: [28, 34],
        iconAnchor: [14, 34],
      });

      const marker = L.marker(pond.gps, { icon }).addTo(group);
      marker.bindPopup(
        `<div style="min-width:165px;font-size:12px;line-height:1.45;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:2px;">${pond.name} (${pond.code})</div>
          <div style="color:#475569;">Species: <strong>${pond.species}</strong></div>
          <div style="color:#475569;">Live Fish: <strong>${pond.currentFish.toLocaleString()}</strong> / ${pond.maxCapacity.toLocaleString()}</div>
          <div style="color:#475569;">Status: <strong>${pond.status}</strong> (${pond.readinessPct}%)</div>
        </div>`
      );
      if (onSelectPond) {
        marker.on('click', () => {
          onSelectPond(pond);
        });
      }
    });
  }, [ponds, selectedFarmId, mapMode, activeFarm, onSelectPond]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-auto absolute bottom-2.5 right-2.5 z-[400] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in farm map"
          className="flex h-7 w-7 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out farm map"
          className="flex h-7 w-7 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50"
        >
          −
        </button>
      </div>
    </div>
  );
};
