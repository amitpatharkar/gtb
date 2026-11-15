# Motion for the game's people: free animation libraries retargeted onto the MakeHuman
# game skeleton, inside Blender. Run by scripts/people/build-anims.mjs:
#
#   blender --background --python retarget.py -- <clips.json> <out.glb>
#
# Sources (clips.json): Quaternius Universal Animation Library 1 and 2 (CC0). Both use one
# mannequin skeleton with Unreal-style bone names, the same names as MPFB's game skeleton.
#
# Method (world-space deltas, so differing rest poses and bone-axis conventions don't matter):
#   1. Calibrate: pose the target so each limb bone points where the source's rest bone points
#      (the source rests in a T-pose, MakeHuman in an A-pose). Trunk bones keep their rest.
#   2. Every frame, each source bone's rotation away from its rest, in world space, is applied
#      to the calibrated target bone: target = delta · calibrated rest. Hip movement is scaled
#      by the ratio of hip heights. Loops stay in place (no horizontal root motion).
# The result is keyed on the reference skeleton (an average adult) and exported with the
# skeleton's rest pose; the game plays the clips as deltas from rest, so every body (tall,
# short, heavy, child) keeps its own proportions.
import bpy, json, sys, math, os
from mathutils import Matrix, Vector, Quaternion

from bl_ext.user_default.mpfb.services.humanservice import HumanService

TRUNK = {'Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'}


def log(*a):
    print('[anims]', *a, flush=True)


def reference_rig():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    macro = {'gender': 0.5, 'age': 0.5, 'muscle': 0.5, 'weight': 0.5, 'proportions': 0.6, 'height': 0.45,
             'cupsize': 0.5, 'firmness': 0.5, 'race': {'caucasian': 0.6, 'african': 0.24, 'asian': 0.16}}
    bm = HumanService.create_human(macro_detail_dict=macro)
    HumanService.add_builtin_rig(bm, 'game_engine')
    rig = bm.parent
    bpy.data.objects.remove(bm)
    rig.name = 'Reference'
    return rig


def import_source(path):
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    if path.endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    for o in new:
        if o.type == 'MESH':
            bpy.data.objects.remove(o)
    return arm, [a for a in bpy.data.actions if a not in acts_before]


def rot3(m):
    return m.to_3x3().normalized()


def rot_between(a, b):
    a, b = a.normalized(), b.normalized()
    return a.rotation_difference(b).to_matrix()


def calibrate(src, tgt, mapping):
    """World rest rotation of each target bone posed to match the source's rest directions."""
    sw, tw = src.matrix_world, tgt.matrix_world
    cal, carried = {}, {}
    for b in tgt.data.bones:   # parents come before children
        rest = rot3(tw @ b.matrix_local)
        G = carried.get(b.parent.name, Matrix.Identity(3)) if b.parent else Matrix.Identity(3)
        r = G @ rest
        s = mapping.get(b.name)
        if s and b.name not in TRUNK and s in src.data.bones:
            sb = src.data.bones[s]
            sdir = (sw @ sb.tail_local) - (sw @ sb.head_local)
            tdir = G @ ((tw @ b.tail_local) - (tw @ b.head_local))
            r = rot_between(tdir, sdir) @ r
        cal[b.name] = r
        carried[b.name] = r @ rest.inverted()
    return cal


def retarget(src, tgt, action, mapping, cal, name, opts, fps):
    src.animation_data_create()
    src.animation_data.action = action
    f0, f1 = (int(round(x)) for x in action.frame_range)
    src_fps = opts.get('fps', fps)
    duration = (f1 - f0) / src_fps
    n = max(2, int(round(duration * 30)) + 1)                 # resample at 30 frames per second
    sw, tw = src.matrix_world, tgt.matrix_world
    s_rest = {b.name: sw @ b.matrix_local for b in src.data.bones}
    t_rest = {b.name: tw @ b.matrix_local for b in tgt.data.bones}
    s_pelvis_h = s_rest['pelvis'].translation.z
    t_pelvis_h = t_rest['pelvis'].translation.z
    k = t_pelvis_h / s_pelvis_h
    in_place = opts.get('inPlace', True)

    act = bpy.data.actions.new(name)
    tgt.animation_data_create()
    tgt.animation_data.action = act
    scene = bpy.context.scene
    start = None
    for i in range(n):
        t = i / 30
        frame = f0 + t * src_fps
        scene.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))
        pose_w = {}
        for b in tgt.data.bones:
            s = mapping.get(b.name)
            if s and s in src.pose.bones:
                ps = sw @ src.pose.bones[s].matrix
                delta = rot3(ps) @ rot3(s_rest[s]).inverted()
                r = delta @ cal[b.name]
            else:
                parent = b.parent.name if b.parent else None
                r = (rot3(pose_w[parent]) @ rot3(t_rest[parent]).inverted() @ rot3(t_rest[b.name])) if parent else rot3(t_rest[b.name])
            # Position: from the parent's pose and the rest offset; the pelvis from the source.
            if b.name == 'pelvis' and s:
                sp = (sw @ src.pose.bones[s].matrix).translation
                rp = s_rest[s].translation
                off = (sp - rp) * k
                if start is None:
                    start = off.copy()
                if in_place:
                    off.x -= start.x
                    off.y -= start.y
                pos = t_rest['pelvis'].translation + off
            elif b.parent:
                pm = pose_w[b.parent.name]
                local_rest = t_rest[b.parent.name].inverted() @ t_rest[b.name]
                pos = (pm @ local_rest).translation
            else:
                pos = t_rest[b.name].translation
            m = r.to_4x4()
            m.translation = pos
            pose_w[b.name] = m
        # Pose matrices → per-bone basis (relative to rest and parent).
        for b in tgt.data.bones:
            pb = tgt.pose.bones[b.name]
            if b.parent:
                rest_rel = t_rest[b.parent.name].inverted() @ t_rest[b.name]
                basis = rest_rel.inverted() @ pose_w[b.parent.name].inverted() @ pose_w[b.name]
            else:
                basis = t_rest[b.name].inverted() @ pose_w[b.name]
            pb.rotation_mode = 'QUATERNION'
            q = basis.to_quaternion()
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=i + 1, group=b.name)
            if b.name == 'pelvis':
                pb.location = basis.translation
                pb.keyframe_insert('location', frame=i + 1, group=b.name)
    act.use_fake_user = True
    log(name, f'{duration:.2f} s', n, 'frames')
    return act


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    clips_file, out = argv[0], argv[1]
    with open(clips_file) as f:
        spec = json.load(f)
    tgt = reference_rig()
    for b in tgt.pose.bones:
        b.rotation_mode = 'QUATERNION'
    made = []
    for source in spec['sources']:
        src, actions = import_source(source['file'])
        src_fps = bpy.context.scene.render.fps          # importers map seconds to frames at this rate
        mapping = {}
        for b in tgt.data.bones:
            m = next((s.name for s in src.data.bones if s.name.lower() == b.name.lower()), None)
            if m:
                mapping[b.name] = m
        log(os.path.basename(source['file']), 'maps', len(mapping), 'of', len(tgt.data.bones), 'bones')
        # Rest pose of the source (no action) for calibration.
        src.animation_data_create()
        src.animation_data.action = None
        for pb in src.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        cal = calibrate(src, tgt, mapping)
        by_name = {}
        for a in actions:
            short = a.name.split('|')[-1]
            short = short[:-len('_Armature')] if short.endswith('_Armature') else short
            by_name[short] = a
        for clip in source['clips']:
            a = by_name.get(clip['from'])
            if not a:
                log('MISSING', clip['from'])
                continue
            made.append(retarget(src, tgt, a, mapping, cal, clip['name'], {**source.get('opts', {}), **clip}, src_fps))
        bpy.data.objects.remove(src)
    # Every clip as its own glTF animation.
    tgt.animation_data.action = None
    for pb in tgt.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    tr = tgt.animation_data.nla_tracks
    for a in made:
        track = tr.new()
        track.name = a.name
        track.strips.new(a.name, 1, a)
        track.mute = True
    bpy.context.scene.render.fps = 30
    bpy.ops.object.select_all(action='DESELECT')
    tgt.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True,
                              export_optimize_animation_size=True, export_def_bones=False, export_skins=True,
                              export_rest_position_armature=True, export_anim_single_armature=True, export_yup=True)
    log('wrote', out, len(made), 'clips')


if __name__ == '__main__':
    main()
