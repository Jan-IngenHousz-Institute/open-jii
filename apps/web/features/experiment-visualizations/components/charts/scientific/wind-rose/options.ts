/**
 * Wind-rose options. Direction is binned into compass slices and magnitude
 * into value bands client-side, then rows are counted per bucket. No
 * `aggregate` dropdown on the data shelf because counting is the chart's purpose.
 */
export interface WindRoseChartOptions {
  windRoseDirectionBins?: 8 | 16 | 32;
  windRoseValueBins?: number;
  windRoseColorscale?: string;
  windRoseReverseScale?: boolean;
  windRoseShowDirectionLabels?: boolean;
}
