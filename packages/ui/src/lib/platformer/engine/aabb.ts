export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function makeAABB(x: number, y: number, width: number, height: number): AABB {
  return { x, y, width, height };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function aabbContainsPoint(a: AABB, x: number, y: number): boolean {
  return x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height;
}
