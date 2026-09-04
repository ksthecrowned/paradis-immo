'use client';

import { useTheme } from '@/components/theme-provider';
import {
  buildRevenueSeries,
  type ChartRangeKey,
  type PropertyModeSeries,
  type RevenueSeriesPoint,
} from '@/lib/dashboard/chart-series';
import { DASH_CHART_COLORS } from '@/lib/dash-icons';
import type { PublicPayment } from '@/lib/owner/payments';
import type { ThemeMode } from '@/lib/theme';
import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const RANGE_LABELS: Record<ChartRangeKey, string> = {
  '1m': '1M',
  '6m': '6M',
  '1y': '1Y',
};

function ChartRangeToggle({
  range,
  onChange,
}: {
  range: ChartRangeKey;
  onChange: (r: ChartRangeKey) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 text-[11px] font-medium">
      {(Object.keys(RANGE_LABELS) as ChartRangeKey[]).map((key) => (
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

function chartPalette(theme: ThemeMode): { muted: string; border: string } {
  return theme === 'light'
    ? { muted: '#8391a2', border: '#e7e9ef' }
    : { muted: '#afb9cf', border: '#272f37' };
}

function buildComboOptions(
  categories: string[],
  theme: ThemeMode,
  yMax: number,
): ApexOptions {
  const palette = chartPalette(theme);
  return {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
    },
    theme: { mode: theme },
    stroke: { width: [0, 3], curve: 'smooth' },
    colors: [DASH_CHART_COLORS.purple, DASH_CHART_COLORS.green],
    plotOptions: {
      bar: { columnWidth: '50%', borderRadius: 3 },
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: palette.muted },
      markers: { size: 4, offsetX: -2 },
      itemMargin: { horizontal: 12 },
    },
    xaxis: {
      categories,
      labels: { style: { colors: palette.muted, fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        min: 0,
        max: yMax > 0 ? undefined : 1,
        tickAmount: 4,
        labels: {
          style: { colors: palette.muted, fontSize: '11px' },
          formatter: (v) =>
            new Intl.NumberFormat('fr-FR', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(v),
        },
      },
      {
        opposite: true,
        min: 0,
        tickAmount: 4,
        labels: { style: { colors: palette.muted, fontSize: '11px' } },
      },
    ],
    grid: {
      borderColor: palette.border,
      strokeDashArray: 4,
      padding: { left: 8, right: 8 },
    },
    tooltip: { theme },
  };
}

function buildDonutOptions(theme: ThemeMode): ApexOptions {
  return {
    chart: { type: 'donut', background: 'transparent' },
    theme: { mode: theme },
    labels: ['Location courte', 'Location longue', 'Vente'],
    colors: [
      DASH_CHART_COLORS.purple,
      DASH_CHART_COLORS.blue,
      DASH_CHART_COLORS.green,
    ],
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: { size: '72%' },
      },
    },
    stroke: { width: 0 },
    tooltip: { theme },
  };
}

const EMPTY_MODE: PropertyModeSeries = {
  series: [0, 0, 0],
  rows: [
    { name: 'Location courte', count: 0, percent: '0%' },
    { name: 'Location longue', count: 0, percent: '0%' },
    { name: 'Vente', count: 0, percent: '0%' },
  ],
};

export function RevenueChart({
  payments = [],
}: {
  payments?: PublicPayment[];
}): React.JSX.Element {
  const { theme } = useTheme();
  const [range, setRange] = useState<ChartRangeKey>('1y');
  const data: RevenueSeriesPoint = useMemo(
    () => buildRevenueSeries(payments, range),
    [payments, range],
  );
  const yMax = Math.max(...data.revenue, 0);
  const options = useMemo(
    () => buildComboOptions(data.categories, theme, yMax),
    [data.categories, theme, yMax],
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-heading">Revenus encaissés</h3>
        <ChartRangeToggle range={range} onChange={setRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ReactApexChart
          key={`${theme}-${range}`}
          options={options}
          series={[
            { name: 'Montant', type: 'column', data: data.revenue },
            { name: 'Paiements', type: 'line', data: data.paymentCounts },
          ]}
          type="line"
          height={280}
        />
      </div>
    </div>
  );
}

export function PropertyModeChart({
  data = EMPTY_MODE,
}: {
  data?: PropertyModeSeries;
}): React.JSX.Element {
  const { theme } = useTheme();
  const options = useMemo(() => buildDonutOptions(theme), [theme]);
  const empty = data.series.every((n) => n === 0);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-heading">Biens par mode</h3>
      </div>
      {empty ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted">
          Aucun bien dans le portefeuille
        </div>
      ) : (
        <ReactApexChart
          key={theme}
          options={options}
          series={[...data.series]}
          type="donut"
          height={180}
        />
      )}
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pe-2 font-medium">Catégorie</th>
              <th className="pb-2 pe-2 font-medium">Biens</th>
              <th className="pb-2 font-medium">Part</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {data.rows.map((row) => (
              <tr key={row.name} className="border-t border-border/60">
                <td className="py-2.5 pe-2">{row.name}</td>
                <td className="py-2.5 pe-2">{row.count}</td>
                <td className="py-2.5">{row.percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
