import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  Crosshair,
  MapPin,
  Search,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { Farm, FarmLocationSource } from '../../types/aquaculture';
import { Button, Card, FormError, INPUT_CLASS } from '../../ui';
import { getTileConfigForMode } from '../../utils/gis';

export interface SaveFarmLocationPayload {
  name: string;
  region: string;
  waterSource: string;
  drainageSystem: string;
  fircisPermitNo: string;
  gps: [number, number];
  locationAccuracyM?: number;
  locationSource: FarmLocationSource;
  placeName: string;
}

interface GeocodeSuggestion {
  id: string;
  title: string;
  placeName: string;
  lat: number;
  lng: number;
  source: string;
}

interface FarmLocationAssistantProps {
  existingFarms: Farm[];
  initialLocation?: {
    gps: [number, number];
    accuracyM?: number;
    placeName?: string;
    source?: FarmLocationSource;
  } | null;
  onCancel: () => void;
  onSaveFarm: (payload: SaveFarmLocationPayload) => { ok: boolean; error?: string };
}

export const FarmLocationAssistant: React.FC<FarmLocationAssistantProps> = ({
  existingFarms,
  initialLocation,
  onCancel,
  onSaveFarm,
}) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Dar es Salaam');
  const [waterSource, setWaterSource] = useState('Borehole + Filtered Freshwater');
  const [drainageSystem, setDrainageSystem] = useState('Gravity Sedimentation Canal');
  const [fircisPermitNo, setFircisPermitNo] = useState(
    `FiRCIS-TZ-${new Date().getFullYear()}-${String(100 + existingFarms.length * 37)}`
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searchError, setSearchError] = useState('');

  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [selectedGps, setSelectedGps] = useState<[number, number]>(
    initialLocation?.gps || existingFarms[0]?.gps || [-6.8664, 39.3278]
  );
  const [locationAccuracyM, setLocationAccuracyM] = useState<number | undefined>(
    initialLocation?.accuracyM
  );
  const [locationSource, setLocationSource] = useState<FarmLocationSource>(
    initialLocation?.source || 'MANUAL_ADJUSTMENT'
  );
  const [placeName, setPlaceName] = useState(
    initialLocation?.placeName || 'Kigamboni, Dar es Salaam'
  );
  const [locationConfirmed, setLocationConfirmed] = useState(Boolean(initialLocation?.gps));
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street'>('satellite');

  const [formMsg, setFormMsg] = useState('');
  const [formShake, setFormShake] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const runReverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `/api/gis/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { placeName?: string; shortName?: string };
        if (data.placeName) {
          setPlaceName(data.placeName);
        }
      }
    } catch {
      // Keep coordinates label if offline
    }
  };

  const moveMarkerTo = (
    lat: number,
    lng: number,
    opts?: { zoom?: number; accuracy?: number; source?: FarmLocationSource; skipReverse?: boolean }
  ) => {
    const coords: [number, number] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
    setSelectedGps(coords);
    setLocationConfirmed(true);
    if (opts?.source) setLocationSource(opts.source);
    if (opts?.accuracy !== undefined) setLocationAccuracyM(opts.accuracy);

    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setLatLng(coords);
      map.flyTo(coords, opts?.zoom ?? Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
    if (map) {
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      if (opts?.accuracy && opts.accuracy > 0) {
        accuracyCircleRef.current = L.circle(coords, {
          radius: Math.min(opts.accuracy, 200),
          color: opts.accuracy > 15 ? '#f59e0b' : '#10b981',
          weight: 1.5,
          fillOpacity: 0.14,
        }).addTo(map);
      }
    }
    if (!opts?.skipReverse) {
      runReverseGeocode(coords[0], coords[1]);
    }
  };

  // Initialize interactive satellite map immediately on entry
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: selectedGps,
      zoom: 16,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: true,
    });

    const pinIcon = L.divIcon({
      className: 'custom-pond-pin',
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:#0284c7;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:9999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);white-space:nowrap;">Farm Site (Drag me)</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #0284c7;margin-top:-1px;"></div>
      </div>`,
      iconSize: [140, 36],
      iconAnchor: [70, 36],
    });

    const marker = L.marker(selectedGps, { icon: pinIcon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      moveMarkerTo(ll.lat, ll.lng, {
        zoom: map.getZoom(),
        source: 'MANUAL_ADJUSTMENT',
      });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      moveMarkerTo(e.latlng.lat, e.latlng.lng, {
        zoom: map.getZoom(),
        source: 'MANUAL_ADJUSTMENT',
      });
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleUseMyLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Location is unavailable on this browser. Search your village or tap the map instead.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const acc = Math.round(pos.coords.accuracy);
        moveMarkerTo(pos.coords.latitude, pos.coords.longitude, {
          zoom: 18,
          accuracy: acc,
          source: 'GPS',
        });
      },
      (err) => {
        setLocatingGps(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable location in browser settings or search your village/ward above.'
            : 'Could not get a GPS fix right now. Try searching your village/ward or tapping the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSearchPlace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/gis/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: GeocodeSuggestion[]; error?: string };
      const list = data.results || [];
      setSuggestions(list);
      if (list.length === 0) {
        setSearchError('No matching place found in Tanzania. Try a nearby town/ward or drag the pin on the satellite map.');
      }
    } catch {
      setSearchError('Search service unreachable. Tap or drag the marker on the satellite map.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSuggestion = (item: GeocodeSuggestion) => {
    setSuggestions([]);
    setSearchQuery(item.title);
    setPlaceName(item.placeName);
    moveMarkerTo(item.lat, item.lng, {
      zoom: 16,
      accuracy: undefined,
      source: 'SEARCH',
      skipReverse: true,
    });
    if (!name.trim()) {
      setName(`${item.title} Aquaculture Farm`);
    }
  };

  const handleSave = () => {
    setFormMsg('');
    if (!name.trim()) {
      setFormMsg('Enter a farm name before saving.');
      setFormShake((n) => n + 1);
      return;
    }
    if (!locationConfirmed) {
      setFormMsg('Search for a location, use your current GPS, or tap the satellite map to set your farm pin.');
      setFormShake((n) => n + 1);
      return;
    }

    const res = onSaveFarm({
      name: name.trim(),
      region: region.trim() || 'Tanzania',
      waterSource: waterSource.trim(),
      drainageSystem: drainageSystem.trim(),
      fircisPermitNo: fircisPermitNo.trim(),
      gps: selectedGps,
      locationAccuracyM,
      locationSource,
      placeName,
    });
    if (!res.ok) {
      setFormMsg(res.error || 'Could not register farm.');
      setFormShake((n) => n + 1);
    }
  };

  const accuracyStatus =
    locationAccuracyM === undefined
      ? null
      : locationAccuracyM <= 10
        ? { label: 'Good accuracy', cls: 'text-emerald-700 dark:text-emerald-400' }
        : locationAccuracyM <= 30
          ? { label: 'Moderate accuracy — verify pin on satellite', cls: 'text-amber-700 dark:text-amber-400' }
          : { label: 'Low accuracy — drag pin to exact farm gate', cls: 'text-rose-700 dark:text-rose-400' };

  return (
    <Card className="border-sky-200 dark:border-sky-800/70">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
            Quick Location Assistant
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Where is your farm?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Find your farm automatically with GPS or search your village/ward, then confirm the pin on the satellite map.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>

      <FormError message={formMsg} shakeKey={formShake} className="mb-4" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Simple Search + GPS + Basic Details */}
        <div className="space-y-4 lg:col-span-5">
          {/* Search or Use My Current Location */}
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <form onSubmit={handleSearchPlace} className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search village, ward, landmark or farm..."
                  className={`${INPUT_CLASS} pl-9`}
                />
                <Button type="submit" variant="secondary" size="md" loading={searching}>
                  Find
                </Button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-sky-950/40"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                        <div className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {item.placeName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {searchError && (
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {searchError}
              </div>
            )}

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locatingGps}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0284c7] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0369a1] disabled:opacity-60"
            >
              {locatingGps ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
              {locatingGps ? 'Finding your GPS location...' : 'Use my current location'}
            </button>

            {gpsError && (
              <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}
          </div>

          {/* Selected Location Confirmation Box */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Selected farm location</span>
              {locationConfirmed && (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pin placed
                </span>
              )}
            </div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-200">{placeName}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
              {selectedGps[0].toFixed(5)}, {selectedGps[1].toFixed(5)} ·{' '}
              {locationSource === 'GPS'
                ? 'Detected via GPS'
                : locationSource === 'SEARCH'
                  ? 'Selected from search'
                  : 'Adjusted on satellite'}
            </div>
            {locationAccuracyM !== undefined && accuracyStatus && (
              <div className={`mt-1 text-[11px] font-semibold tabular-nums ${accuracyStatus.cls}`}>
                GPS accuracy: ±{locationAccuracyM} m · {accuracyStatus.label}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Not quite on the gate? Tap anywhere on the satellite map or drag the blue pin to adjust.
            </p>
          </div>

          {/* Basic Farm Details */}
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Farm Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bagamoyo Coastal Tilapia Farm"
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Region / District
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  FiRCIS Permit No.
                </label>
                <input
                  type="text"
                  value={fircisPermitNo}
                  onChange={(e) => setFircisPermitNo(e.target.value)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Water Source
                </label>
                <input
                  type="text"
                  value={waterSource}
                  onChange={(e) => setWaterSource(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Drainage System
                </label>
                <input
                  type="text"
                  value={drainageSystem}
                  onChange={(e) => setDrainageSystem(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="success" size="md" onClick={handleSave}>
              <CheckCircle2 className="h-4 w-4" /> Confirm farm location
            </Button>
          </div>
        </div>

        {/* Right: Clean Interactive Satellite Map */}
        <div className="space-y-2 lg:col-span-7">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Visual confirmation on satellite imagery (drag pin or tap exact site)
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  mapStyle === 'satellite' ? 'bg-[#0284c7] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('street')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  mapStyle === 'street' ? 'bg-[#0284c7] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Street
              </button>
            </div>
          </div>
          <div className="relative h-[430px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 dark:border-slate-700">
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
        </div>
      </div>
    </Card>
  );
};
