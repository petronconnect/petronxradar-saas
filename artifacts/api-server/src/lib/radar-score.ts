export interface RadarScoreInputs {
  totalOpportunities: number;
  opportunitiesThisMonth: number;
  classifiedOpportunities: number;
  classifiedSectors: number;
}

export function calculateRadarScore({
  totalOpportunities,
  opportunitiesThisMonth,
  classifiedOpportunities,
  classifiedSectors,
}: RadarScoreInputs): number {
  const total = Math.max(0, Math.trunc(totalOpportunities));
  const monthly = Math.min(total, Math.max(0, Math.trunc(opportunitiesThisMonth)));
  const classified = Math.min(total, Math.max(0, Math.trunc(classifiedOpportunities)));
  const sectorCount = Math.max(0, Math.trunc(classifiedSectors));

  const volumePoints = Math.min(total, 40);
  const activityPoints = Math.min(monthly, 20) * 1.5;
  const classificationCoverage = total > 0 ? classified / total : 0;
  const sectorDiversityPoints = Math.min(sectorCount, 10) * 3 * classificationCoverage;

  return Math.min(100, Math.round(volumePoints + activityPoints + sectorDiversityPoints));
}
