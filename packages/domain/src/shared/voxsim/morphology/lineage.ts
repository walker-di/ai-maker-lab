/**
 * Body DNA lineage helpers. Browser-safe data records only.
 */

export interface LineageRef {
  parentBodyDnaId?: string;
  mutationSummary?: string;
  generation?: number;
}
