import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  Crosshair,
  MapPin,
  Maximize2,
  Minimize2,
  Search,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { Farm, FarmLocationSource } from '../../types/aquaculture';
import { Button, Card, FormError, INPUT_CLASS, useLanguage } from '../../ui';
import { tr } from '../../i18n/translations';
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
  const { language } = useLanguage();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Dar es Salaam');
  const [waterSource, setWaterSource] = useState('Kisima Kirefu + Maji Safi Yaliyochujwa');
  const [drainageSystem, setDrainageSystem] = useState('Mfereji wa Mvutano wa Kutolea Maji');
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
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street' | 'terrain'>('satellite');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

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
        <div style="background:#0284c7;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:9999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);white-space:nowrap;">${tr(language, 'Eneo la Shamba (Buruta)', 'Farm Site (Drag me)')}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #0284c7;margin-top:-1px;"></div>
      </div>`,
      iconSize: [148, 36],
      iconAnchor: [74, 36],
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

    const invalidate = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', invalidate);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      resizeObserver.observe(mapContainerRef.current);
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
      setGpsError(
        tr(
          language,
          'GPS haipatikani kwenye kivinjari hiki. Tafuta kijiji chako au gusa ramani.',
          'Location is unavailable on this browser. Search your village or tap the map instead.'
        )
      );
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
            ? tr(
                language,
                'Ruhusa ya eneo imezuiwa. Washa ruhusa ya eneo kwenye kivinjari au tafuta kijiji/kata hapo juu.',
                'Location permission denied. Enable location in browser settings or search your village/ward above.'
              )
            : tr(
                language,
                'Imeshindikana kupata mawimbi ya GPS sasa hivi. Jaribu kutafuta kijiji au gusa ramani.',
                'Could not get a GPS fix right now. Try searching your village/ward or tapping the map.'
              )
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
        setSearchError(
          tr(
            language,
            'Hakuna eneo lililopatikana Tanzania kwa jina hilo. Jaribu mji/kata ya karibu au buruta alama kwenye ramani.',
            'No matching place found in Tanzania. Try a nearby town/ward or drag the pin on the satellite map.'
          )
        );
      }
    } catch {
      setSearchError(
        tr(
          language,
          'Huduma ya kutafuta haipatikani. Gusa au buruta alama kwenye ramani ya satelaiti.',
          'Search service unreachable. Tap or drag the marker on the satellite map.'
        )
      );
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
      setName(
        language === 'sw'
          ? `Shamba la Samaki la ${item.title}`
          : `${item.title} Aquaculture Farm`
      );
    }
  };

  const handleSave = () => {
    setFormMsg('');
    if (!name.trim()) {
      setFormMsg(tr(language, 'Ingiza jina la shamba kabla ya kuhifadhi.', 'Enter a farm name before saving.'));
      setFormShake((n) => n + 1);
      return;
    }
    if (!locationConfirmed) {
      setFormMsg(
        tr(
          language,
          'Tafuta eneo, tumia GPS ya sasa, au gusa ramani kuweka alama ya shamba.',
          'Search for a location, use your current GPS, or tap the satellite map to set your farm pin.'
        )
      );
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
      setFormMsg(res.error || tr(language, 'Imeshindikana kusajili shamba.', 'Could not register farm.'));
      setFormShake((n) => n + 1);
    }
  };

  const accuracyStatus =
    locationAccuracyM === undefined
      ? null
      : locationAccuracyM <= 10
        ? { label: tr(language, 'Usahihi mzuri', 'Good accuracy'), cls: 'text-emerald-700 dark:text-emerald-400' }
        : locationAccuracyM <= 30
          ? {
              label: tr(language, 'Usahihi wa wastani — hakiki alama kwenye satelaiti', 'Moderate accuracy — verify pin on satellite'),
              cls: 'text-amber-700 dark:text-amber-400',
            }
          : {
              label: tr(language, 'Usahihi mdogo — buruta alama hadi geti la shamba', 'Low accuracy — drag pin to exact farm gate'),
              cls: 'text-rose-700 dark:text-rose-400',
            };

  return (
    <Card className="border-sky-200 dark:border-sky-800/70">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
            {tr(language, 'Msaidizi wa Haraka wa Eneo', 'Quick Location Assistant')}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {tr(language, 'Shamba lako liko wapi?', 'Where is your farm?')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tr(
              language,
              'Tafuta shamba lako moja kwa moja kwa GPS au andika kijiji/kata, kisha thibitisha alama kwenye satelaiti.',
              'Find your farm automatically with GPS or search your village/ward, then confirm the pin on the satellite map.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <X className="h-3.5 w-3.5" /> {tr(language, 'Ghairi', 'Cancel')}
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
                  placeholder={tr(language, 'Tafuta kijiji, kata, mji au shamba...', 'Search village, ward, landmark or farm...')}
                  className={`${INPUT_CLASS} pl-9`}
                />
                <Button type="submit" variant="secondary" size="md" loading={searching}>
                  {tr(language, 'Tafuta', 'Find')}
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
              {locatingGps
                ? tr(language, 'Inatafuta eneo lako la GPS...', 'Finding your GPS location...')
                : tr(language, 'Tumia eneo langu la sasa', 'Use my current location')}
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
              <span className="font-bold text-slate-900 dark:text-white">
                {tr(language, 'Eneo la shamba lililochaguliwa', 'Selected farm location')}
              </span>
              {locationConfirmed && (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {tr(language, 'Alama imewekwa', 'Pin placed')}
                </span>
              )}
            </div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-200">{placeName}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
              {selectedGps[0].toFixed(5)}, {selectedGps[1].toFixed(5)} ·{' '}
              {locationSource === 'GPS'
                ? tr(language, 'Imetambuliwa kwa GPS', 'Detected via GPS')
                : locationSource === 'SEARCH'
                  ? tr(language, 'Imechaguliwa kwa kutafuta', 'Selected from search')
                  : tr(language, 'Imerekebishwa kwenye satelaiti', 'Adjusted on satellite')}
            </div>
            {locationAccuracyM !== undefined && accuracyStatus && (
              <div className={`mt-1 text-[11px] font-semibold tabular-nums ${accuracyStatus.cls}`}>
                {tr(language, 'Usahihi wa GPS', 'GPS accuracy')}: ±{locationAccuracyM} m · {accuracyStatus.label}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {tr(
                language,
                'Haijakaa sawasawa? Gusa popote kwenye ramani au buruta alama ya bluu kurekebisha.',
                'Not quite on the gate? Tap anywhere on the satellite map or drag the blue pin to adjust.'
              )}
            </p>
          </div>

          {/* Basic Farm Details */}
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {tr(language, 'Jina la Shamba *', 'Farm Name *')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr(language, 'mfano: Shamba la Sato Bagamoyo', 'e.g. Bagamoyo Coastal Tilapia Farm')}
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Mkoa / Wilaya', 'Region / District')}
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
                  {tr(language, 'Na. ya Kibali cha FiRCIS', 'FiRCIS Permit No.')}
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
                  {tr(language, 'Chanzo cha Maji', 'Water Source')}
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
                  {tr(language, 'Mfumo wa Kutolea Maji', 'Drainage System')}
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
              {tr(language, 'Ghairi', 'Cancel')}
            </Button>
            <Button variant="success" size="md" onClick={handleSave}>
              <CheckCircle2 className="h-4 w-4" /> {tr(language, 'Thibitisha Eneo la Shamba', 'Confirm farm location')}
            </Button>
          </div>
        </div>

        {/* Right: Clean Interactive Satellite / Street / Terrain Map */}
        <div className="space-y-2 lg:col-span-7">
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
                : 'relative h-[450px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 dark:border-slate-700'
            }
          >
            <div ref={mapContainerRef} className="h-full w-full flex-1" />

            {/* Top-Left Hint Pill */}
            <div className="pointer-events-none absolute top-3 left-3 z-[400] rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100">
              {tr(language, 'Gusa ramani au buruta alama ya bluu kuweka eneo la shamba', 'Tap map or drag blue pin to set farm gate')}
            </div>

            {/* Top-Right: Satellite | Street | Terrain */}
            <div className="pointer-events-auto absolute top-3 right-3 z-[400] flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
              {(
                [
                  { id: 'satellite', label: tr(language, 'Satelaiti', 'Satellite') },
                  { id: 'street', label: tr(language, 'Mtaa', 'Street') },
                  { id: 'terrain', label: tr(language, 'Mandhari', 'Terrain') },
                ] as const
              ).map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setMapStyle(style.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    mapStyle === style.id
                      ? 'bg-[#1D72E8] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Left Vertical Stack: + / - / GPS / Fullscreen */}
            <div className="pointer-events-auto absolute top-14 left-3 z-[400] flex flex-col gap-2">
              <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomIn()}
                  aria-label={tr(language, 'Kuza ramani', 'Zoom in')}
                  className="flex h-8 w-8 items-center justify-center border-b border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomOut()}
                  aria-label={tr(language, 'Punguza ramani', 'Zoom out')}
                  className="flex h-8 w-8 items-center justify-center text-base font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200"
                >
                  −
                </button>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locatingGps}
                title={tr(language, 'Tumia eneo la GPS la sasa', 'Use current GPS location')}
                aria-label={tr(language, 'Tumia eneo la GPS la sasa', 'Use current GPS location')}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-sky-600 shadow-md backdrop-blur-xs hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/95 dark:text-sky-400"
              >
                {locatingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMapFullscreen((v) => !v)}
                title={
                  isMapFullscreen
                    ? tr(language, 'Toka kwenye skrini nzima', 'Exit full-screen map')
                    : tr(language, 'Panua ramani skrini nzima', 'Expand full-screen map')
                }
                aria-label={
                  isMapFullscreen
                    ? tr(language, 'Toka kwenye skrini nzima', 'Exit full-screen map')
                    : tr(language, 'Panua ramani skrini nzima', 'Expand full-screen map')
                }
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
              >
                {isMapFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
