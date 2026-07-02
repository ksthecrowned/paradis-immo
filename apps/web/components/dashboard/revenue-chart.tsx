'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const chartOptions: ApexOptions = {
  chart: {
    type: 'area',
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'inherit',
  },
  theme: { mode: 'dark' },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#6c5ce7'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.35,
      opacityTo: 0.02,
      stops: [0, 100],
    },
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
    labels: { style: { colors: '#9aa0b4' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { colors: '#9aa0b4' },
      formatter: (value: number) => `${Math.round(value / 1000)}k`,
    },
  },
  grid: {
    borderColor: '#2d3348',
    strokeDashArray: 4,
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (value: number) =>
        new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XAF',
          maximumFractionDigits: 0,
        }).format(value),
    },
  },
};

const chartSeries = [
  {
    name: 'Revenus',
    data: [420_000, 580_000, 510_000, 670_000, 720_000, 780_000],
  },
];

const donutOptions: ApexOptions = {
  chart: { type: 'donut', background: 'transparent' },
  theme: { mode: 'dark' },
  labels: ['Location courte', 'Location longue', 'Vente'],
  colors: ['#6c5ce7', '#00b894', '#fdcb6e'],
  legend: {
    position: 'bottom',
    labels: { colors: '#9aa0b4' },
  },
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Biens',
            color: '#9aa0b4',
            formatter: () => '12',
          },
        },
      },
    },
  },
  stroke: { width: 0 },
};

const donutSeries = [4, 6, 2];

export function RevenueChart(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-dash-text">Revenus</h3>
        <span className="text-xs text-dash-text-muted">6 derniers mois</span>
      </div>
      <ReactApexChart
        options={chartOptions}
        series={chartSeries}
        type="area"
        height={280}
      />
    </div>
  );
}

export function PropertyModeChart(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-card p-5">
      <div className="mb-2">
        <h3 className="text-base font-semibold text-dash-text">
          Biens par mode
        </h3>
        <p className="mt-1 text-xs text-dash-text-muted">Données de démonstration</p>
      </div>
      <ReactApexChart
        options={donutOptions}
        series={donutSeries}
        type="donut"
        height={280}
      />
    </div>
  );
}
