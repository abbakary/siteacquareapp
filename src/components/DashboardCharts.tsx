import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DURATIONS, EASE_OUT, usePreferences } from '../ui';
import { tr } from '../i18n/translations';
import { Language } from '../types/aquaculture';

interface FarmOverviewChartProps {
  range: '7d' | '30d' | '90d';
}

// Uniform 7-point series across all ranges enables seamless SVG path morphing on range switch
function getChartSeries(language: Language): Record<
  '7d' | '30d' | '90d',
  { labels: string[]; production: number[]; feed: number[] }
> {
  return {
    '30d': {
      labels:
        language === 'sw'
          ? ['Mei 1', 'Mei 5', 'Mei 10', 'Mei 14', 'Mei 19', 'Mei 23', 'Mei 27']
          : ['May 1', 'May 5', 'May 10', 'May 14', 'May 19', 'May 23', 'May 27'],
      production: [1520, 1890, 2260, 2680, 2910, 3290, 3800],
      feed: [1100, 1420, 1780, 2080, 2360, 2740, 3150],
    },
    '7d': {
      labels:
        language === 'sw'
          ? ['Siku 1', 'Siku 2', 'Siku 3', 'Siku 4', 'Siku 5', 'Siku 6', 'Leo']
          : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
      production: [3150, 3240, 3360, 3420, 3550, 3680, 3800],
      feed: [2620, 2700, 2790, 2860, 2940, 3050, 3150],
    },
    '90d': {
      labels:
        language === 'sw'
          ? ['Sep 1', 'Sep 15', 'Okt 1', 'Okt 15', 'Nov 1', 'Nov 10', 'Nov 19']
          : ['Sep 1', 'Sep 15', 'Oct 1', 'Oct 15', 'Nov 1', 'Nov 10', 'Nov 19'],
      production: [920, 1340, 1850, 2410, 2890, 3380, 3800],
      feed: [710, 1020, 1410, 1860, 2310, 2780, 3150],
    },
  };
}

export const FarmOverviewChart: React.FC<FarmOverviewChartProps> = ({ range }) => {
  const { effectiveReducedMotion, language } = usePreferences();
  const data = getChartSeries(language)[range];
  const [hoverIdx, setHoverIdx] = useState<number>(data.labels.length - 1);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    hasAnimatedRef.current = true;
  }, []);

  const width = 460;
  const height = 165;
  const padLeft = 32;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 24;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const maxVal = 4000;

  const getX = (i: number) => padLeft + (i / (data.labels.length - 1)) * innerW;
  const getY = (val: number) => padTop + innerH - (val / maxVal) * innerH;

  const prodPathD = `M ${data.production.map((v, i) => `${getX(i)},${getY(v)}`).join(' L ')}`;
  const feedPathD = `M ${data.feed.map((v, i) => `${getX(i)},${getY(v)}`).join(' L ')}`;

  const prodArea = `M ${getX(0)},${padTop + innerH} L ${data.production
    .map((v, i) => `${getX(i)},${getY(v)}`)
    .join(' L ')} L ${getX(data.production.length - 1)},${padTop + innerH} Z`;

  const feedArea = `M ${getX(0)},${padTop + innerH} L ${data.feed
    .map((v, i) => `${getX(i)},${getY(v)}`)
    .join(' L ')} L ${getX(data.feed.length - 1)},${padTop + innerH} Z`;

  const activeIdx = Math.min(hoverIdx, data.labels.length - 1);
  const activeProd = data.production[activeIdx];
  const activeFeed = data.feed[activeIdx];
  const tooltipX = Math.min(Math.max(getX(activeIdx) - 48, padLeft), width - 108);
  const tooltipY = Math.max(getY(activeProd) - 40, 2);

  const shouldDraw = !effectiveReducedMotion && !hasAnimatedRef.current;
  const morphTransition = effectiveReducedMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: EASE_OUT };

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[175px] w-full overflow-visible">
        <defs>
          <linearGradient id="prodAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="feedAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 1000, 2000, 3000, 4000].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-700/80"
                strokeDasharray={tick === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-medium tabular-nums dark:fill-slate-500"
              >
                {tick === 0 ? '0' : `${tick / 1000}k`}
              </text>
            </g>
          );
        })}

        {/* Area fills morphing cleanly without resetting */}
        <motion.path
          fill="url(#prodAreaGrad)"
          initial={shouldDraw ? { opacity: 0, d: prodArea } : { opacity: 1, d: prodArea }}
          animate={{ opacity: 1, d: prodArea }}
          transition={shouldDraw ? { duration: DURATIONS.chart * 0.7, ease: EASE_OUT } : morphTransition}
        />
        <motion.path
          fill="url(#feedAreaGrad)"
          initial={shouldDraw ? { opacity: 0, d: feedArea } : { opacity: 1, d: feedArea }}
          animate={{ opacity: 1, d: feedArea }}
          transition={shouldDraw ? { duration: DURATIONS.chart * 0.75, ease: EASE_OUT } : morphTransition}
        />

        {/* Lines draw in progressively on initial view and morph smoothly on range switch */}
        <motion.path
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldDraw ? { pathLength: 0, d: prodPathD } : { pathLength: 1, d: prodPathD }}
          animate={{ pathLength: 1, d: prodPathD }}
          transition={{
            pathLength: { duration: DURATIONS.chart, ease: EASE_OUT },
            d: morphTransition,
          }}
        />
        <motion.path
          fill="none"
          stroke="#16A34A"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldDraw ? { pathLength: 0, d: feedPathD } : { pathLength: 1, d: feedPathD }}
          animate={{ pathLength: 1, d: feedPathD }}
          transition={{
            pathLength: { duration: DURATIONS.chart + 0.08, ease: EASE_OUT },
            d: morphTransition,
          }}
        />

        {/* Hover vertical hairline */}
        <motion.line
          y1={padTop}
          y2={padTop + innerH}
          initial={false}
          animate={{ x1: getX(activeIdx), x2: getX(activeIdx) }}
          transition={effectiveReducedMotion ? { duration: 0 } : { duration: DURATIONS.button, ease: EASE_OUT }}
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        {/* Points */}
        {data.production.map((v, i) => (
          <g key={`pt-${i}`}>
            <motion.circle
              initial={false}
              animate={{ cx: getX(i), cy: getY(v), r: i === activeIdx ? 4.5 : 3 }}
              transition={morphTransition}
              fill="#2563EB"
              className="stroke-white dark:stroke-slate-900"
              strokeWidth="1.5"
            />
            <motion.circle
              initial={false}
              animate={{ cx: getX(i), cy: getY(data.feed[i]), r: i === activeIdx ? 4.5 : 3 }}
              transition={morphTransition}
              fill="#16A34A"
              className="stroke-white dark:stroke-slate-900"
              strokeWidth="1.5"
            />
            {/* Invisible hit target */}
            <rect
              x={getX(i) - 24}
              y={padTop}
              width={48}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => setHoverIdx(i)}
            />
          </g>
        ))}

        {/* X-axis labels */}
        {data.labels.map((lbl, i) => (
          <text
            key={`${range}-${i}`}
            x={getX(i)}
            y={height - 5}
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
          >
            {lbl}
          </text>
        ))}

        {/* Floating callout with smooth glide */}
        <motion.g
          initial={false}
          animate={{ x: tooltipX, y: tooltipY }}
          transition={
            effectiveReducedMotion
              ? { duration: 0 }
              : { duration: DURATIONS.button, ease: EASE_OUT }
          }
        >
          <rect
            width="96"
            height="34"
            rx="8"
            className="fill-slate-900/95 stroke-slate-700/70 dark:fill-slate-950 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <text x="48" y="14" textAnchor="middle" className="fill-white text-[10px] font-bold tabular-nums">
            {activeProd.toLocaleString()} {tr(language, 'kg uzalishaji', 'kg prod')}
          </text>
          <text x="48" y="26" textAnchor="middle" className="fill-emerald-400 text-[9px] font-semibold tabular-nums">
            {data.labels[activeIdx]} · {activeFeed.toLocaleString()} {tr(language, 'chakula', 'feed')}
          </text>
        </motion.g>
      </svg>
    </div>
  );
};

export interface BarChartDatum {
  label: string;
  primary: number;
  secondary?: number;
}

interface AnimatedBarChartProps {
  data: BarChartDatum[];
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue?: (val: number) => string;
  heightClass?: string;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#2563EB',
  secondaryColor = '#F97316',
  formatValue = (v) => v.toLocaleString(),
  heightClass = 'h-[190px]',
}) => {
  const { effectiveReducedMotion, language } = usePreferences();
  const resolvedPrimaryLabel = primaryLabel ?? tr(language, 'Mapato', 'Revenue');
  const resolvedSecondaryLabel = secondaryLabel ?? tr(language, 'Matumizi', 'Expenses');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const safeData = data.length > 0 ? data : [{ label: '—', primary: 0, secondary: 0 }];
  const hasSecondary = safeData.some((d) => typeof d.secondary === 'number');
  const maxVal = Math.max(
    1,
    ...safeData.flatMap((d) => [d.primary, d.secondary ?? 0])
  );

  const width = 440;
  const height = 175;
  const padLeft = 44;
  const padRight = 12;
  const padTop = 20;
  const padBottom = 26;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const groupW = innerW / safeData.length;
  const barW = hasSecondary ? Math.min(20, groupW * 0.28) : Math.min(28, groupW * 0.44);
  const baselineY = padTop + innerH;

  const formatAxisTick = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
    return String(Math.round(val));
  };

  const activeDatum = hoverIdx !== null ? safeData[hoverIdx] : null;
  const tooltipX =
    hoverIdx !== null
      ? Math.min(Math.max(padLeft + hoverIdx * groupW + groupW / 2 - 58, padLeft), width - 122)
      : 0;

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${heightClass} w-full overflow-visible`}>
        {[0, 0.33, 0.66, 1].map((ratio, idx) => {
          const val = maxVal * ratio;
          const y = baselineY - ratio * innerH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-700/80"
                strokeDasharray={idx === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9.5px] font-medium tabular-nums dark:fill-slate-500"
              >
                {formatAxisTick(val)}
              </text>
            </g>
          );
        })}

        {safeData.map((d, i) => {
          const cx = padLeft + i * groupW + groupW / 2;
          const h1 = Math.max(2, (d.primary / maxVal) * innerH);
          const h2 = typeof d.secondary === 'number' ? Math.max(2, (d.secondary / maxVal) * innerH) : 0;
          const x1 = hasSecondary ? cx - barW - 2 : cx - barW / 2;
          const x2 = cx + 2;
          const isHovered = hoverIdx === i;

          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => setHoverIdx(isHovered ? null : i)}
              className="cursor-pointer"
            >
              <rect
                x={padLeft + i * groupW}
                y={padTop}
                width={groupW}
                height={innerH}
                fill={isHovered ? 'rgba(37, 99, 235, 0.05)' : 'transparent'}
                rx="6"
              />
              <motion.rect
                x={x1}
                width={barW}
                rx="4"
                fill={primaryColor}
                opacity={hoverIdx === null || isHovered ? 0.95 : 0.45}
                initial={effectiveReducedMotion ? false : { y: baselineY, height: 0 }}
                animate={{ y: baselineY - h1, height: h1 }}
                transition={
                  effectiveReducedMotion
                    ? { duration: 0 }
                    : { duration: DURATIONS.chart, delay: i * 0.045, ease: EASE_OUT }
                }
              />
              {hasSecondary && (
                <motion.rect
                  x={x2}
                  width={barW}
                  rx="4"
                  fill={secondaryColor}
                  opacity={hoverIdx === null || isHovered ? 0.95 : 0.45}
                  initial={effectiveReducedMotion ? false : { y: baselineY, height: 0 }}
                  animate={{ y: baselineY - h2, height: h2 }}
                  transition={
                    effectiveReducedMotion
                      ? { duration: 0 }
                      : { duration: DURATIONS.chart, delay: i * 0.045 + 0.05, ease: EASE_OUT }
                  }
                />
              )}
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {activeDatum && hoverIdx !== null && (
          <motion.g
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, x: tooltipX, y: 2 }}
            transition={{ duration: DURATIONS.button, ease: EASE_OUT }}
            className="pointer-events-none"
          >
            <rect
              width="116"
              height={hasSecondary ? 36 : 24}
              rx="7"
              className="fill-slate-900/95 stroke-slate-700/70 dark:fill-slate-950"
              strokeWidth="1"
            />
            <text x="58" y="13" textAnchor="middle" className="fill-white text-[9.5px] font-bold tabular-nums">
              {resolvedPrimaryLabel}: {formatValue(activeDatum.primary)}
            </text>
            {hasSecondary && typeof activeDatum.secondary === 'number' && (
              <text x="58" y="27" textAnchor="middle" className="fill-amber-300 text-[9px] font-semibold tabular-nums">
                {resolvedSecondaryLabel}: {formatValue(activeDatum.secondary)}
              </text>
            )}
          </motion.g>
        )}
      </svg>
    </div>
  );
};

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface AnimatedDonutChartProps {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  formatValue?: (val: number) => string;
}

export const AnimatedDonutChart: React.FC<AnimatedDonutChartProps> = ({
  segments,
  centerLabel,
  centerValue,
  size = 136,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const { effectiveReducedMotion, language } = usePreferences();
  const resolvedCenterLabel = centerLabel ?? tr(language, 'Jumla', 'Total');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - 22) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePct = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth="16"
          />
          {positive.map((seg, idx) => {
            const pct = total > 0 ? seg.value / total : 0;
            const dashLen = pct * circumference;
            const gapLen = Math.max(0, circumference - dashLen);
            const rotateDeg = cumulativePct * 360;
            cumulativePct += pct;
            const isHovered = hoveredIdx === idx;

            return (
              <motion.circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? 19 : 16}
                strokeDasharray={`${dashLen} ${gapLen}`}
                transform={`rotate(${rotateDeg} ${size / 2} ${size / 2})`}
                initial={
                  effectiveReducedMotion
                    ? false
                    : { strokeDashoffset: dashLen, opacity: 0.4 }
                }
                animate={{
                  strokeDashoffset: 0,
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                }}
                transition={
                  effectiveReducedMotion
                    ? { duration: 0 }
                    : { duration: DURATIONS.chart, delay: idx * 0.06, ease: EASE_OUT }
                }
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-[stroke-width] duration-150"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center leading-tight">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {hoveredIdx !== null && positive[hoveredIdx] ? positive[hoveredIdx].label : resolvedCenterLabel}
          </span>
          <span className="mt-0.5 text-xs font-extrabold text-slate-900 tabular-nums dark:text-white">
            {hoveredIdx !== null && positive[hoveredIdx]
              ? formatValue(positive[hoveredIdx].value)
              : centerValue || formatValue(total)}
          </span>
        </div>
      </div>

      <div className="min-w-[140px] flex-1 space-y-1.5 text-xs">
        {positive.map((seg, idx) => {
          const share = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors duration-150 ${
                isHovered ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                  {seg.label}
                </span>
              </span>
              <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                {share}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface RadialGaugeProps {
  value: string;
  label: string;
  pct: number;
  strokeColor: string;
  size?: number;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value,
  label,
  pct,
  strokeColor,
  size = 66,
}) => {
  const { effectiveReducedMotion } = usePreferences();
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  return (
    <div className="group flex flex-col items-center">
      <div className="relative flex items-center justify-center transition-transform duration-150 group-hover:scale-105" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700/80"
            strokeWidth="6"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={effectiveReducedMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={
              effectiveReducedMotion
                ? { duration: 0 }
                : { duration: DURATIONS.chart, ease: EASE_OUT }
            }
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
          <span className="text-[11px] font-bold text-slate-900 tabular-nums dark:text-white">
            {value}
          </span>
        </div>
      </div>
      <span className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
};

export const WaterQualityMiniSparkline: React.FC = () => {
  const { effectiveReducedMotion } = usePreferences();
  const points = [18, 22, 20, 26, 24, 29, 27, 32, 30, 34, 33, 36];
  const w = 280;
  const h = 38;
  const linePath = `M ${points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / 40) * h}`)
    .join(' L ')}`;
  const area = `M 0,${h} L ${points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / 40) * h}`)
    .join(' L ')} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full overflow-hidden rounded-b-lg">
      <defs>
        <linearGradient id="wqMiniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#wqMiniGrad)"
        initial={effectiveReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATIONS.chart * 0.7, ease: EASE_OUT }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="#0284C7"
        strokeWidth="2"
        strokeLinecap="round"
        initial={effectiveReducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          effectiveReducedMotion
            ? { duration: 0 }
            : { duration: DURATIONS.chart, ease: EASE_OUT }
        }
      />
    </svg>
  );
};
