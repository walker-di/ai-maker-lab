/**
 * Branded ID types for type-safe identifiers
 * 
 * These types provide compile-time safety for IDs without runtime overhead.
 * The brand is a phantom type that doesn't exist at runtime.
 * 
 * @example
 * const userId: UserId = 'user-123' as UserId;
 * const workItemId: WorkItemId = 'work-456' as WorkItemId;
 * 
 * // This would be a compile error:
 * // const wrong: UserId = workItemId;
 */

/**
 * Generic branded ID type
 * Use this to create new ID types for domain entities
 */
export type BrandedId<T extends string> = string & { readonly __brand: T };

// ============================================
// Identity domain IDs
// ============================================
export type UserId = BrandedId<'user'>;
export type SessionId = BrandedId<'session'>;
export type AccountId = BrandedId<'account'>;
export type ProfileId = BrandedId<'profile'>;

// ============================================
// Project domain IDs
// ============================================
export type WorkItemId = BrandedId<'work_item'>;
export type WorkItemCommentId = BrandedId<'work_item_comment'>;
export type IssueId = BrandedId<'issue'>;
export type IssueCommentId = BrandedId<'issue_comment'>;
export type UserStoryId = BrandedId<'user_story'>;
export type ProjectId = BrandedId<'project'>;
export type WorkspaceId = BrandedId<'workspace'>;
export type ProjectMemberId = BrandedId<'project_member'>;
export type WorkspaceMemberId = BrandedId<'workspace_member'>;
export type EpicId = BrandedId<'epic'>;
export type FeatureId = BrandedId<'feature'>;
export type ReleaseId = BrandedId<'release'>;
export type PersonaId = BrandedId<'persona'>;
export type ActionId = BrandedId<'action'>;
export type AgentJobId = BrandedId<'agent_job'>;
export type PublishingId = BrandedId<'publishing'>;
export type FeedbackId = BrandedId<'feedback'>;

// ============================================
// AI domain IDs
// ============================================
export type AgentId = BrandedId<'agent'>;
export type AgentIssueId = BrandedId<'agent_issue'>;
export type AiToolId = BrandedId<'ai_tool'>;
export type ModelCardId = BrandedId<'model_card'>;
export type ThreadId = BrandedId<'thread'>;
export type SandboxId = BrandedId<'sandbox'>;
export type AgentSessionId = BrandedId<'agent_session'>;

// ============================================
// Commerce domain IDs
// ============================================
export type SubscriptionId = BrandedId<'subscription'>;
export type CreditBalanceId = BrandedId<'credit_balance'>;
export type ReferralId = BrandedId<'referral'>;
export type AthleteVerificationId = BrandedId<'athlete_verification'>;
export type AdditionalCreditsId = BrandedId<'additional_credits'>;

// ============================================
// Content domain IDs
// ============================================
export type FileItemId = BrandedId<'file_item'>;
export type BlogPostId = BrandedId<'blog_post'>;
export type CollectionId = BrandedId<'collection'>;
export type MediaFileId = BrandedId<'media_file'>;
export type NoteId = BrandedId<'note'>;

// ============================================
// Integration domain IDs
// ============================================
export type IntegrationId = BrandedId<'integration'>;
export type ChatId = BrandedId<'chat'>;
export type NoticeId = BrandedId<'notice'>;
export type ContactId = BrandedId<'contact'>;
export type SocialConnectionId = BrandedId<'social_connection'>;

// ============================================
// Admin domain IDs
// ============================================
export type DeploymentId = BrandedId<'deployment'>;
export type VaultId = BrandedId<'vault'>;
export type FeatureFlagId = BrandedId<'feature_flag'>;
export type PromptId = BrandedId<'prompt'>;
export type ActionQueueId = BrandedId<'action_queue'>;

// ============================================
// Product domain IDs
// ============================================
export type EnergyCardId = BrandedId<'energy_card'>;
export type AlbumId = BrandedId<'album'>;
export type AlbumCardId = BrandedId<'album_card'>;
export type AlbumMemberId = BrandedId<'album_member'>;
export type AlbumInvitationId = BrandedId<'album_invitation'>;
export type WatermarkId = BrandedId<'watermark'>;
export type DesignId = BrandedId<'design'>;

// ============================================
// Marketing domain IDs
// ============================================
export type AnalyticsEventId = BrandedId<'analytics_event'>;
export type CampaignId = BrandedId<'campaign'>;
export type ABTestId = BrandedId<'abtest'>;
export type ContentItemId = BrandedId<'content_item'>;
export type MarketingMapId = BrandedId<'marketing_map'>;

// ============================================
// Helper Functions
// ============================================

/**
 * Helper to create a branded ID from a string
 * Use this when you need to convert raw strings to branded IDs
 */
export function createId<T extends string>(id: string): BrandedId<T> {
  return id as BrandedId<T>;
}

/**
 * Helper to extract the raw string from a branded ID
 * Useful when you need to pass the ID to external systems
 */
export function extractId<T extends string>(id: BrandedId<T>): string {
  return id as string;
}

/**
 * Type guard to check if a value is a valid ID string
 */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Create a UserId from a raw string
 */
export function userId(id: string): UserId {
  return createId<'user'>(id);
}

/**
 * Create a ProjectId from a raw string
 */
export function projectId(id: string): ProjectId {
  return createId<'project'>(id);
}

/**
 * Create a WorkspaceId from a raw string
 */
export function workspaceId(id: string): WorkspaceId {
  return createId<'workspace'>(id);
}

/**
 * Create a WorkItemId from a raw string
 */
export function workItemId(id: string): WorkItemId {
  return createId<'work_item'>(id);
}

/**
 * Create a VaultId from a raw string
 */
export function vaultId(id: string): VaultId {
  return createId<'vault'>(id);
}

/**
 * Create a FeatureId from a raw string
 */
export function featureId(id: string): FeatureId {
  return createId<'feature'>(id);
}

/**
 * Create a ReleaseId from a raw string
 */
export function releaseId(id: string): ReleaseId {
  return createId<'release'>(id);
}

/**
 * Create an EpicId from a raw string
 */
export function epicId(id: string): EpicId {
  return createId<'epic'>(id);
}

/**
 * Create a PersonaId from a raw string
 */
export function personaId(id: string): PersonaId {
  return createId<'persona'>(id);
}
