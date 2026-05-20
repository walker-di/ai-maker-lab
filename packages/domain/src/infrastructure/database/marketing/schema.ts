import type { IDbClient } from '../../../core/interfaces/IDbClient.js';

export const MARKETING_SCHEMA_QUERY = /* surql */`
DEFINE TABLE OVERWRITE marketing_product SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON marketing_product TYPE string;
DEFINE FIELD IF NOT EXISTS description ON marketing_product TYPE option<string>;
DEFINE FIELD IF NOT EXISTS targetAudience ON marketing_product TYPE option<string>;
DEFINE FIELD IF NOT EXISTS features ON marketing_product TYPE array<string>;
DEFINE FIELD IF NOT EXISTS benefits ON marketing_product TYPE array<string>;
DEFINE FIELD IF NOT EXISTS imageUrl ON marketing_product TYPE option<string>;
DEFINE FIELD IF NOT EXISTS createdAt ON marketing_product TYPE string;
DEFINE FIELD IF NOT EXISTS updatedAt ON marketing_product TYPE string;
DEFINE INDEX IF NOT EXISTS idx_marketing_product_created ON marketing_product FIELDS createdAt;

DEFINE TABLE OVERWRITE marketing_persona SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS productId ON marketing_persona TYPE string;
DEFINE FIELD IF NOT EXISTS name ON marketing_persona TYPE string;
DEFINE FIELD IF NOT EXISTS age ON marketing_persona TYPE option<number>;
DEFINE FIELD IF NOT EXISTS ageRange ON marketing_persona TYPE string;
DEFINE FIELD IF NOT EXISTS gender ON marketing_persona TYPE string;
DEFINE FIELD IF NOT EXISTS occupation ON marketing_persona TYPE option<string>;
DEFINE FIELD IF NOT EXISTS income ON marketing_persona TYPE option<string>;
DEFINE FIELD IF NOT EXISTS interests ON marketing_persona TYPE array<string>;
DEFINE FIELD IF NOT EXISTS painPoints ON marketing_persona TYPE array<string>;
DEFINE FIELD IF NOT EXISTS motivations ON marketing_persona TYPE array<string>;
DEFINE FIELD IF NOT EXISTS description ON marketing_persona TYPE option<string>;
DEFINE FIELD IF NOT EXISTS avatarUrl ON marketing_persona TYPE option<string>;
DEFINE FIELD IF NOT EXISTS createdAt ON marketing_persona TYPE string;
DEFINE FIELD IF NOT EXISTS updatedAt ON marketing_persona TYPE string;
DEFINE INDEX IF NOT EXISTS idx_marketing_persona_product ON marketing_persona FIELDS productId;
DEFINE INDEX IF NOT EXISTS idx_marketing_persona_created ON marketing_persona FIELDS createdAt;
DEFINE INDEX IF NOT EXISTS idx_marketing_persona_product_created ON marketing_persona FIELDS productId, createdAt;

DEFINE TABLE OVERWRITE marketing_customer_journey_map SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS productId ON marketing_customer_journey_map TYPE string;
DEFINE FIELD IF NOT EXISTS personaId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD IF NOT EXISTS campaignId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD IF NOT EXISTS creativeId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD IF NOT EXISTS name ON marketing_customer_journey_map TYPE string;
DEFINE FIELD IF NOT EXISTS description ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD IF NOT EXISTS scenario ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD IF NOT EXISTS goals ON marketing_customer_journey_map TYPE array<string>;
DEFINE FIELD IF NOT EXISTS status ON marketing_customer_journey_map TYPE string;
DEFINE FIELD IF NOT EXISTS tags ON marketing_customer_journey_map TYPE array<string>;
DEFINE FIELD IF NOT EXISTS stages ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS lanes ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS cells ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS touchpoints ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS emotionPoints ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS opportunities ON marketing_customer_journey_map TYPE any;
DEFINE FIELD IF NOT EXISTS createdAt ON marketing_customer_journey_map TYPE string;
DEFINE FIELD IF NOT EXISTS updatedAt ON marketing_customer_journey_map TYPE string;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_product ON marketing_customer_journey_map FIELDS productId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_persona ON marketing_customer_journey_map FIELDS personaId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_campaign ON marketing_customer_journey_map FIELDS campaignId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_creative ON marketing_customer_journey_map FIELDS creativeId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_created ON marketing_customer_journey_map FIELDS createdAt;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_product_created ON marketing_customer_journey_map FIELDS productId, createdAt;
`;

const appliedClients = new WeakSet<IDbClient>();

export async function ensureMarketingSchema(db: IDbClient): Promise<void> {
  if (appliedClients.has(db)) return;
  await db.query(MARKETING_SCHEMA_QUERY);
  appliedClients.add(db);
}
