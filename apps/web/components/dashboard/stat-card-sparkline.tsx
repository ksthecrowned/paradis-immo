'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function StatCardSparkline({
  data,
  color = '#6c5ce7',
}: {
  data: number[];
  color?: string;
}): React.JSX.Element {
  const options: ApexOptions = {
    chart: {
      type: 'area',
      sparkline: { enabled: true },
      animations: { enabled: false },
    },
    stroke: { curve: 'smooth', width: 2, colors: [color] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    colors: [color],
    tooltip: { enabled: false },
  };

  return (
    <div className="h-14 w-full">
      <ReactApexChart
        options={options}
        series={[{ data }]}
        type="area"
        height={56}
        width="100%"
      />
    </div>
  );
}
