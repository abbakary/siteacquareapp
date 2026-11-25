import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Utensils,
  Droplets,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Bluetooth,
  Smartphone,
  Upload,
  Sparkles,
  Lock,
  Loader2,
} from 'lucide-react';
import { AquacultureState, Language } from '../../types/aquaculture';
import { getPermissions } from '../../utils/rbac';
import { formatNumber } from '../../utils/formatters';
import { QuickActionType } from '../QuickActionModals';
import {
  Badge,
  Button,
  Card,
  CardListSkeleton,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  getStaggerDelay,
  INPUT_CLASS,
} from '../../ui';

interface FeedingModuleProps {
  state: AquacultureState;
  onQuickAction: (action: QuickActionType) => void;
  onResolveFeedVariance: (feedId: string, note: string) => void;
}

export const FeedingModule: React.FC<FeedingModuleProps> = ({
  state,
  onQuickAction,
  onResolveFeedVariance,
}) => {
  const [selectedPondCode, setSelectedPondCode] = useState('POND-001');
  const [feedingRatePct, setFeedingRatePct] = useState(3.0);

  const batch = state.batches.find((b) => b.pondCode === selectedPondCode) || state.batches[0];
  const liveFish = batch ? batch.currentEstimatedFish : 4500;
  const avgWeightKg = batch ? batch.currentAvgWeightG / 1000 : 0.1;
  const biomassKg = liveFish * avgWeightKg;
  const recommendedDailyFeedKg = biomassKg * (feedingRatePct / 100);
  const biomassGainKg = batch
    ? Math.max(1, ((batch.currentAvgWeightG - batch.avgInitialWeightG) / 1000) * liveFish)
    : 1000;
  const fcrValue = batch ? Number((batch.feedConsumedKg / biomassGainKg).toFixed(2)) : 1.42;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Module C: Feeding Requirements, Store Issuance & Variance Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Biomass-driven ration planning with 6-step accountability: Manager Approves → Storekeeper Issues → Keeper Signs Receipt → Variance Flagging.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => onQuickAction('feeding')}>
          <Utensils className="h-4 w-4" /> Record Feeding / Swahili Voice
        </Button>
      </Card>

      {/* Biomass & Ration Calculator */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            Biomass & Daily Ration Calculator
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Select Pond / Batch
              </label>
              <select
                value={selectedPondCode}
                onChange={(e) => setSelectedPondCode(e.target.value)}
                className={INPUT_CLASS}
              >
                {state.ponds
                  .filter((p) => p.currentFish > 0)
                  .map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.species}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Technician Rate (%)
              </label>
              <input
                type="number"
                step="0.2"
                value={feedingRatePct}
                onChange={(e) => setFeedingRatePct(Number(e.target.value))}
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Live Fish × Avg Wt</div>
              <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={liveFish} formatter={(v) => formatNumber(v)} /> ×{' '}
                {(avgWeightKg * 1000).toFixed(0)}g
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Estimated Biomass</div>
              <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={biomassKg} decimals={0} formatter={(v) => formatNumber(v)} suffix=" kg" />
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Daily Feed Target</div>
              <div className="text-sm font-extrabold text-blue-700 tabular-nums dark:text-sky-400">
                <CountUpNumber value={recommendedDailyFeedKg} decimals={1} suffix=" kg/day" />
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Batch FCR</div>
              <div className="text-sm font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                <CountUpNumber value={fcrValue} decimals={2} />
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Note: Illustrative formula; adjust rate based on species, water temperature, fish behavior, and technician review.
          </p>
        </Card>

        {/* Feed Reconciliation Ledger */}
        <Card className="lg:col-span-7">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            Feed Issuance vs Actual Consumption Reconciliation
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">Date / Pond</th>
                  <th className="py-2">Feed Type</th>
                  <th className="py-2 text-right">Approved</th>
                  <th className="py-2 text-right">Issued</th>
                  <th className="py-2 text-right">Actual Fed</th>
                  <th className="py-2 text-right">Variance</th>
                  <th className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.feedIssuances.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5">
                      <div className="font-bold text-slate-900 dark:text-white">{f.pondCode}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {f.date} {f.time} · {f.keeper}
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300">{f.feedType}</td>
                    <td className="py-2.5 text-right tabular-nums dark:text-slate-300">{f.approvedKg} kg</td>
                    <td className="py-2.5 text-right tabular-nums dark:text-slate-300">
                      {f.issuedByStorekeeperKg} kg
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums dark:text-white">
                      {f.actualFedKg !== null ? `${f.actualFedKg} kg` : 'Pending'}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold tabular-nums ${
                        f.varianceFlagged
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {f.varianceKg.toFixed(1)} kg
                    </td>
                    <td className="py-2.5 pl-3">
                      {f.varianceFlagged ? (
                        <button
                          type="button"
                          onClick={() =>
                            onResolveFeedVariance(f.id, 'Investigated & returned leftover feed to store')
                          }
                          className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
                        >
                          Flagged (Resolve)
                        </button>
                      ) : (
                        <Badge variant="success">{f.status}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

interface WaterQualityModuleProps {
  state: AquacultureState;
  onQuickAction: (action: QuickActionType) => void;
  onSimulateEsp32Drop: () => void;
  onToggleAerator: (pondId: string) => void;
}

export const WaterQualityModule: React.FC<WaterQualityModuleProps> = ({
  state,
  onQuickAction,
  onSimulateEsp32Drop,
  onToggleAerator,
}) => {
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Module D: Water Quality & 3-Level Smart Monitoring (Manual · Bluetooth · ESP32 IoT)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitors Dissolved Oxygen, Temperature, pH, Ammonia, Nitrite, Transparency & Water Level with local aerator relay failsafes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="warning" size="sm" onClick={onSimulateEsp32Drop}>
            <Cpu className="h-4 w-4" /> Test ESP32 Low-DO Alarm
          </Button>
          <Button variant="primary" size="sm" onClick={() => onQuickAction('water')}>
            <Droplets className="h-4 w-4" /> Record Water Reading
          </Button>
        </div>
      </Card>

      {/* 3 Monitoring Tiers */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="text-xs">
          <div className="mb-1.5 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-sky-400" /> Level 1: Manual Mobile Entry
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Technicians and assigned keepers enter test-kit values offline or online with instrument ID & timestamp.
          </p>
        </Card>
        <Card className="text-xs">
          <div className="mb-1.5 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Bluetooth className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Level 2: Bluetooth Multiparameter
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Direct instrument sync (e.g. Hanna HI98194 BT) prevents transcription mistakes in pond-side checks.
          </p>
        </Card>
        <Card className="text-xs">
          <div className="mb-1.5 flex items-center justify-between gap-2 font-bold text-slate-900 dark:text-white">
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Level 3: ESP32 IoT + Local Relay
            </span>
            <Badge variant="auto">Auto</Badge>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Local gateway triggers aerator relays & local siren alarms even if farm internet connectivity drops.
          </p>
        </Card>
      </div>

      {/* Readings Table */}
      <Card>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          Recent Pond Water Telemetry & Manual Logs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2">Pond</th>
                <th className="py-2">Timestamp</th>
                <th className="py-2">Source Level</th>
                <th className="py-2 text-right">pH</th>
                <th className="py-2 text-right">DO (mg/L)</th>
                <th className="py-2 text-right">Temp (°C)</th>
                <th className="py-2 text-right">NH3</th>
                <th className="py-2 text-right">NO2</th>
                <th className="py-2 pl-3">Status</th>
                <th className="py-2 text-right">Aerator Relay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.waterReadings.map((r) => {
                const pond = state.ponds.find((p) => p.code === r.pondCode);
                const isIot = r.sourceLevel.includes('ESP32');
                return (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">{r.pondCode}</td>
                    <td className="py-2.5 text-slate-500 tabular-nums dark:text-slate-400">{r.timestamp}</td>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        {r.sourceLevel}
                        {isIot && <Badge variant="auto">Auto</Badge>}
                      </span>{' '}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        ({r.instrument})
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums dark:text-slate-200">
                      {r.ph}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold tabular-nums ${
                        r.dissolvedOxygen < 4.5
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {r.dissolvedOxygen}
                    </td>
                    <td className="py-2.5 text-right tabular-nums dark:text-slate-300">
                      {r.temperature}°C
                    </td>
                    <td className="py-2.5 text-right tabular-nums dark:text-slate-300">{r.ammonia}</td>
                    <td className="py-2.5 text-right tabular-nums dark:text-slate-300">{r.nitrite}</td>
                    <td className="py-2.5 pl-3">
                      <Badge variant={r.status === 'Safe' ? 'success' : 'warning'}>{r.status}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      {pond && (
                        <button
                          type="button"
                          onClick={() => onToggleAerator(pond.id)}
                          className={`rounded px-2.5 py-1 text-[10px] font-bold transition-colors ${
                            pond.aeratorRelayOn
                              ? 'bg-sky-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {pond.aeratorRelayOn ? 'ON (Active)' : 'OFF'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

interface FishHealthModuleProps {
  state: AquacultureState;
  language: Language;
  onQuickAction: (action: QuickActionType) => void;
  onVerifyIncident: (
    id: string,
    obs: string,
    diag: string,
    treatment: string,
    withdrawalDays: number
  ) => void;
  onApproveTreatment: (id: string) => void;
}

export const FishHealthModule: React.FC<FishHealthModuleProps> = ({
  state,
  language,
  onQuickAction,
  onVerifyIncident,
  onApproveTreatment,
}) => {
  const perms = getPermissions(state.activeUser.role);
  const [aiPond, setAiPond] = useState('POND-003');
  const [aiSymptoms, setAiSymptoms] = useState(
    'Fish crowding near water inlet at 6am, mild fin fraying'
  );
  const [aiImage, setAiImage] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAiImage({ dataUrl: String(reader.result), mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  };

  const runHealthAdvisory = async () => {
    setAiLoading(true);
    setAiResult('');
    try {
      const wq = state.waterReadings.find((w) => w.pondCode === aiPond);
      const pond = state.ponds.find((p) => p.code === aiPond);
      const res = await fetch('/api/ai/health-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: aiSymptoms,
          species: pond?.species || 'Nile Tilapia',
          pondCode: aiPond,
          waterQuality: wq,
          imageBase64: aiImage?.dataUrl,
          mimeType: aiImage?.mimeType,
          language,
        }),
      });
      const data = await res.json();
      setAiResult(res.ok ? `${data.advisory}\n\n— ${data.disclaimer}` : `Error: ${data.error}`);
    } catch {
      setAiResult('Network error calling AI health inspection advisor.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Module E: Fish Health, Mortality Accountability & Biosecurity
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mortality records cannot be deleted by keepers. Treatments require Technician recommendation + Manager approval.
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => onQuickAction('mortality')}>
          <AlertTriangle className="h-4 w-4" /> Report Mortality Incident
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Mortality & Treatment Ledger */}
        <div className="space-y-3 lg:col-span-7">
          {state.healthIncidents.map((inc, idx) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
            >
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {inc.pondCode} ({inc.batchCode}) — {inc.deadCount} dead / {inc.affectedCount} affected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">
                      <Lock className="h-3 w-3" /> Deletion Locked
                    </Badge>
                    <Badge
                      variant={
                        inc.status === 'Treatment Approved'
                          ? 'success'
                          : inc.status === 'Technician Verified'
                            ? 'info'
                            : 'warning'
                      }
                    >
                      {inc.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  <div>
                    <strong>Reported:</strong> {inc.dateTime} by {inc.reportedBy}
                  </div>
                  <div>
                    <strong>Symptoms:</strong> {inc.symptoms}
                  </div>
                  <div>
                    <strong>Water Snapshot:</strong> {inc.waterSnapshot}
                  </div>
                  {inc.technicianObservation && (
                    <div className="mt-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70">
                      <strong>Technician Verification:</strong> {inc.technicianObservation} ·{' '}
                      <em>Suspected: {inc.suspectedDiagnosis}</em>
                    </div>
                  )}
                  {inc.prescribedTreatment && (
                    <div className="mt-1 rounded-lg bg-emerald-50 p-2 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                      <strong>Prescribed Treatment:</strong> {inc.prescribedTreatment} (Withdrawal:{' '}
                      {inc.withdrawalDays ?? 0} days)
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {inc.status === 'Reported' && perms.canVerifyMortality && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        onVerifyIncident(
                          inc.id,
                          'Verified gill condition & DO recovery on-site.',
                          'Environmental stress / low DO',
                          'Increase aeration + Vitamin C feed supplement 3 days',
                          0
                        )
                      }
                    >
                      Technician Verify & Recommend Treatment
                    </Button>
                  )}
                  {inc.status === 'Technician Verified' && perms.canApproveTreatment && (
                    <Button variant="success" size="sm" onClick={() => onApproveTreatment(inc.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Manager Approve Treatment
                    </Button>
                  )}
                  {!perms.canApproveTreatment && inc.status !== 'Treatment Approved' && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      Role control: {state.activeUser.roleLabel} cannot self-approve treatments.
                    </span>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* AI Fish Health Photo & Symptom Advisor */}
        <Card className="lg:col-span-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              AI Fish Health Inspection Assistant
            </h3>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Upload a fish photo or describe symptoms to flag possible conditions for professional veterinary review.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Pond
              </label>
              <select
                value={aiPond}
                onChange={(e) => setAiPond(e.target.value)}
                className={INPUT_CLASS}
              >
                {state.ponds.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} ({p.species})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Symptoms & Behavior
              </label>
              <textarea
                rows={3}
                value={aiSymptoms}
                onChange={(e) => setAiSymptoms(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Optional Fish Photo
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800">
                <Upload className="h-4 w-4" />
                {aiImage ? 'Photo Attached (Click to change)' : 'Attach Fish Photo (PNG/JPG)'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            <Button
              variant="primary"
              fullWidth
              loading={aiLoading}
              onClick={runHealthAdvisory}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run Preliminary Inspection Advisory
            </Button>

            {aiLoading && <CardListSkeleton rows={2} />}

            {aiResult && !aiLoading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
              >
                {aiResult}
              </motion.div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
