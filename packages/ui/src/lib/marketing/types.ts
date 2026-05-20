// These mirror packages/domain/src/shared/marketing types but are defined independently
// to avoid coupling packages/ui to packages/domain

export type CreativeType = 'text' | 'image' | 'video' | 'landing_page'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'
export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'
export type Gender = 'male' | 'female' | 'non_binary' | 'all'
export type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'line'
export type VideoFormat = '16:9' | '9:16' | '1:1' | '4:5'
export type CustomerJourneyMapStatus = 'draft' | 'active' | 'archived'
export type JourneyMapLaneKind =
  | 'actions'
  | 'thoughts'
  | 'emotions'
  | 'touchpoints'
  | 'pain_points'
  | 'opportunities'
  | 'custom'

export interface JourneyMapStage {
  id: string
  title: string
  description?: string
  icon?: string
  order: number
}

export interface JourneyMapLane {
  id: string
  title: string
  kind: JourneyMapLaneKind
  order: number
  color?: string
}

export interface JourneyMapCell {
  id: string
  stageId: string
  laneId: string
  content: string
  quote?: string
  source?: string
  sentiment?: 'negative' | 'neutral' | 'positive'
  evidenceIds?: string[]
}

export interface JourneyMapTouchpoint {
  id: string
  stageId: string
  label: string
  icon?: string
  channel?: string
  order: number
}

export interface JourneyMapEmotionPoint {
  id: string
  stageId: string
  label: string
  score: number
  emoji?: string
  order: number
}

export interface JourneyMapOpportunity {
  id: string
  stageId?: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  owner?: string
}

export interface CustomerJourneyMap {
  id: string
  productId: string
  personaId?: string
  campaignId?: string
  creativeId?: string
  name: string
  description?: string
  scenario?: string
  goals: string[]
  status: CustomerJourneyMapStatus
  tags: string[]
  stages: JourneyMapStage[]
  lanes: JourneyMapLane[]
  cells: JourneyMapCell[]
  touchpoints: JourneyMapTouchpoint[]
  emotionPoints: JourneyMapEmotionPoint[]
  opportunities: JourneyMapOpportunity[]
  createdAt: string
  updatedAt: string
}

export interface Product {
	id: string
	name: string
	description: string
	imageUrl?: string
	features: string[]
	benefits: string[]
	targetAudience: string
	createdAt: string
	updatedAt: string
}

export interface Campaign {
	id: string
	name: string
	description: string
	productId: string
	status: CampaignStatus
	startDate?: string
	endDate?: string
	goals: string
	createdAt: string
	updatedAt: string
}

export interface Persona {
	id: string
	productId?: string
	name: string
	age: number
	ageRange: AgeRange
	gender: Gender
	occupation: string
	interests: string[]
	painPoints: string[]
	motivations: string[]
	description: string
	avatarUrl?: string
	createdAt: string
	updatedAt: string
}

export interface Creative {
	id: string
	productId: string
	personaId?: string
	campaignId?: string
	type: CreativeType
	name: string
	status: string
	tags: string[]
	createdAt: string
	updatedAt: string
}

export interface Story {
	id: string
	creativeId: string
	title: string
	description?: string
	totalDuration?: number
	createdAt: string
	updatedAt: string
}

export interface Scene {
	id: string
	storyId: string
	orderIndex: number
	description?: string
	durationMs?: number
	canvasData?: string
	createdAt: string
	updatedAt: string
}

export interface CreateProductInput {
	name: string
	description: string
	targetAudience: string
	features: string[]
	benefits: string[]
}

export interface UpdateProductInput {
	name?: string
	description?: string
	targetAudience?: string
	features?: string[]
	benefits?: string[]
	imageUrl?: string
}

export interface CreateCampaignInput {
	name: string
	description: string
	productId: string
	goals: string
}

export interface Clip {
	id: string
	sceneId: string
	orderIndex: number
	type: 'image' | 'video' | 'text'
	content?: string
	imageUrl?: string
	videoUrl?: string
	narrationText?: string
	narrationAudioUrl?: string
	durationMs?: number
	createdAt: string
	updatedAt: string
}

export interface CreateClipInput {
	sceneId: string
	orderIndex: number
	type: 'image' | 'video' | 'text'
	content?: string
	narrationText?: string
	durationMs?: number
}

export interface CreatePersonaInput {
	productId?: string
	name: string
	age: number
	ageRange: AgeRange
	gender: Gender
	occupation: string
	interests: string[]
	painPoints: string[]
	motivations: string[]
	description: string
}

export interface CreateCustomerJourneyMapInput {
	productId: string
	personaId?: string
	campaignId?: string
	creativeId?: string
	name: string
	description?: string
	scenario?: string
	goals: string[]
	status: CustomerJourneyMapStatus
	tags: string[]
	stages: JourneyMapStage[]
	lanes: JourneyMapLane[]
	cells: JourneyMapCell[]
	touchpoints: JourneyMapTouchpoint[]
	emotionPoints: JourneyMapEmotionPoint[]
	opportunities: JourneyMapOpportunity[]
}
