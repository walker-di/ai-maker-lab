import type {
	JourneyMapCell,
	JourneyMapEmotionPoint,
	JourneyMapLane,
	JourneyMapOpportunity,
	JourneyMapStage,
	JourneyMapTouchpoint,
} from '../types.js';

export const defaultJourneyMapStages: JourneyMapStage[] = [
	{ id: 'awareness', title: 'Awareness', icon: '👀', order: 0, description: 'Discovers a better way to turn research into customer-facing decisions.' },
	{ id: 'evaluation', title: 'Evaluation', icon: '🔎', order: 1, description: 'Compares templates, AI tools, and consultant-led alternatives.' },
	{ id: 'trial-setup', title: 'Trial setup', icon: '⚙️', order: 2, description: 'Imports notes, invites team, and connects workspace sources.' },
	{ id: 'first-value', title: 'First value', icon: '✨', order: 3, description: 'Generates the first journey map and identifies a product opportunity.' },
	{ id: 'expansion', title: 'Expansion', icon: '🚀', order: 4, description: 'Shares journey evidence and standardizes planning.' },
];

export const defaultJourneyMapLanes: JourneyMapLane[] = [
	{ id: 'actions', title: 'Actions', kind: 'actions', order: 0, color: 'blue' },
	{ id: 'thoughts', title: 'Thoughts', kind: 'thoughts', order: 1, color: 'yellow' },
	{ id: 'emotions', title: 'Emotions', kind: 'emotions', order: 2, color: 'teal' },
	{ id: 'touchpoints', title: 'Touchpoints', kind: 'touchpoints', order: 3, color: 'aqua' },
	{ id: 'pain-points', title: 'Pain points', kind: 'pain_points', order: 4, color: 'rose' },
	{ id: 'opportunities', title: 'Opportunities', kind: 'opportunities', order: 5, color: 'purple' },
];

const cell = (stageId: string, laneId: string, content: string, quote?: string): JourneyMapCell => ({
	id: `${stageId}-${laneId}`,
	stageId,
	laneId,
	content,
	quote,
	evidenceIds: [],
});

export const defaultJourneyMapCells: JourneyMapCell[] = [
	cell('awareness', 'actions', 'Finds examples, referrals, and posts from teams using customer evidence.'),
	cell('evaluation', 'actions', 'Compares journey templates, AI tools, research repositories, and consultants.'),
	cell('trial-setup', 'actions', 'Pastes notes, invites teammates, and considers connecting data sources.'),
	cell('first-value', 'actions', 'Generates a first map and shares it in a product-growth meeting.'),
	cell('expansion', 'actions', 'Assigns owners and schedules recurring journey reviews.'),
	cell('awareness', 'thoughts', 'Feedback is everywhere, but nobody agrees where customers get stuck.', 'We have feedback everywhere, but no shared picture.'),
	cell('evaluation', 'thoughts', 'Needs proof this is more useful than another abandoned board.', 'Will this become another research board?'),
	cell('trial-setup', 'thoughts', 'Wants a useful draft before connecting every tool.', 'Can I see value before connecting five tools?'),
	cell('first-value', 'thoughts', 'Trust increases when generated insights link back to source evidence.', 'The citations make this easier to defend.'),
	cell('expansion', 'thoughts', 'Needs clear ownership so the map stays alive.', 'Who owns keeping this updated?'),
	cell('awareness', 'pain-points', 'Messaging feels similar to generic research repositories.'),
	cell('evaluation', 'pain-points', 'ROI is hard to judge without a relevant company example.'),
	cell('trial-setup', 'pain-points', 'Integrations create a cold-start wall before value appears.'),
	cell('first-value', 'pain-points', 'Teams worry AI synthesis may hide nuance.'),
	cell('expansion', 'pain-points', 'Governance is unclear when multiple teams edit the map.'),
];

export const defaultJourneyMapTouchpoints: JourneyMapTouchpoint[] = [
	{ id: 'awareness-web', stageId: 'awareness', label: 'Website', icon: '🌐', order: 0 },
	{ id: 'awareness-social', stageId: 'awareness', label: 'Social', icon: '💬', order: 1 },
	{ id: 'evaluation-demo', stageId: 'evaluation', label: 'Demo', icon: '🖥️', order: 0 },
	{ id: 'evaluation-case-study', stageId: 'evaluation', label: 'Case study', icon: '📄', order: 1 },
	{ id: 'trial-import', stageId: 'trial-setup', label: 'Import', icon: '📥', order: 0 },
	{ id: 'trial-invite', stageId: 'trial-setup', label: 'Invite', icon: '👥', order: 1 },
	{ id: 'value-map', stageId: 'first-value', label: 'Map board', icon: '🗺️', order: 0 },
	{ id: 'value-export', stageId: 'first-value', label: 'Export', icon: '📤', order: 1 },
	{ id: 'expansion-digest', stageId: 'expansion', label: 'Digest', icon: '📈', order: 0 },
	{ id: 'expansion-review', stageId: 'expansion', label: 'Review', icon: '🔁', order: 1 },
];

export const defaultJourneyMapEmotionPoints: JourneyMapEmotionPoint[] = [
	{ id: 'emotion-awareness', stageId: 'awareness', label: 'Curious', score: 58, emoji: '🤔', order: 0 },
	{ id: 'emotion-evaluation', stageId: 'evaluation', label: 'Interested', score: 64, emoji: '🙂', order: 1 },
	{ id: 'emotion-trial', stageId: 'trial-setup', label: 'Anxious', score: 34, emoji: '😟', order: 2 },
	{ id: 'emotion-value', stageId: 'first-value', label: 'Relieved', score: 88, emoji: '😄', order: 3 },
	{ id: 'emotion-expansion', stageId: 'expansion', label: 'Confident', score: 73, emoji: '😍', order: 4 },
];

export const defaultJourneyMapOpportunities: JourneyMapOpportunity[] = [
	{ id: 'opp-awareness', stageId: 'awareness', title: 'Lead with before/after journey examples.', priority: 'medium' },
	{ id: 'opp-evaluation', stageId: 'evaluation', title: 'Add benchmark ROI calculator and sample gallery.', priority: 'medium' },
	{ id: 'opp-trial', stageId: 'trial-setup', title: 'Offer “paste notes first” mode before integrations.', priority: 'high' },
	{ id: 'opp-value', stageId: 'first-value', title: 'Show citation trails and confidence badges.', priority: 'high' },
	{ id: 'opp-expansion', stageId: 'expansion', title: 'Create quarterly journey review templates.', priority: 'medium' },
];
