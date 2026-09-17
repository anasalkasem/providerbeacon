export const analyticsSeries = [
  { key: "views", color: "#C35C6B", tint: "#FCF0F2" },
  { key: "website", color: "#507DB7", tint: "#EEF3FB" },
  { key: "telegram", color: "#8564AD", tint: "#F4F0FA" },
] as const;

export type AnalyticsMetric = (typeof analyticsSeries)[number]["key"];
export type AnalyticsTotals = Record<AnalyticsMetric, number>;
export type AnalyticsDay = AnalyticsTotals & { day: string; measured: boolean };
export type AnalyticsReportData = {
  totals: AnalyticsTotals;
  daily: AnalyticsDay[];
  from: string;
  to: string;
  collectionEnabled: boolean;
  previous?: {
    totals: AnalyticsTotals;
    from: string;
    to: string;
    fullyMeasured: boolean;
  };
};

export function analyticsPresentation(data: AnalyticsReportData) {
  const contacts = data.totals.website + data.totals.telegram;
  const comparable = Boolean(
    data.collectionEnabled &&
      data.previous?.fullyMeasured &&
      data.daily.length &&
      data.daily.every(row => row.measured)
  );
  return {
    contacts,
    comparable,
    previousContacts: comparable
      ? data.previous!.totals.website + data.previous!.totals.telegram
      : null,
    channels: analyticsSeries.slice(1).map(series => ({
      ...series,
      value: data.totals[series.key],
      share: contacts > 0 ? data.totals[series.key] / contacts : null,
    })),
    daily: data.daily.map(row =>
      row.measured
        ? row
        : { ...row, views: null, website: null, telegram: null }
    ),
    comparisonMax: Math.max(
      1,
      ...analyticsSeries.map(series => data.totals[series.key]),
      ...(comparable
        ? analyticsSeries.map(series => data.previous!.totals[series.key])
        : [])
    ),
  };
}
