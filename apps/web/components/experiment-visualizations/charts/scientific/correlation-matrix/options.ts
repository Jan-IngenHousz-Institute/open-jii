/**
 * Correlation-matrix options. Pairwise correlations come from the SQL pipeline's
 * bivariate `corr` aggregate; Spearman is built on `RANK() OVER (ORDER BY col)`
 * inputs rather than a separate function name.
 */
export interface CorrelationMatrixChartOptions {
  corrMethod?: "pearson" | "spearman";
  corrColorscale?: string;
  corrReverseScale?: boolean;
  corrShowValues?: boolean;
  corrTextDecimals?: number;
  corrShowColorbar?: boolean;
}
