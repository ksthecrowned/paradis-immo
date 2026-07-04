'use client';

import { DASH_CHART_COLORS } from '@/lib/dash-icons';
import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

type RangeKey = 'all' | '1m' | '6m' | '1y';

const RANGE_LABELS: Record<RangeKey, string> = {
  all: 'ALL',
  '1m': '1M',
  '6m': '6M',
  '1y': '1Y',
};

const MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

const DATA_BY_RANGE: Record<
  RangeKey,
  { categories: string[]; revenue: number[]; clicks: number[]; views: number[] }
> = {
  all: {
    categories: MONTHS,
    revenue: [32, 38, 35, 42, 48, 52, 55, 58, 54, 60, 65, 72],
    clicks: [18, 22, 20, 26, 28, 30, 32, 34, 31, 36, 38, 42],
    views: [45, 50, 48, 55, 58, 62, 64, 68, 65, 70, 74, 78],
  },
  '1m': {
    categories: ['S1', 'S2', 'S3', 'S4'],
    revenue: [14, 16, 15, 18],
    clicks: [8, 9, 10, 11],
    views: [20, 22, 21, 24],
  },
  '6m': {
    categories: MONTHS.slice(6),
    revenue: [55, 58, 54, 60, 65, 72],
    clicks: [32, 34, 31, 36, 38, 42],
    views: [64, 68, 65, 70, 74, 78],
  },
  '1y': {
    categories: MONTHS,
    revenue: [32, 38, 35, 42, 48, 52, 55, 58, 54, 60, 65, 72],
    clicks: [18, 22, 20, 26, 28, 30, 32, 34, 31, 36, 38, 42],
    views: [45, 50, 48, 55, 58, 62, 64, 68, 65, 70, 74, 78],
  },
};

function ChartRangeToggle({
  range,
  onChange,
}: {
  range: RangeKey;
  onChange: (r: RangeKey) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 text-[11px] font-medium">
      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={
            'rounded px-2 py-1 transition-colors ' +
            (range === key
              ? 'bg-card text-foreground'
              : 'text-muted hover:text-foreground')
          }
        >
          {RANGE_LABELS[key]}
        </button>
      ))}
    </div>
  );
}

function buildComboOptions(categories: string[]): ApexOptions {
  return {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
    },
    theme: { mode: 'dark' },
    stroke: { width: [0, 3, 3], curve: 'smooth', dashArray: [0, 0, 5] },
    colors: [DASH_CHART_COLORS.purple, DASH_CHART_COLORS.green, DASH_CHART_COLORS.violet],
    plotOptions: {
      bar: { columnWidth: '50%', borderRadius: 3 },
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: '#afb9cf' },
      markers: { size: 4, offsetX: -2 },
      itemMargin: { horizontal: 12 },
    },
    xaxis: {
      categories,
      labels: { style: { colors: '#afb9cf', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 80,
      tickAmount: 4,
      labels: { style: { colors: '#afb9cf', fontSize: '11px' } },
    },
    grid: {
      borderColor: '#272f37',
      strokeDashArray: 4,
      padding: { left: 8, right: 8 },
    },
    tooltip: { theme: 'dark' },
  };
}

const donutOptions: ApexOptions = {
  chart: { type: 'donut', background: 'transparent' },
  theme: { mode: 'dark' },
  labels: ['Location courte', 'Location longue', 'Vente'],
  colors: [DASH_CHART_COLORS.purple, DASH_CHART_COLORS.blue, DASH_CHART_COLORS.green],
  legend: { show: false },
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      donut: { size: '72%' },
    },
  },
  stroke: { width: 0 },
};

const donutSeries = [33, 50, 17];

const CATEGORY_ROWS = [
  { name: 'Location courte', orders: '4', percent: '33%', trend: '2.5% Up', up: true },
  { name: 'Location longue', orders: '6', percent: '50%', trend: '8.1% Up', up: true },
  { name: 'Vente', orders: '2', percent: '17%', trend: '1.2% Down', up: false },
];

export function RevenueChart(): React.JSX.Element {
  const [range, setRange] = useState<RangeKey>('1y');
  const data = DATA_BY_RANGE[range];

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-heading">Revenus</h3>
        <ChartRangeToggle range={range} onChange={setRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ReactApexChart
          options={buildComboOptions(data.categories)}
          series={[
            { name: 'Revenus', type: 'column', data: data.revenue },
            { name: 'Clics', type: 'line', data: data.clicks },
            { name: 'Vues', type: 'line', data: data.views },
          ]}
          type="line"
          height={280}
        />
      </div>
    </div>
  );
}

export function PropertyModeChart(): React.JSX.Element {
  const [range, setRange] = useState<RangeKey>('1y');

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-heading">
          Biens par mode
        </h3>
        <ChartRangeToggle range={range} onChange={setRange} />
      </div>
      <ReactApexChart
        options={donutOptions}
        series={donutSeries}
        type="donut"
        height={180}
      />
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pe-2 font-medium">Catégorie</th>
              <th className="pb-2 pe-2 font-medium">Biens</th>
              <th className="pb-2 pe-2 font-medium">Part</th>
              <th className="pb-2 font-medium text-end">Tendance</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {CATEGORY_ROWS.map((row) => (
              <tr key={row.name} className="border-t border-border/60">
                <td className="py-2.5 pe-2">{row.name}</td>
                <td className="py-2.5 pe-2">{row.orders}</td>
                <td className="py-2.5 pe-2">{row.percent}</td>
                <td className="py-2.5 text-end">
                  <span
                    className={
                      'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ' +
                      (row.up
                        ? 'bg-success/15 text-success'
                        : 'bg-danger/15 text-danger')
                    }
                  >
                    {row.trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SessionsMapCard(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-heading">
          Sessions par ville
        </h3>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted"
        >
          Voir données ▾
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-background/80 p-4">
        <svg
          viewBox="0 0 360 180"
          className="h-full w-full max-h-48 text-border"
          aria-hidden
        >
          <ellipse cx="180" cy="90" rx="160" ry="70" fill="currentColor" opacity="0.35" />
          <ellipse cx="120" cy="75" rx="40" ry="25" fill="currentColor" opacity="0.2" />
          <ellipse cx="250" cy="85" rx="50" ry="30" fill="currentColor" opacity="0.2" />
        </svg>
        {[
          { x: '28%', y: '38%', label: 'Brazzaville' },
          { x: '52%', y: '55%', label: 'Pointe-Noire' },
          { x: '68%', y: '42%', label: 'Dolisie' },
        ].map((pin) => (
          <div
            key={pin.label}
            className="absolute"
            style={{ left: pin.x, top: pin.y }}
          >
            <span className="block size-2 rounded-full bg-white ring-2 ring-accent" />
            <span className="mt-1 block whitespace-nowrap text-[10px] text-muted">
              {pin.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
