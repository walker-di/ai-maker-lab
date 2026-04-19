/**
 * Time-series feed shape consumed by `TrainingChartsView`. The chart layer
 * treats `x` as generation index and `y` as the metric value.
 */

export interface InspectorChartPoint {
  x: number;
  y: number;
}

export interface InspectorChartSeries {
  id: string;
  label: string;
  unit?: string;
  points: InspectorChartPoint[];
}
