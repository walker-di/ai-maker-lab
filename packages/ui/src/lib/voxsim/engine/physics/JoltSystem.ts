/**
 * `JoltSystem` is the only physics facade the rest of the engine consumes.
 * It owns the Jolt runtime (`PhysicsSystem`, `BodyInterface`, temp allocator
 * via `JoltInterface`) and translates plain `BodySpec` / `ConstraintSpec`
 * records into Jolt classes.
 *
 * The renderer never imports this file directly; it imports `IPhysicsSystem`
 * via `../physics/types.js`. That keeps voxel rendering and the chunk mesh
 * builder free of any WASM dependency.
 */

import type { ArenaDefinition, Quat, Transform, Vec3 } from '../../types.js';
import { ChunkColliderBuilder } from './chunk-collider.js';
import { loadJolt, type JoltLoaderOptions, type JoltRuntime } from './jolt-loader.js';
import {
  cloneTransform,
  defaultPhysicsConfig,
  type BodyHandle,
  type BodySpec,
  type ConstraintHandle,
  type ConstraintSpec,
  type DebugLineSegment,
  type IPhysicsSystem,
  type MotorTarget,
  type OverlapHit,
  type PhysicsConfig,
  type PhysicsLayer,
  type PhysicsLayerFilter,
  type PhysicsSnapshot,
  type RayHit,
  type ShapeQuery,
  type ShapeSpec,
} from './types.js';

const LAYER_STATIC = 0;
const LAYER_DYNAMIC = 1;
const NUM_OBJECT_LAYERS = 2;
const NUM_BROADPHASE_LAYERS = 2;
const BROADPHASE_STATIC = 0;
const BROADPHASE_DYNAMIC = 1;

interface BodyEntry {
  handle: BodyHandle;
  bodyId: any; // Jolt BodyID
  layer: PhysicsLayer;
  spec: BodySpec;
  /**
   * The shape's COM offset (in shape-local space). We subtract this from
   * `body.GetPosition()` so callers see the position of the shape's local
   * origin, not Jolt's COM.
   */
  comOffset: { x: number; y: number; z: number };
  /** Latest world transform observed at the most recent `step()`. */
  latest: Transform;
  /** World transform observed at the previous `step()`; equal to `latest` until the second step. */
  previous: Transform;
}

interface ConstraintEntry {
  handle: ConstraintHandle;
  constraint: any; // Jolt TwoBodyConstraint
}

export class JoltSystem implements IPhysicsSystem {
  private runtime: JoltRuntime | null = null;
  private interface: any = null;
  private physicsSystem: any = null;
  private bodyInterface: any = null;
  private tempAllocator: any = null;
  private gravityVec: { x: number; y: number; z: number } = { x: 0, y: -9.81, z: 0 };

  private readonly bodies = new Map<number, BodyEntry>();
  private readonly constraints = new Map<number, ConstraintEntry>();
  /** Static body ids derived from arena chunks; tracked separately so arena teardown doesn't touch agent bodies. */
  private readonly chunkBodyIds = new Set<number>();

  private nextBodyId = 1;
  private nextConstraintId = 1;
  private stepIndex = 0;

  private loaderOptions: JoltLoaderOptions = {};

  constructor(loaderOptions: JoltLoaderOptions = {}) {
    this.loaderOptions = loaderOptions;
  }

  async init(config: PhysicsConfig): Promise<void> {
    if (this.physicsSystem) return;
    const merged = { ...defaultPhysicsConfig(config.gravity), ...config };
    this.gravityVec = { x: merged.gravity.x, y: merged.gravity.y, z: merged.gravity.z };

    if (config.wasmLocateFile) this.loaderOptions = { locateFile: config.wasmLocateFile };
    this.runtime = await loadJolt(this.loaderOptions);
    const { Jolt } = this.runtime;

    const settings = new Jolt.JoltSettings();
    settings.mMaxBodies = merged.maxBodies;
    settings.mMaxBodyPairs = merged.maxBodyPairs;
    settings.mMaxContactConstraints = merged.maxContactConstraints;
    settings.mMaxWorkerThreads = Math.max(0, merged.numThreads - 1);

    const broadPhaseLayer = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_BROADPHASE_LAYERS);
    broadPhaseLayer.MapObjectToBroadPhaseLayer(LAYER_STATIC, new Jolt.BroadPhaseLayer(BROADPHASE_STATIC));
    broadPhaseLayer.MapObjectToBroadPhaseLayer(LAYER_DYNAMIC, new Jolt.BroadPhaseLayer(BROADPHASE_DYNAMIC));

    const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
    objectFilter.EnableCollision(LAYER_STATIC, LAYER_DYNAMIC);
    objectFilter.EnableCollision(LAYER_DYNAMIC, LAYER_DYNAMIC);
    // static-static collisions stay disabled (the default).

    const objVsBp = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      broadPhaseLayer,
      NUM_BROADPHASE_LAYERS,
      objectFilter,
      NUM_OBJECT_LAYERS,
    );

    settings.mBroadPhaseLayerInterface = broadPhaseLayer;
    settings.mObjectLayerPairFilter = objectFilter;
    settings.mObjectVsBroadPhaseLayerFilter = objVsBp;

    this.interface = new Jolt.JoltInterface(settings);
    Jolt.destroy(settings);

    this.physicsSystem = this.interface.GetPhysicsSystem();
    this.bodyInterface = this.physicsSystem.GetBodyInterface();
    this.tempAllocator = this.interface.GetTempAllocator();

    this.physicsSystem.SetGravity(new Jolt.Vec3(this.gravityVec.x, this.gravityVec.y, this.gravityVec.z));
  }

  loadArenaColliders(arena: ArenaDefinition): void {
    if (!this.physicsSystem) {
      throw new Error('JoltSystem: init() must be awaited before loading arena colliders');
    }
    this.unloadArenaColliders();
    const builder = new ChunkColliderBuilder({ voxelSize: arena.voxelSize });
    for (const chunk of arena.chunks) {
      const result = builder.build(chunk);
      if (!result) continue;
      const handle = this.createBody({
        kind: 'static',
        layer: 'static',
        shape: result.shape,
        transform: {
          position: { x: result.worldOrigin.x, y: result.worldOrigin.y, z: result.worldOrigin.z },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
        userTag: `chunk:${chunk.id}`,
      });
      this.chunkBodyIds.add(handle.id);
    }
    this.physicsSystem?.OptimizeBroadPhase();
  }

  unloadArenaColliders(): void {
    for (const id of this.chunkBodyIds) {
      const entry = this.bodies.get(id);
      if (entry) this.removeBody(entry.handle);
    }
    this.chunkBodyIds.clear();
  }

  step(dtMs: number): void {
    if (!this.interface) {
      throw new Error('JoltSystem: init() must be awaited before stepping');
    }
    const dt = dtMs / 1000;
    this.interface.Step(dt, 1);
    this.stepIndex++;
    for (const entry of this.bodies.values()) {
      entry.previous = entry.latest;
      entry.latest = this.readBodyTransform(entry);
    }
  }

  snapshot(): PhysicsSnapshot {
    const bodies = Array.from(this.bodies.values()).map((entry) => ({
      handle: entry.handle,
      previous: cloneTransform(entry.previous),
      latest: cloneTransform(entry.latest),
    }));
    return { bodies, stepIndex: this.stepIndex };
  }

  dispose(): void {
    if (!this.runtime) return;
    const { Jolt } = this.runtime;
    for (const [, ce] of this.constraints) {
      this.physicsSystem.RemoveConstraint(ce.constraint);
    }
    this.constraints.clear();
    for (const entry of this.bodies.values()) {
      try {
        this.bodyInterface.RemoveBody(entry.bodyId);
        this.bodyInterface.DestroyBody(entry.bodyId);
      } catch {
        /* body already removed */
      }
    }
    this.bodies.clear();
    this.chunkBodyIds.clear();
    if (this.interface) Jolt.destroy(this.interface);
    this.interface = null;
    this.physicsSystem = null;
    this.bodyInterface = null;
    this.tempAllocator = null;
    this.runtime = null;
    this.nextBodyId = 1;
    this.nextConstraintId = 1;
    this.stepIndex = 0;
  }

  createBody(spec: BodySpec): BodyHandle {
    if (!this.runtime || !this.bodyInterface) {
      throw new Error('JoltSystem: init() must be awaited before createBody');
    }
    const { Jolt } = this.runtime;
    const layer: PhysicsLayer = spec.layer ?? (spec.kind === 'static' ? 'static' : 'dynamic');
    const objectLayer = layer === 'static' ? LAYER_STATIC : LAYER_DYNAMIC;
    const shape = this.buildShape(spec.shape);
    const motionType = spec.kind === 'static'
      ? Jolt.EMotionType_Static
      : spec.kind === 'kinematic'
        ? Jolt.EMotionType_Kinematic
        : Jolt.EMotionType_Dynamic;
    // Jolt places the body so that its COM lands at body.position. Compensate
    // by adding the shape's COM offset so the user-facing transform.position
    // means "world position of shape-local origin" — what the renderer wants.
    const comJ = shape.GetCenterOfMass();
    const com = { x: comJ.GetX(), y: comJ.GetY(), z: comJ.GetZ() };
    const settings = new Jolt.BodyCreationSettings(
      shape,
      new Jolt.RVec3(
        spec.transform.position.x + com.x,
        spec.transform.position.y + com.y,
        spec.transform.position.z + com.z,
      ),
      new Jolt.Quat(spec.transform.rotation.x, spec.transform.rotation.y, spec.transform.rotation.z, spec.transform.rotation.w),
      motionType,
      objectLayer,
    );
    if (spec.friction !== undefined) settings.mFriction = spec.friction;
    if (spec.restitution !== undefined) settings.mRestitution = spec.restitution;
    if (spec.linearDamping !== undefined) settings.mLinearDamping = spec.linearDamping;
    if (spec.angularDamping !== undefined) settings.mAngularDamping = spec.angularDamping;

    const bodyId = this.bodyInterface.CreateAndAddBody(settings, Jolt.EActivation_Activate);
    Jolt.destroy(settings);

    const id = this.nextBodyId++;
    const handle: BodyHandle = { id, layer, userTag: spec.userTag };
    const startTransform = cloneTransform(spec.transform);
    this.bodies.set(id, {
      handle,
      bodyId,
      layer,
      spec,
      comOffset: com,
      latest: startTransform,
      previous: cloneTransform(startTransform),
    });
    return handle;
  }

  removeBody(handle: BodyHandle): void {
    const entry = this.bodies.get(handle.id);
    if (!entry) return;
    try {
      this.bodyInterface.RemoveBody(entry.bodyId);
      this.bodyInterface.DestroyBody(entry.bodyId);
    } catch {
      /* tolerate double-remove */
    }
    this.bodies.delete(handle.id);
    this.chunkBodyIds.delete(handle.id);
  }

  addConstraint(spec: ConstraintSpec): ConstraintHandle {
    if (!this.runtime || !this.physicsSystem) {
      throw new Error('JoltSystem: init() must be awaited before addConstraint');
    }
    const { Jolt } = this.runtime;
    const bodyA = this.bodies.get(spec.bodyA.id);
    const bodyB = this.bodies.get(spec.bodyB.id);
    if (!bodyA || !bodyB) throw new Error('JoltSystem: constraint references unknown body handle');

    const ja = this.bodyInterface.GetTransformedShape ? null : null; // unused
    void ja;

    const settings = this.buildConstraintSettings(Jolt, spec);
    const constraint = this.bodyInterface.CreateConstraint(settings, bodyA.bodyId, bodyB.bodyId);
    Jolt.destroy(settings);
    this.physicsSystem.AddConstraint(constraint);

    const id = this.nextConstraintId++;
    const handle: ConstraintHandle = {
      id,
      kind: spec.kind,
      bodyA: spec.bodyA,
      bodyB: spec.bodyB,
    };
    this.constraints.set(id, { handle, constraint });
    return handle;
  }

  removeConstraint(handle: ConstraintHandle): void {
    const entry = this.constraints.get(handle.id);
    if (!entry) return;
    this.physicsSystem.RemoveConstraint(entry.constraint);
    this.constraints.delete(handle.id);
  }

  setMotorTarget(handle: ConstraintHandle, target: MotorTarget): void {
    const entry = this.constraints.get(handle.id);
    if (!entry || !this.runtime) return;
    const { Jolt } = this.runtime;
    const c = entry.constraint;
    switch (handle.kind) {
      case 'hinge':
        if (target.velocity !== undefined) {
          c.SetMotorState(Jolt.EMotorState_Velocity);
          c.SetTargetAngularVelocity(target.velocity);
        } else {
          c.SetMotorState(Jolt.EMotorState_Position);
          c.SetTargetAngle(target.value);
        }
        break;
      case 'slider':
        if (target.velocity !== undefined) {
          c.SetMotorState(Jolt.EMotorState_Velocity);
          c.SetTargetVelocity(target.velocity);
        } else {
          c.SetMotorState(Jolt.EMotorState_Position);
          c.SetTargetPosition(target.value);
        }
        break;
      case 'swingTwist':
      case 'sixDof':
      case 'fixed':
        // SwingTwist/SixDOF motor wiring is plan-03 territory; expose
        // targets as orientation later. Fixed has no motor.
        break;
    }
  }

  getBodyTransform(handle: BodyHandle): Transform {
    const entry = this.bodies.get(handle.id);
    if (!entry) throw new Error(`JoltSystem: unknown body handle ${handle.id}`);
    return cloneTransform(entry.latest);
  }

  setBodyTransform(handle: BodyHandle, transform: Transform): void {
    const entry = this.bodies.get(handle.id);
    if (!entry || !this.runtime) return;
    const { Jolt } = this.runtime;
    this.bodyInterface.SetPositionAndRotation(
      entry.bodyId,
      new Jolt.RVec3(
        transform.position.x + entry.comOffset.x,
        transform.position.y + entry.comOffset.y,
        transform.position.z + entry.comOffset.z,
      ),
      new Jolt.Quat(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
      Jolt.EActivation_Activate,
    );
    entry.latest = cloneTransform(transform);
    entry.previous = cloneTransform(transform);
  }

  getBodyLinearVelocity(handle: BodyHandle): Vec3 {
    const entry = this.bodies.get(handle.id);
    if (!entry || !this.runtime) return { x: 0, y: 0, z: 0 };
    if (entry.layer === 'static') return { x: 0, y: 0, z: 0 };
    const v = this.bodyInterface.GetLinearVelocity(entry.bodyId);
    return { x: v.GetX(), y: v.GetY(), z: v.GetZ() };
  }

  getBodyAngularVelocity(handle: BodyHandle): Vec3 {
    const entry = this.bodies.get(handle.id);
    if (!entry || !this.runtime) return { x: 0, y: 0, z: 0 };
    if (entry.layer === 'static') return { x: 0, y: 0, z: 0 };
    const v = this.bodyInterface.GetAngularVelocity(entry.bodyId);
    return { x: v.GetX(), y: v.GetY(), z: v.GetZ() };
  }

  applyImpulse(handle: BodyHandle, impulse: Vec3, at?: Vec3): void {
    const entry = this.bodies.get(handle.id);
    if (!entry || !this.runtime) return;
    const { Jolt } = this.runtime;
    const v = new Jolt.Vec3(impulse.x, impulse.y, impulse.z);
    if (at) {
      const p = new Jolt.RVec3(at.x, at.y, at.z);
      this.bodyInterface.AddImpulse(entry.bodyId, v, p);
    } else {
      this.bodyInterface.AddImpulse(entry.bodyId, v);
    }
  }

  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
    _filter?: PhysicsLayerFilter,
  ): RayHit | undefined {
    if (!this.runtime || !this.physicsSystem) return undefined;
    const { Jolt } = this.runtime;
    const ray = new Jolt.RRayCast(
      new Jolt.RVec3(origin.x, origin.y, origin.z),
      new Jolt.Vec3(direction.x * maxDistance, direction.y * maxDistance, direction.z * maxDistance),
    );
    const settings = new Jolt.RayCastSettings();
    const collector = new Jolt.CastRayClosestHitCollisionCollector();
    const broadPhaseFilter = new Jolt.BroadPhaseLayerFilter();
    const objectFilter = new Jolt.ObjectLayerFilter();
    const bodyFilter = new Jolt.BodyFilter();
    const shapeFilter = new Jolt.ShapeFilter();
    this.physicsSystem.GetNarrowPhaseQuery().CastRay(
      ray, settings, collector, broadPhaseFilter, objectFilter, bodyFilter, shapeFilter,
    );
    let result: RayHit | undefined;
    if (collector.HadHit()) {
      const hit = collector.mHit;
      const fraction = hit.mFraction;
      const point: Vec3 = {
        x: origin.x + direction.x * maxDistance * fraction,
        y: origin.y + direction.y * maxDistance * fraction,
        z: origin.z + direction.z * maxDistance * fraction,
      };
      const bodyId = hit.mBodyID;
      const idIndex = bodyId.GetIndexAndSequenceNumber();
      const entry = this.findEntryByJoltBodyIndex(idIndex);
      if (entry) {
        result = {
          bodyHandle: entry.handle,
          point,
          normal: { x: 0, y: 1, z: 0 },
          distance: maxDistance * fraction,
          userTag: entry.handle.userTag,
        };
      }
    }
    Jolt.destroy(ray);
    Jolt.destroy(settings);
    Jolt.destroy(collector);
    Jolt.destroy(broadPhaseFilter);
    Jolt.destroy(objectFilter);
    Jolt.destroy(bodyFilter);
    Jolt.destroy(shapeFilter);
    return result;
  }

  queryOverlap(query: ShapeQuery, _filter?: PhysicsLayerFilter): OverlapHit[] {
    if (!this.runtime || !this.physicsSystem) return [];
    const { Jolt } = this.runtime;
    const shape = this.buildShape(this.shapeQueryToSpec(query));
    const transform = ('center' in query)
      ? { position: query.center, rotation: { x: 0, y: 0, z: 0, w: 1 } }
      : query.transform;
    // Emscripten generates `s*` methods as instance methods that act as
    // factories. Call via the prototype to mirror the JoltPhysics.js examples.
    const protoStatics = (Jolt.RMat44.prototype as unknown) as {
      sRotationTranslation(rot: any, trans: any): any;
    };
    const rmat = protoStatics.sRotationTranslation(
      new Jolt.Quat(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
      new Jolt.RVec3(transform.position.x, transform.position.y, transform.position.z),
    );
    const baseOffset = new Jolt.RVec3(transform.position.x, transform.position.y, transform.position.z);
    const settings = new Jolt.CollideShapeSettings();
    const collector = new Jolt.CollideShapeAllHitCollisionCollector();
    const broadPhaseFilter = new Jolt.BroadPhaseLayerFilter();
    const objectFilter = new Jolt.ObjectLayerFilter();
    const bodyFilter = new Jolt.BodyFilter();
    const shapeFilter = new Jolt.ShapeFilter();
    this.physicsSystem.GetNarrowPhaseQuery().CollideShape(
      shape,
      new Jolt.Vec3(1, 1, 1),
      rmat,
      settings,
      baseOffset,
      collector,
      broadPhaseFilter,
      objectFilter,
      bodyFilter,
      shapeFilter,
    );
    const hits: OverlapHit[] = [];
    if (collector.HadHit()) {
      const arr = collector.mHits;
      const n = arr.size();
      for (let i = 0; i < n; i++) {
        const hit = arr.at(i);
        const bodyId = hit.mBodyID2;
        const idIndex = bodyId.GetIndexAndSequenceNumber();
        const entry = this.findEntryByJoltBodyIndex(idIndex);
        if (entry) {
          hits.push({ bodyHandle: entry.handle, userTag: entry.handle.userTag });
        }
      }
    }
    Jolt.destroy(rmat);
    Jolt.destroy(baseOffset);
    Jolt.destroy(settings);
    Jolt.destroy(collector);
    Jolt.destroy(broadPhaseFilter);
    Jolt.destroy(objectFilter);
    Jolt.destroy(bodyFilter);
    Jolt.destroy(shapeFilter);
    return hits;
  }

  getDebugLines(): DebugLineSegment[] {
    return [];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private shapeQueryToSpec(q: ShapeQuery): ShapeSpec {
    switch (q.kind) {
      case 'box': return { kind: 'box', halfExtents: q.halfExtents };
      case 'sphere': return { kind: 'sphere', radius: q.radius };
      case 'capsule': return { kind: 'capsule', halfHeight: q.halfHeight, radius: q.radius };
    }
  }

  private readBodyTransform(entry: BodyEntry): Transform {
    if (!this.runtime) return identityTransform();
    const { Jolt } = this.runtime;
    void Jolt;
    const pos = this.bodyInterface.GetPosition(entry.bodyId);
    const rot = this.bodyInterface.GetRotation(entry.bodyId);
    // Subtract the COM offset so the reported position matches the
    // position the caller passed to `createBody`. For a sphere/box the
    // COM is (0,0,0), so this is a no-op.
    return {
      position: {
        x: pos.GetX() - entry.comOffset.x,
        y: pos.GetY() - entry.comOffset.y,
        z: pos.GetZ() - entry.comOffset.z,
      },
      rotation: { x: rot.GetX(), y: rot.GetY(), z: rot.GetZ(), w: rot.GetW() },
    };
  }

  private findEntryByJoltBodyIndex(idIndex: number): BodyEntry | undefined {
    for (const entry of this.bodies.values()) {
      if (entry.bodyId.GetIndexAndSequenceNumber && entry.bodyId.GetIndexAndSequenceNumber() === idIndex) {
        return entry;
      }
    }
    return undefined;
  }

  private buildShape(spec: ShapeSpec): any {
    if (!this.runtime) throw new Error('JoltSystem: runtime not initialised');
    const { Jolt } = this.runtime;
    switch (spec.kind) {
      case 'box': {
        const settings = new Jolt.BoxShapeSettings(
          new Jolt.Vec3(spec.halfExtents.x, spec.halfExtents.y, spec.halfExtents.z),
        );
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(settings);
        return shape;
      }
      case 'sphere': {
        const settings = new Jolt.SphereShapeSettings(spec.radius);
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(settings);
        return shape;
      }
      case 'capsule': {
        const settings = new Jolt.CapsuleShapeSettings(spec.halfHeight, spec.radius);
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(settings);
        return shape;
      }
      case 'compound': {
        const settings = new Jolt.StaticCompoundShapeSettings();
        for (const child of spec.children) {
          const childShape = this.buildShape(child.shape);
          settings.AddShape(
            new Jolt.Vec3(child.transform.position.x, child.transform.position.y, child.transform.position.z),
            new Jolt.Quat(child.transform.rotation.x, child.transform.rotation.y, child.transform.rotation.z, child.transform.rotation.w),
            childShape,
            0,
          );
        }
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(settings);
        return shape;
      }
      case 'mesh': {
        const verts = new Jolt.VertexList();
        for (let i = 0; i < spec.vertices.length; i += 3) {
          const v = new Jolt.Float3(spec.vertices[i]!, spec.vertices[i + 1]!, spec.vertices[i + 2]!);
          verts.push_back(v);
          Jolt.destroy(v);
        }
        const tris = new Jolt.IndexedTriangleList();
        for (let i = 0; i < spec.indices.length; i += 3) {
          const tri = new Jolt.IndexedTriangle(spec.indices[i]!, spec.indices[i + 1]!, spec.indices[i + 2]!, 0);
          tris.push_back(tri);
          Jolt.destroy(tri);
        }
        const matList = new Jolt.PhysicsMaterialList();
        const settings = new Jolt.MeshShapeSettings(verts, tris, matList);
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(verts);
        Jolt.destroy(tris);
        Jolt.destroy(matList);
        Jolt.destroy(settings);
        return shape;
      }
      case 'heightField': {
        const samples = new Jolt.ArrayFloat();
        for (let i = 0; i < spec.samples.length; i++) samples.push_back(spec.samples[i]!);
        const settings = new Jolt.HeightFieldShapeSettings();
        settings.mSampleCount = spec.columns;
        settings.mScale = new Jolt.Vec3(spec.spacingXz, 1, spec.spacingXz);
        settings.mOffset = new Jolt.Vec3(0, 0, 0);
        settings.mHeightSamples = samples;
        const result = settings.Create();
        const shape = result.Get();
        Jolt.destroy(samples);
        Jolt.destroy(settings);
        return shape;
      }
    }
  }

  private buildConstraintSettings(Jolt: any, spec: ConstraintSpec): any {
    switch (spec.kind) {
      case 'fixed': {
        const s = new Jolt.FixedConstraintSettings();
        s.mAutoDetectPoint = true;
        return s;
      }
      case 'hinge': {
        const s = new Jolt.HingeConstraintSettings();
        s.mPoint1 = new Jolt.RVec3(spec.pivot.x, spec.pivot.y, spec.pivot.z);
        s.mPoint2 = new Jolt.RVec3(spec.pivot.x, spec.pivot.y, spec.pivot.z);
        s.mHingeAxis1 = new Jolt.Vec3(spec.axis.x, spec.axis.y, spec.axis.z);
        s.mHingeAxis2 = new Jolt.Vec3(spec.axis.x, spec.axis.y, spec.axis.z);
        // Choose any normal axis perpendicular to the hinge axis.
        const normal = perpendicular(spec.axis);
        s.mNormalAxis1 = new Jolt.Vec3(normal.x, normal.y, normal.z);
        s.mNormalAxis2 = new Jolt.Vec3(normal.x, normal.y, normal.z);
        s.mLimitsMin = spec.minAngle;
        s.mLimitsMax = spec.maxAngle;
        if (spec.motor) {
          const ms = s.mMotorSettings;
          ms.mMaxForceLimit = spec.motor.maxForce;
          ms.mMinForceLimit = -spec.motor.maxForce;
          ms.mMaxTorqueLimit = spec.motor.maxForce;
          ms.mMinTorqueLimit = -spec.motor.maxForce;
          if (spec.motor.springFrequency !== undefined) ms.mSpringSettings.mFrequency = spec.motor.springFrequency;
          if (spec.motor.springDamping !== undefined) ms.mSpringSettings.mDamping = spec.motor.springDamping;
        }
        return s;
      }
      case 'slider': {
        const s = new Jolt.SliderConstraintSettings();
        s.mAutoDetectPoint = true;
        s.mSliderAxis1 = new Jolt.Vec3(spec.axis.x, spec.axis.y, spec.axis.z);
        s.mSliderAxis2 = new Jolt.Vec3(spec.axis.x, spec.axis.y, spec.axis.z);
        const n = perpendicular(spec.axis);
        s.mNormalAxis1 = new Jolt.Vec3(n.x, n.y, n.z);
        s.mNormalAxis2 = new Jolt.Vec3(n.x, n.y, n.z);
        s.mLimitsMin = spec.minDistance;
        s.mLimitsMax = spec.maxDistance;
        if (spec.motor) {
          const ms = s.mMotorSettings;
          ms.mMaxForceLimit = spec.motor.maxForce;
          ms.mMinForceLimit = -spec.motor.maxForce;
        }
        return s;
      }
      case 'swingTwist': {
        const s = new Jolt.SwingTwistConstraintSettings();
        s.mPosition1 = new Jolt.RVec3(spec.position.x, spec.position.y, spec.position.z);
        s.mPosition2 = new Jolt.RVec3(spec.position.x, spec.position.y, spec.position.z);
        s.mTwistAxis1 = new Jolt.Vec3(spec.twistAxis.x, spec.twistAxis.y, spec.twistAxis.z);
        s.mTwistAxis2 = new Jolt.Vec3(spec.twistAxis.x, spec.twistAxis.y, spec.twistAxis.z);
        s.mPlaneAxis1 = new Jolt.Vec3(spec.planeAxis.x, spec.planeAxis.y, spec.planeAxis.z);
        s.mPlaneAxis2 = new Jolt.Vec3(spec.planeAxis.x, spec.planeAxis.y, spec.planeAxis.z);
        s.mNormalHalfConeAngle = spec.normalHalfConeAngle;
        s.mPlaneHalfConeAngle = spec.planeHalfConeAngle;
        s.mTwistMinAngle = spec.twistMinAngle;
        s.mTwistMaxAngle = spec.twistMaxAngle;
        return s;
      }
      case 'sixDof': {
        const s = new Jolt.SixDOFConstraintSettings();
        s.mPosition1 = new Jolt.RVec3(spec.position.x, spec.position.y, spec.position.z);
        s.mPosition2 = new Jolt.RVec3(spec.position.x, spec.position.y, spec.position.z);
        s.mAxisX1 = new Jolt.Vec3(spec.axisX.x, spec.axisX.y, spec.axisX.z);
        s.mAxisX2 = new Jolt.Vec3(spec.axisX.x, spec.axisX.y, spec.axisX.z);
        s.mAxisY1 = new Jolt.Vec3(spec.axisY.x, spec.axisY.y, spec.axisY.z);
        s.mAxisY2 = new Jolt.Vec3(spec.axisY.x, spec.axisY.y, spec.axisY.z);
        const T_X = Jolt.SixDOFConstraintSettings_EAxis_TranslationX;
        const T_Y = Jolt.SixDOFConstraintSettings_EAxis_TranslationY;
        const T_Z = Jolt.SixDOFConstraintSettings_EAxis_TranslationZ;
        const R_X = Jolt.SixDOFConstraintSettings_EAxis_RotationX;
        const R_Y = Jolt.SixDOFConstraintSettings_EAxis_RotationY;
        const R_Z = Jolt.SixDOFConstraintSettings_EAxis_RotationZ;
        s.SetLimitedAxis(T_X, spec.translationLimits.minX, spec.translationLimits.maxX);
        s.SetLimitedAxis(T_Y, spec.translationLimits.minY, spec.translationLimits.maxY);
        s.SetLimitedAxis(T_Z, spec.translationLimits.minZ, spec.translationLimits.maxZ);
        s.SetLimitedAxis(R_X, spec.rotationLimits.minX, spec.rotationLimits.maxX);
        s.SetLimitedAxis(R_Y, spec.rotationLimits.minY, spec.rotationLimits.maxY);
        s.SetLimitedAxis(R_Z, spec.rotationLimits.minZ, spec.rotationLimits.maxZ);
        return s;
      }
    }
  }
}

function perpendicular(axis: Vec3): Vec3 {
  const ax = Math.abs(axis.x), ay = Math.abs(axis.y), az = Math.abs(axis.z);
  // Pick the smallest component to cross with.
  let other: Vec3;
  if (ax <= ay && ax <= az) other = { x: 1, y: 0, z: 0 };
  else if (ay <= az) other = { x: 0, y: 1, z: 0 };
  else other = { x: 0, y: 0, z: 1 };
  // Cross axis × other.
  const cx = axis.y * other.z - axis.z * other.y;
  const cy = axis.z * other.x - axis.x * other.z;
  const cz = axis.x * other.y - axis.y * other.x;
  const len = Math.hypot(cx, cy, cz) || 1;
  return { x: cx / len, y: cy / len, z: cz / len };
}

function identityTransform(): Transform {
  const r: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  return { position: p, rotation: r };
}
