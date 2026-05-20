export type CustomerJourneyMapStatus = 'draft' | 'active' | 'archived';

export type JourneyMapLaneKind =
  | 'actions'
  | 'thoughts'
  | 'emotions'
  | 'touchpoints'
  | 'pain_points'
  | 'opportunities'
  | 'custom';

export interface JourneyMapStage {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
}

export interface JourneyMapLane {
  id: string;
  title: string;
  kind: JourneyMapLaneKind;
  order: number;
  color?: string;
}

export interface JourneyMapCell {
  id: string;
  stageId: string;
  laneId: string;
  content: string;
  quote?: string;
  source?: string;
  sentiment?: 'negative' | 'neutral' | 'positive';
  evidenceIds?: string[];
}

export interface JourneyMapTouchpoint {
  id: string;
  stageId: string;
  label: string;
  icon?: string;
  channel?: string;
  order: number;
}

export interface JourneyMapEmotionPoint {
  id: string;
  stageId: string;
  label: string;
  score: number;
  emoji?: string;
  order: number;
}

export interface JourneyMapOpportunity {
  id: string;
  stageId?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  owner?: string;
}

export interface CustomerJourneyMap {
  id: string;
  productId: string;
  personaId?: string;
  campaignId?: string;
  creativeId?: string;
  name: string;
  description?: string;
  scenario?: string;
  goals: string[];
  status: CustomerJourneyMapStatus;
  tags: string[];
  stages: JourneyMapStage[];
  lanes: JourneyMapLane[];
  cells: JourneyMapCell[];
  touchpoints: JourneyMapTouchpoint[];
  emotionPoints: JourneyMapEmotionPoint[];
  opportunities: JourneyMapOpportunity[];
  createdAt: string;
  updatedAt: string;
}
