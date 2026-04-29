import type { Persona, Product, CreatePersonaDto, UpdatePersonaDto } from '../../shared/marketing/index.js';
import { GeneratePersonasForProductDtoSchema } from '../../shared/marketing/validation.js';
import type { IPersonaRepository, IProductRepository, IMarketingTextGenerationGateway } from './ports.js';

export class PersonaService {
  constructor(
    private readonly personas: IPersonaRepository,
    private readonly products: IProductRepository,
    private readonly ai: IMarketingTextGenerationGateway,
  ) {}

  async listByProduct(productId: string): Promise<Persona[]> {
    return this.personas.findByProductId(productId);
  }

  async get(id: string): Promise<Persona | null> {
    return this.personas.findById(id);
  }

  async create(dto: CreatePersonaDto): Promise<Persona> {
    const product = await this.products.findById(dto.productId);
    if (!product) throw new Error(`Product not found: ${dto.productId}`);
    return this.personas.create(dto);
  }

  async update(id: string, dto: UpdatePersonaDto): Promise<Persona> {
    return this.personas.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.personas.delete(id);
  }

  async generateForProduct(product: Product, count = 3): Promise<Persona[]> {
    const countValidation = GeneratePersonasForProductDtoSchema.safeParse({ count });
    if (!countValidation.success) {
      throw new Error('Persona generation count must be an integer between 1 and 20');
    }

    const partials = await this.ai.generatePersonas(product, countValidation.data.count);
    const dtos = partials.map((partial) => ({
      productId: product.id,
      name: partial.name ?? 'Generated Persona',
      ageRange: partial.ageRange ?? ('25-34' as const),
      gender: partial.gender ?? ('all' as const),
      occupation: partial.occupation,
      income: partial.income,
      interests: partial.interests ?? [],
      painPoints: partial.painPoints ?? [],
      motivations: partial.motivations ?? [],
      description: partial.description,
      avatarUrl: partial.avatarUrl,
    }));
    const created: Persona[] = [];
    try {
      for (const dto of dtos) {
        created.push(await this.personas.create(dto));
      }
    } catch (err) {
      // Saves happen one-by-one. Without DB transactions, rollback is best-effort and could still leave partial records if cleanup fails.
      await Promise.allSettled(created.map((p) => this.personas.delete(p.id)));
      throw new Error(
        `Persona generation failed after creating ${created.length}/${dtos.length} personas. All partial records rolled back. Cause: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return created;
  }
}

export function createPersonaService(
  repos: { personas: IPersonaRepository; products: IProductRepository },
  gateways: { ai: IMarketingTextGenerationGateway },
): PersonaService {
  return new PersonaService(repos.personas, repos.products, gateways.ai);
}
