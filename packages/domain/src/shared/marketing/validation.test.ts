import { describe, expect, test } from 'bun:test';
import {
  CreateProductDtoSchema,
  UpdateProductDtoSchema,
  CreatePersonaDtoSchema,
  UpdatePersonaDtoSchema,
  GeneratePersonasForProductDtoSchema,
} from './validation.js';

describe('CreateProductDtoSchema', () => {
  test('accepts valid product', () => {
    const result = CreateProductDtoSchema.safeParse({ name: 'Widget' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Widget');
      expect(result.data.features).toEqual([]);
      expect(result.data.benefits).toEqual([]);
    }
  });

  test('rejects empty name', () => {
    const result = CreateProductDtoSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  test('rejects whitespace-only name', () => {
    const result = CreateProductDtoSchema.safeParse({ name: '  ' });
    expect(result.success).toBe(false);
  });

  test('rejects missing name', () => {
    const result = CreateProductDtoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects invalid imageUrl', () => {
    const result = CreateProductDtoSchema.safeParse({ name: 'X', imageUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  test('accepts optional fields', () => {
    const result = CreateProductDtoSchema.safeParse({
      name: 'Widget',
      description: 'A great widget',
      targetAudience: 'Developers',
      features: ['fast', 'cheap'],
      benefits: ['saves time'],
      imageUrl: 'https://example.com/img.png',
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateProductDtoSchema', () => {
  test('accepts empty object (all fields optional)', () => {
    expect(UpdateProductDtoSchema.safeParse({}).success).toBe(true);
  });

  test('accepts partial update', () => {
    const result = UpdateProductDtoSchema.safeParse({ description: 'Updated' });
    expect(result.success).toBe(true);
  });
});

describe('CreatePersonaDtoSchema', () => {
  const valid = {
    productId: 'prod-1',
    name: 'Alice',
    ageRange: '25-34' as const,
    gender: 'female' as const,
  };

  test('accepts valid persona', () => {
    const result = CreatePersonaDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productId).toBe('prod-1');
      expect(result.data.interests).toEqual([]);
    }
  });

  test('rejects missing productId', () => {
    const { productId: _, ...rest } = valid;
    expect(CreatePersonaDtoSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects empty productId', () => {
    expect(CreatePersonaDtoSchema.safeParse({ ...valid, productId: '' }).success).toBe(false);
  });

  test('rejects missing name', () => {
    const { name: _, ...rest } = valid;
    expect(CreatePersonaDtoSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects invalid ageRange', () => {
    expect(CreatePersonaDtoSchema.safeParse({ ...valid, ageRange: '10-15' }).success).toBe(false);
  });

  test('rejects invalid gender', () => {
    expect(CreatePersonaDtoSchema.safeParse({ ...valid, gender: 'robot' }).success).toBe(false);
  });
});

describe('UpdatePersonaDtoSchema', () => {
  test('accepts empty object (all fields optional)', () => {
    expect(UpdatePersonaDtoSchema.safeParse({}).success).toBe(true);
  });
});

describe('GeneratePersonasForProductDtoSchema', () => {
  test('rejects count=0', () => {
    expect(GeneratePersonasForProductDtoSchema.safeParse({ count: 0 }).success).toBe(false);
  });

  test('accepts count=20', () => {
    expect(GeneratePersonasForProductDtoSchema.safeParse({ count: 20 }).success).toBe(true);
  });

  test('rejects count=21', () => {
    expect(GeneratePersonasForProductDtoSchema.safeParse({ count: 21 }).success).toBe(false);
  });
});
