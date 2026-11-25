import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DURATIONS, EASE_OUT, usePreferences } from '../ui';

interface FarmOverviewChartProps {
  range: '7d' | '30d' | '90d';
}

const CHART_SERIES: Record<
  '7d' | '30d' | '90d',
  { labels: string[]; production: number[]; feed: number[] }
> = {
  '30d': {
    labels: ['May 1', 'May 4', 'May 7', 'May 11', 'May 14', 'May 18', 'May 21', 'May 24', 'May 27'],
    production: [1520, 1780, 2240, 2310, 2720, 2940, 2780, 3260, 3800],
    feed: [1100, 1340, 1790, 1740, 2120, 2380, 2320, 2740, 3150],
  },
  '7d': {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
    production: [3150, 3240, 3360, 3420, 3550, 3680, 3800],
    feed: [2620, 2700, 2790, 2860, 2940, 3050, 3150],
  },
  '90d': {
    labels: ['Sep 1', 'Sep 15', 'Oct 1', 'Oct 15', 'Nov 1', 'Nov 10', 'Nov 19'],
    production: [920, 1340, 1850, 2410, 2890, 3380, 3800],
    feed: [710, 1020, 1410, 1860, 2310, 2780, 3150],
  },
};

export const FarmOverviewChart: React.FC<FarmOverviewChartProps> = ({ range }) => {
  const { effectiveReducedMotion } = usePreferences();
  const data = CHART_SERIES[range];
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

  const prodPoints = data.production.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const feedPoints = data.feed.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

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
  const tooltipX = Math.min(Math.max(getX(activeIdx) - 44, padLeft), width - 102);
  const tooltipY = Math.max(getY(activeProd) - 36, 2);

  const shouldDraw = !effectiveReducedMotion && !hasAnimatedRef.current;

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[175px] w-full overflow-visible">
        <defs>
          <linearGradient id="prodAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.20" />
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

        {/* Area fills */}
        <motion.path
          d={prodArea}
          fill="url(#prodAreaGrad)"
          initial={shouldDraw ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        />
        <motion.path
          d={feedArea}
          fill="url(#feedAreaGrad)"
          initial={shouldDraw ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        />

        {/* Lines drawing in on first view */}
        <motion.path
          d={prodPathD}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldDraw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.65, ease: EASE_OUT }}
        />
        <motion.path
          d={feedPathD}
          fill="none"
          stroke="#16A34A"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldDraw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.72, ease: EASE_OUT }}
        />

        {/* Keep hidden polylines out; use prodPoints/feedPoints data cleanly */}
        <polyline className="hidden" points={prodPoints} />
        <polyline className="hidden" points={feedPoints} />

        {/* Hover vertical hairline */}
        <line
          x1={getX(activeIdx)}
          y1={padTop}
          x2={getX(activeIdx)}
          y2={padTop + innerH}
          className="stroke-slate-400 transition-all duration-150 dark:stroke-slate-500"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        {/* Points */}
        {data.production.map((v, i) => (
          <g key={`pt-${i}`}>
            <circle
              cx={getX(i)}
              cy={getY(v)}
              r={i === activeIdx ? 4.5 : 3}
              fill="#2563EB"
              className="stroke-white transition-all duration-150 dark:stroke-slate-900"
              strokeWidth="1.5"
            />
            <circle
              cx={getX(i)}
              cy={getY(data.feed[i])}
              r={i === activeIdx ? 4.5 : 3}
              fill="#16A34A"
              className="stroke-white transition-all duration-150 dark:stroke-slate-900"
              strokeWidth="1.5"
            />
            {/* Invisible hit target */}
            <rect
              x={getX(i) - 18}
              y={padTop}
              width={36}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => setHoverIdx(i)}
            />
          </g>
        ))}

        {/* X-axis labels */}
        {data.labels.map((lbl, i) => {
          if (range === '30d' && i % 2 !== 0 && i !== data.labels.length - 1) return null;
          return (
            <text
              key={lbl}
              x={getX(i)}
              y={height - 5}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
            >
              {lbl}
            </text>
          );
        })}

        {/* Floating callout with smooth glide */}
        <motion.g
          initial={false}
          animate={{ x: tooltipX, y: tooltipY }}
          transition={
            effectiveReducedMotion
              ? { duration: 0 }
              : { duration: DURATIONS.fast, ease: EASE_OUT }
          }
        >
          <rect
            width="88"
            height="30"
            rx="7"
            className="fill-slate-800 stroke-slate-700/60 dark:fill-slate-950 dark:stroke-slate-700"
            strokeWidth="1"
          />
          <text x="44" y="13" textAnchor="middle" className="fill-white text-[10px] font-bold tabular-nums">
            {activeProd.toLocaleString()} kg
          </text>
          <text x="44" y="24" textAnchor="middle" className="fill-emerald-400 text-[9px] font-semibold">
            {data.labels[activeIdx]} · +15%
          </text>
        </motion.g>
      </svg>
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
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
                : { duration: 0.65, ease: EASE_OUT }
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
      <path d={area} fill="url(#wqMiniGrad)" />
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
            : { duration: 0.7, ease: EASE_OUT }
        }
      />
    </svg>
  );
};
