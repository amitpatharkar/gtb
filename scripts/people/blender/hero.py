# The main character: an owner-chosen rigged model (data/people/*.glb, CC BY 4.0) made ready
# for the game, inside Blender. Run by scripts/people/build-hero.mjs:
#
#   blender --background --python hero.py -- <source.glb> <out dir>
#
# - Sketchfab's wrapper nodes and scale are removed: the man stands at his own height in
#   metres, feet on the ground, facing -Y (glTF +Z) like every other person in the game.
# - Bones are renamed to the game skeleton's names (Mixamo-style Hips/Spine/LeftArm… →
#   pelvis/spine_01/upperarm_l…), so the game's animation clips, head look-at, eye gaze and
#   the pichkari hand all find them; extra neck and forearm twist bones keep their own names.
# - Three copies by graphics level: high = the model exactly as uploaded (every triangle,
#   original 1K textures), medium = about 60 % of the triangles, low = about 35 % and 512 px
#   textures. The bundled Sketchfab animation is dropped (the game retargets its own).
import bpy, json, os, re, sys

SIDE = {'Shoulder': 'clavicle', 'Arm': 'upperarm', 'ForeArm': 'lowerarm', 'ForeArm1': 'lowerarm_twist_01',
        'ForeArm2': 'lowerarm_twist_02', 'Hand': 'hand', 'UpLeg': 'thigh', 'Leg': 'calf', 'Foot': 'foot',
        'ToeBase': 'ball', 'Toe_End': 'ball_end'}
FINGER = {'Thumb': 'thumb', 'Index': 'index', 'Middle': 'middle', 'Ring': 'ring', 'Pinky': 'pinky'}
MID = {'_rootJoint': 'Root', 'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03',
       'Neck': 'neck_01', 'Neck1': 'neck_02', 'Neck2': 'neck_03', 'Head': 'head', 'HeadTop_End': 'head_end',
       'LeftEye': 'eye_l', 'RightEye': 'eye_r'}


def game_name(name):
    base = re.sub(r'_\d+$', '', name)
    if base in MID:
        return MID[base]
    m = re.match(r'^(Left|Right)(.+)$', base)
    if not m:
        return base
    side = '_l' if m.group(1) == 'Left' else '_r'
    rest = m.group(2)
    if rest in SIDE:
        return SIDE[rest] + side
    f = re.match(r'^Hand(Thumb|Index|Middle|Ring|Pinky)(\d)$', rest)
    if f:
        return f"{FINGER[f.group(1)]}_0{f.group(2)}{side}"
    return base


def log(*a):
    print('[hero]', *a, flush=True)


def load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o not in meshes]:
        bpy.data.objects.remove(o)       # Sketchfab's stray icosphere and the like
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    arm.animation_data_clear()
    # Wrapper nodes and their scale go; everything keeps its world placement.
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm] + meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o)
    for o in meshes:
        o.parent = arm
        o.matrix_parent_inverse.identity()
        for m in o.modifiers:
            if m.type == 'ARMATURE':
                m.object = arm
    # Real size: the model was uploaded at 2× (Sketchfab wrapper); stand him at his own height.
    zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
    h = max(zs) - min(zs)
    return arm, meshes, h, min(zs)


def rescale(arm, meshes, k, floor):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm] + meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    for o in [arm] + meshes:
        o.parent = None
    for o in [arm] + meshes:
        o.location = (0, 0, -floor * k)
        o.scale = (k, k, k)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in meshes:
        o.parent = arm
        o.matrix_parent_inverse.identity()


def rename_bones(arm, meshes):
    renames = {b.name: game_name(b.name) for b in arm.data.bones}
    for o in meshes:
        for g in o.vertex_groups:
            if g.name in renames:
                g.name = renames[g.name]
    for b in arm.data.bones:
        b.name = renames[b.name]
    arm.name = 'Hero'
    return renames


def decimate(meshes, ratio):
    for o in meshes:
        if ratio >= 1 or len(o.data.polygons) < 400:
            continue
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new('decimate', 'DECIMATE')
        m.ratio = ratio
        m.use_collapse_triangulate = True
        bpy.ops.object.modifier_move_to_index(modifier=m.name, index=0)
        bpy.ops.object.modifier_apply(modifier=m.name)


def shrink_images(px):
    for img in bpy.data.images:
        if img.size[0] > px:
            img.scale(px, px)


def export(path, arm, meshes, image_format):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm] + meshes:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True,
                              export_morph=False, export_animations=False, export_materials='EXPORT',
                              export_image_format=image_format, export_jpeg_quality=90, export_yup=True,
                              export_apply=False, export_def_bones=False, export_rest_position_armature=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    src, out = argv[0], argv[1]
    os.makedirs(out, exist_ok=True)
    arm, meshes, h, floor = load(src)
    info = {'uploadedHeight': round(h, 3)}
    # Sketchfab exported him inside a node scaled 2.0073: back to his own size.
    k = 1 / 2.0073 if h > 2.4 else 1.0
    rescale(arm, meshes, k, floor)
    renames = rename_bones(arm, meshes)
    zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
    info.update(heightCm=round((max(zs) - min(zs)) * 100, 1), bones=sorted(set(renames.values())))
    tris = lambda: sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    info['triangles'] = {}
    export(os.path.join(out, 'hero-high.glb'), arm, meshes, 'AUTO')
    info['triangles']['high'] = tris()
    decimate(meshes, 0.6)
    export(os.path.join(out, 'hero-medium.glb'), arm, meshes, 'JPEG')
    info['triangles']['medium'] = tris()
    decimate(meshes, 0.58)
    shrink_images(512)
    export(os.path.join(out, 'hero-low.glb'), arm, meshes, 'JPEG')
    info['triangles']['low'] = tris()
    with open(os.path.join(out, 'hero.json'), 'w') as f:
        json.dump(info, f, indent=1)
    log(json.dumps({k: v for k, v in info.items() if k != 'bones'}))


if __name__ == '__main__':
    main()
