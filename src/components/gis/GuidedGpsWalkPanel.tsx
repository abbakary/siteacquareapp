import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Footprints,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react';
import { GpsTrackPoint, Pond } from '../../types/aquaculture';
import { measureAndValidatePolygon } from '../../utils/gisGeometry';

const GPS_WALK_DRAFT_KEY = 'dukaaqusmart_gps_walk_draft_v1';

interface GuidedGpsWalkPanelProps {
  unitType: Pond['unitType'];
  farmGps?: [number, number];
  onLiveTrackChange: (track: GpsTrackPoint[], currentPos: [number, number] | null, accuracyM?: number) => void;
  onFinishPolygon: (payload: {
    polygonLatLng: [number, number][];
    rawTrack: GpsTrackPoint[];
    avgAccuracyM?: number;
  }) => void;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(sin1 * sin1 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sin2 * sin2)
    );
  return R * c;
}

export const GuidedGpsWalkPanel: React.FC<GuidedGpsWalkPanelProps> = ({
  unitType,
  farmGps,
  onLiveTrackChange,
  onFinishPolygon,
}) => {
  const [targetAccuracyM, setTargetAccuracyM] = useState<number>(10);
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [track, setTrack] = useState<GpsTrackPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [liveAccuracyM, setLiveAccuracyM] = useState<number | undefined>(undefined);
  const [warningMsg, setWarningMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [recoverableDraft, setRecoverableDraft] = useState<GpsTrackPoint[] | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const signalWatchdogRef = useRef<number | null>(null);
  const trackRef = useRef<GpsTrackPoint[]>([]);
  trackRef.current = track;
  const statusRef = useRef(status);
  statusRef.current = status;
  const targetAccRef = useRef(targetAccuracyM);
  targetAccRef.current = targetAccuracyM;

  // Check for recoverable GPS walk draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GPS_WALK_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GpsTrackPoint[];
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setRecoverableDraft(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (signalWatchdogRef.current !== null) {
        window.clearTimeout(signalWatchdogRef.current);
      }
    };
  }, []);

  // Sync live track to map & auto-save draft
  useEffect(() => {
    onLiveTrackChange(track, currentPos, liveAccuracyM);
    if (track.length >= 2) {
      try {
        localStorage.setItem(GPS_WALK_DRAFT_KEY, JSON.stringify(track));
      } catch {
        // ignore quota errors
      }
    }
  }, [track, currentPos, liveAccuracyM, onLiveTrackChange]);

  const stopWatch = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (signalWatchdogRef.current !== null) {
      window.clearTimeout(signalWatchdogRef.current);
      signalWatchdogRef.current = null;
    }
  };

  const resetSignalWatchdog = () => {
    if (signalWatchdogRef.current !== null) window.clearTimeout(signalWatchdogRef.current);
    signalWatchdogRef.current = window.setTimeout(() => {
      if (statusRef.current === 'recording') {
        stopWatch();
        setStatus('paused');
        setWarningMsg('GPS signal paused (no update for 15s). Move to open sky and tap Resume.');
      }
    }, 15000);
  };

  const startOrResumeWatch = () => {
    setErrorMsg('');
    setWarningMsg('');
    if (!navigator.geolocation) {
      setErrorMsg('GPS is not supported on this device/browser. Use "Adjust on map" instead.');
      return;
    }
    setStatus('recording');
    statusRef.current = 'recording';
    resetSignalWatchdog();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        resetSignalWatchdog();
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const acc = Math.round(pos.coords.accuracy);
        const nowIso = new Date().toISOString();

        setCurrentPos([lat, lng]);
        setLiveAccuracyM(acc);

        if (statusRef.current !== 'recording') return;

        // Safeguard 1: Poor GPS accuracy -> ask user to wait instead of adding noisy points
        if (acc > targetAccRef.current) {
          setWarningMsg(
            `GPS accuracy is ±${acc} m (target ≤ ${targetAccRef.current} m). Stand still for a moment until signal improves, or tap "Capture point".`
          );
          return;
        }

        const prevTrack = trackRef.current;
        if (prevTrack.length === 0) {
          setWarningMsg('');
          setTrack([{ lat, lng, accuracyM: acc, timestamp: nowIso }]);
          return;
        }

        const last = prevTrack[prevTrack.length - 1];
        const distM = haversineMeters([last.lat, last.lng], [lat, lng]);
        const elapsedSec = Math.max(
          0.5,
          (new Date(nowIso).getTime() - new Date(last.timestamp).getTime()) / 1000
        );
        const speedMs = distM / elapsedSec;

        // Safeguard 2: Standing still -> avoid duplicate points (< 2.0m)
        if (distM < 2.0) {
          return;
        }

        // Safeguard 3: Reject sudden unrealistic GPS jumps (> 35m in < 2s or > 12 m/s)
        if ((distM > 35 && elapsedSec < 2.5) || speedMs > 12) {
          setWarningMsg(`Ignored sudden GPS jump (${Math.round(distM)} m). Keep walking along the edge.`);
          return;
        }

        // Safeguard 4: Warn if user walks too quickly (> 2.5 m/s)
        if (speedMs > 2.5) {
          setWarningMsg('Walking a bit fast — walk slowly along the pond bank for an accurate shape.');
        } else {
          setWarningMsg('');
        }

        setTrack((prev) => [...prev, { lat, lng, accuracyM: acc, timestamp: nowIso }]);
      },
      (err) => {
        stopWatch();
        setStatus('paused');
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Allow location access in your browser/phone settings to walk the pond.'
            : 'GPS signal interrupted. Recording paused safely — your recorded points are preserved.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handlePause = () => {
    stopWatch();
    setStatus('paused');
  };

  const handleUndo = () => {
    setTrack((prev) => prev.slice(0, -1));
  };

  const handleCaptureNow = () => {
    if (!currentPos) {
      setWarningMsg('Waiting for first GPS fix...');
      return;
    }
    setTrack((prev) => [
      ...prev,
      {
        lat: currentPos[0],
        lng: currentPos[1],
        accuracyM: liveAccuracyM,
        timestamp: new Date().toISOString(),
      },
    ]);
    setWarningMsg('');
  };

  const handleRestart = () => {
    stopWatch();
    setStatus('idle');
    setTrack([]);
    setWarningMsg('');
    setErrorMsg('');
    try {
      localStorage.removeItem(GPS_WALK_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const handleSaveDraft = () => {
    if (track.length === 0) return;
    try {
      localStorage.setItem(GPS_WALK_DRAFT_KEY, JSON.stringify(track));
      setWarningMsg('Draft saved on this device. You can resume or finish anytime.');
    } catch {
      // ignore
    }
  };

  const handleFinish = () => {
    stopWatch();
    setStatus('idle');
    if (track.length < 3) {
      setErrorMsg(
        `Only ${track.length} point(s) recorded. Walk at least 3 corners around the pond before finishing.`
      );
      return;
    }
    const pts: [number, number][] = track.map((t) => [t.lat, t.lng]);
    const validAccs = track.map((t) => t.accuracyM).filter((a): a is number => typeof a === 'number');
    const avgAcc =
      validAccs.length > 0
        ? Math.round(validAccs.reduce((s, v) => s + v, 0) / validAccs.length)
        : liveAccuracyM;

    if (avgAcc && avgAcc > targetAccuracyM * 1.5) {
      setWarningMsg(
        `Average GPS accuracy was ±${avgAcc} m. Previewing on satellite so you can adjust corners if needed.`
      );
    }

    try {
      localStorage.removeItem(GPS_WALK_DRAFT_KEY);
    } catch {
      // ignore
    }
    onFinishPolygon({ polygonLatLng: pts, rawTrack: track, avgAccuracyM: avgAcc });
  };

  // Live distance walked & estimated area preview
  let distanceWalkedM = 0;
  for (let i = 1; i < track.length; i++) {
    distanceWalkedM += haversineMeters(
      [track[i - 1].lat, track[i - 1].lng],
      [track[i].lat, track[i].lng]
    );
  }
  const livePreview =
    track.length >= 3
      ? measureAndValidatePolygon({
          polygonLatLng: track.map((t) => [t.lat, t.lng]),
          unitType,
          farmGps,
        })
      : null;

  return (
    <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3.5 text-xs dark:border-orange-900/60 dark:bg-orange-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-orange-600" />
          <div>
            <div className="font-bold text-slate-900 dark:text-white">
              Walk around the pond
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              Stand at a pond corner, press Start recording, walk slowly around the outer edge, and press Finish.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">Target accuracy:</span>
          <select
            value={targetAccuracyM}
            onChange={(e) => setTargetAccuracyM(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value={5}>≤ 5 m (Strict)</option>
            <option value={10}>≤ 10 m (Standard)</option>
            <option value={20}>≤ 20 m (Shaded/Rural)</option>
          </select>
        </div>
      </div>

      {/* Recoverable draft notice */}
      {recoverableDraft && track.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] dark:border-sky-800 dark:bg-sky-950/50">
          <span className="font-medium text-sky-900 dark:text-sky-200">
            Unfinished GPS walk found ({recoverableDraft.length} points saved).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTrack(recoverableDraft);
                setRecoverableDraft(null);
                setStatus('paused');
              }}
              className="rounded-md bg-sky-600 px-2.5 py-1 font-semibold text-white hover:bg-sky-700"
            >
              Resume walk
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoverableDraft(null);
                localStorage.removeItem(GPS_WALK_DRAFT_KEY);
              }}
              className="text-slate-600 hover:underline dark:text-slate-400"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">GPS status</div>
          <div className="mt-0.5 font-semibold text-slate-900 tabular-nums dark:text-white">
            {liveAccuracyM !== undefined
              ? `±${liveAccuracyM} m ${liveAccuracyM <= targetAccuracyM ? '(Good)' : '(Wait)'}`
              : status === 'recording'
                ? 'Searching...'
                : 'Ready to start'}
          </div>
        </div>
        <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Recorded points</div>
          <div className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums dark:text-white">
            {track.length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Distance walked</div>
          <div className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums dark:text-white">
            {Math.round(distanceWalkedM)} m
          </div>
        </div>
        <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Estimated area</div>
          <div className="mt-0.5 font-mono font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
            {livePreview?.valid ? `${livePreview.areaSqm.toLocaleString()} m²` : '—'}
          </div>
        </div>
      </div>

      {warningMsg && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {status === 'idle' && track.length === 0 && (
          <button
            type="button"
            onClick={startOrResumeWatch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700"
          >
            <Navigation className="h-3.5 w-3.5" /> Start recording
          </button>
        )}

        {status === 'recording' && (
          <>
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
            <button
              type="button"
              onClick={handleCaptureNow}
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            >
              + Capture point
            </button>
          </>
        )}

        {status === 'paused' && (
          <button
            type="button"
            onClick={startOrResumeWatch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-700"
          >
            <Play className="h-3.5 w-3.5" /> Resume recording
          </button>
        )}

        {track.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Save className="h-3.5 w-3.5" /> Save draft
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </button>
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Finish & preview on satellite
            </button>
          </>
        )}
      </div>
    </div>
  );
};
