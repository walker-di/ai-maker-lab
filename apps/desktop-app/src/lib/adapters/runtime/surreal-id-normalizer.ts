type IdLike = {
	id?: unknown;
	tb?: unknown;
	toString?: () => string;
};

export function normalizeId(value: unknown): string {
	if (typeof value === 'string') {
		const bracketed = value.match(/^[^:]+:⟨(.+)⟩$/);
		if (bracketed) return bracketed[1];
		const plain = value.match(/^[^:]+:(.+)$/);
		return plain?.[1] ?? value;
	}

	if (typeof value === 'object' && value !== null) {
		const recordId = value as IdLike;
		if (typeof recordId.id !== 'undefined') return normalizeId(recordId.id);
		if (typeof recordId.toString === 'function') {
			const stringValue = recordId.toString();
			const match = stringValue.match(/^[^:]+:⟨(.+)⟩$/);
			return match?.[1] ?? stringValue;
		}
	}

	return String(value);
}

export function normalizeRecord<T extends { id: string }>(record: T): T {
	return { ...record, id: normalizeId(record.id) };
}

export function normalizeList<T extends { id: string }>(items: readonly T[]): T[] {
	return items.map(normalizeRecord);
}
