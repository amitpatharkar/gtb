// Rapier physics: one world, a fixed 60 Hz step, collision groups and a few query helpers.
// Physics is the single source of truth for what is solid: the map tiles, cars, props and the
// player all live here, and the renderer only copies their poses.
import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };
export const STEP = 1 / 60;

// Collision groups (16-bit membership << 16 | 16-bit filter).
export const GROUP = { WORLD: 1, PLAYER: 2, VEHICLE: 4, PROP: 8, PED: 16, CAMERA_IGNORE: 32 };
export const groups = (member, filter = 0xffff) => ((member & 0xffff) << 16) | (filter & 0xffff);

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  // A safety floor under everything (sea bed): nothing falls forever.
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -8, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(50000, 1, 50000).setCollisionGroups(groups(GROUP.WORLD)), floor);

  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  return {
    RAPIER,
    world,
    /** First hit along a ray: { toi, point, normal, collider } or null. exclude: a rigid body to ignore. */
    cast(ox, oy, oz, dx, dy, dz, maxToi, filterGroups, excludeBody) {
      ray.origin.x = ox; ray.origin.y = oy; ray.origin.z = oz;
      ray.dir.x = dx; ray.dir.y = dy; ray.dir.z = dz;
      const hit = world.castRayAndGetNormal(ray, maxToi, true, undefined, filterGroups, undefined, excludeBody);
      if (!hit) return null;
      const t = hit.timeOfImpact;
      return { toi: t, point: { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t }, normal: hit.normal, collider: hit.collider };
    },
    /** Ground height under (x, z), searching down from y (or null). */
    groundAt(x, z, y = 200, maxDrop = 400) {
      const h = this.cast(x, y, z, 0, -1, 0, maxDrop, groups(0xffff, GROUP.WORLD));
      return h ? h.point.y : null;
    },
  };
}
