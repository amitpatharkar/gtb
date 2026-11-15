# Builds people for the game from a population file, inside Blender with the MakeHuman
# plugin (MPFB 2). Run by scripts/people/build-people.mjs:
#
#   blender --background --python person.py -- <population.json> <out dir> [id ...]
#
# For each person: a MakeHuman body from the macro sliders (gender, age, weight, muscle,
# height, proportions, ancestry mix) plus face-detail targets, searched to the person's real
# height; the 53-bone game skeleton (+ two eye bones); eyes, eyebrows, eyelashes, teeth, hair,
# facial hair and clothes fitted to that body; ARKit-style face shapes kept as a few
# expression morphs (blink, smile, frown, anger, surprise, talking mouth); helper geometry and
# skin hidden under clothes removed. Writes <id>.glb (one mesh per part, no materials) and
# <id>.json (each part's role, texture files, licence and author) for the Node side, which
# builds the texture atlas, merges the parts into one skinned mesh and makes the levels of detail.
import bpy, bmesh, json, os, sys, math, re, time
import numpy as np
from mathutils import Vector

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.assetservice import AssetService

# Output morph → ARKit face units summed into it (left + right merged where the game only needs both).
MORPHS = {
    'blinkL': ['eyeBlinkLeft'], 'blinkR': ['eyeBlinkRight'],
    'squint': ['eyeSquintLeft', 'eyeSquintRight'], 'wide': ['eyeWideLeft', 'eyeWideRight'],
    'browDown': ['browDownLeft', 'browDownRight'], 'browInnerUp': ['browInnerUp'],
    'browUp': ['browOuterUpLeft', 'browOuterUpRight'],
    'jawOpen': ['jawOpen'], 'smile': ['mouthSmileLeft', 'mouthSmileRight'],
    'frown': ['mouthFrownLeft', 'mouthFrownRight'], 'pucker': ['mouthPucker'], 'funnel': ['mouthFunnel'],
    'sneer': ['noseSneerLeft', 'noseSneerRight'], 'stretch': ['mouthStretchLeft', 'mouthStretchRight'],
}
FACE_KEYS = {k for v in MORPHS.values() for k in v}


def log(*a):
    print('[people]', *a, flush=True)


def asset_path(subdir, name):
    """'short02' → absolute path of hair/short02/short02.mhclo (or a skin's .mhmat)."""
    ext = '.mhmat' if subdir == 'skins' else '.mhclo'
    rel = name if name.endswith(ext) else f'{name}/{name}{ext}'
    p = AssetService.find_asset_absolute_path(rel, asset_subdir=subdir)
    if not p and subdir == 'eyes':
        for rel2 in (f'materials/{name}.mhmat', f'materials/{name}/{name}.mhmat'):
            p = AssetService.find_asset_absolute_path(rel2, asset_subdir='eyes')
            if p:
                break
    if not p:
        raise FileNotFoundError(f'{subdir}/{rel}')
    return p


def read_keyvals(path):
    """Lines of 'key value…' from an .mhclo/.mhmat (stops at the vertex data of an mhclo)."""
    out = {}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if line == 'verts 0' or line.startswith('verts '):
                break
            k, _, v = line.partition(' ')
            out.setdefault(k, v.strip())
    return out


def material_info(mhmat):
    """Texture files and flags of a MakeHuman material."""
    kv = read_keyvals(mhmat)
    base = os.path.dirname(mhmat)
    def tex(key):
        v = kv.get(key)
        if not v:
            return None
        p = v if os.path.isabs(v) else os.path.normpath(os.path.join(base, v))
        if not os.path.exists(p):
            p2 = os.path.join(base, os.path.basename(v))
            p = p2 if os.path.exists(p2) else None
        return p
    col = [float(x) for x in kv.get('diffuseColor', '1 1 1').split()[:3]] if kv.get('diffuseColor') else [1, 1, 1]
    return {
        'diffuse': tex('diffuseTexture'), 'normal': tex('normalmapTexture'),
        'transparent': kv.get('transparent', 'false').lower() == 'true' or kv.get('alphaToCoverage', 'false').lower() == 'true',
        'color': col, 'mhmat': mhmat,
    }


def mhclo_material(mhclo):
    kv = read_keyvals(mhclo)
    m = kv.get('material')
    if not m:
        return None
    p = os.path.normpath(os.path.join(os.path.dirname(mhclo), m))
    return p if os.path.exists(p) else None


def body_height(bm):
    """Standing height (sole to crown) of the visible body in metres."""
    co = np.empty(len(bm.data.vertices) * 3, dtype=np.float32)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = bm.evaluated_get(dg)
    me = ev.to_mesh()
    me.vertices.foreach_get('co', co[:len(me.vertices) * 3])
    z = co[2::3][:len(me.vertices)]
    g = bm.vertex_groups.get('body')
    if g:
        idx = [v.index for v in bm.data.vertices if any(x.group == g.index and x.weight > 0 for x in v.groups)]
        z = z[idx]
    h = float(z.max() - z.min())
    ev.to_mesh_clear()
    return h


def phenotype(spec, height_macro):
    m = dict(gender=1.0 if spec['sex'] == 'm' else 0.0, age=0.5, muscle=0.5, weight=0.5,
             proportions=0.5, height=height_macro, cupsize=0.5, firmness=0.5)
    m.update({k: v for k, v in spec.get('macro', {}).items() if k != 'race'})
    m['height'] = height_macro
    race = spec.get('macro', {}).get('race', {'caucasian': 0.6, 'african': 0.22, 'asian': 0.18})
    s = sum(race.values()) or 1
    m['race'] = {k: race.get(k, 0) / s for k in ('caucasian', 'african', 'asian')}
    return m


def search_height(spec):
    """Height macro that gives the person's height in centimetres (secant search on the bare body)."""
    want = spec['heightCm'] / 100
    targets = [{'target': k, 'value': v} for k, v in spec.get('targets', {}).items()]
    def measure(x):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bm = HumanService.create_human(macro_detail_dict=phenotype(spec, x))
        if targets:
            from bl_ext.user_default.mpfb.services.targetservice import TargetService
            TargetService.bulk_load_targets(bm, targets)
        return body_height(bm)
    x0, x1 = 0.5, 0.7
    h0, h1 = measure(x0), measure(x1)
    for _ in range(6):
        if abs(h1 - want) < 0.004 or h1 == h0:
            break
        x2 = min(1.0, max(0.0, x1 + (want - h1) * (x1 - x0) / (h1 - h0)))
        x0, h0, x1 = x1, h1, x2
        h1 = measure(x1)
    return x1, h1


def bake_keys(o, is_body):
    """Shape keys → modelling baked into the mesh, face units kept as the game's morphs."""
    me = o.data
    if not me.shape_keys:
        return {}
    kb = me.shape_keys.key_blocks
    n = len(me.vertices)
    def arr(key):
        a = np.empty(n * 3, dtype=np.float32)
        key.data.foreach_get('co', a)
        return a
    basis = arr(kb[0])
    shaped = basis.copy()
    face = {}
    for k in kb[1:]:
        if k.name in FACE_KEYS:
            face[k.name] = arr(k) - basis
        elif not k.mute and k.value != 0:
            shaped += (arr(k) - arr(k.relative_key)) * k.value
    morphs = {}
    for out, srcs in MORPHS.items():
        d = None
        for s in srcs:
            if s in face:
                d = face[s] if d is None else d + face[s]
        if d is not None and np.abs(d).max() > 1e-5:
            morphs[out] = d
    o.shape_key_clear()
    me.vertices.foreach_set('co', shaped)
    me.update()
    if morphs:
        o.shape_key_add(name='Basis', from_mix=False)
        for name, d in morphs.items():
            k = o.shape_key_add(name=name, from_mix=False)
            k.data.foreach_set('co', shaped + d)
    return morphs


def delete_hidden(bm):
    """Remove helper geometry and the skin under clothes (the MASK modifiers' groups)."""
    keep_g = bm.vertex_groups.get('body')
    del_g = [g.index for g in bm.vertex_groups if g.name.startswith('Delete.')]
    drop = set()
    for v in bm.data.vertices:
        w = {x.group: x.weight for x in v.groups}
        if keep_g is not None and w.get(keep_g.index, 0) <= 0:
            drop.add(v.index)
        elif any(w.get(g, 0) > 0 for g in del_g):
            drop.add(v.index)
    b = bmesh.new()
    b.from_mesh(bm.data)
    b.verts.ensure_lookup_table()
    bmesh.ops.delete(b, geom=[b.verts[i] for i in drop], context='VERTS')
    b.to_mesh(bm.data)
    b.free()
    for m in list(bm.modifiers):
        if m.type == 'MASK':
            bm.modifiers.remove(m)
    return len(drop)


def add_eye_bones(rig, eyes):
    """Two eye bones under the head; the eye mesh's halves weighted to them (gaze in the game)."""
    co = np.array([v.co[:] for v in eyes.data.vertices])
    left = co[:, 0] > 0
    centres = {'eye_l': co[left].mean(0), 'eye_r': co[~left].mean(0)}
    radius = float((co[left][:, 1].max() - co[left][:, 1].min()) / 2)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for name, c in centres.items():
        b = eb.new(name)
        b.head = Vector(c)
        b.tail = Vector(c) + Vector((0, -max(radius, 0.01), 0))   # looks along -Y (the body's front)
        b.parent = eb['head']
        b.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for g in list(eyes.vertex_groups):
        eyes.vertex_groups.remove(g)
    gl, gr = eyes.vertex_groups.new(name='eye_l'), eyes.vertex_groups.new(name='eye_r')
    gl.add([i for i in range(len(co)) if left[i]], 1.0, 'REPLACE')
    gr.add([i for i in range(len(co)) if not left[i]], 1.0, 'REPLACE')
    return {k: [float(x) for x in v] for k, v in centres.items()}


def build(spec, out_dir):
    t0 = time.time()
    hm, h = search_height(spec)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    info = HumanService._create_default_human_info_dict()
    info['phenotype'] = phenotype(spec, hm)
    info['targets'] = [{'target': k, 'value': v} for k, v in spec.get('targets', {}).items()]
    info['rig'] = 'game_engine'
    parts = {'eyes': 'low-poly', 'eyebrows': spec.get('eyebrows', 'eyebrow001'), 'eyelashes': spec.get('eyelashes', 'eyelashes01'),
             'teeth': 'teeth_base', 'hair': spec.get('hair') or ''}
    for k, v in parts.items():
        info[k] = f'{v}/{v}.mhclo' if v else ''
    info['clothes'] = [f'{c[1]}/{c[1]}.mhclo' for c in spec.get('clothes', [])]
    info['skin_mhmat'] = ''           # textures are set by the game (atlas + tone), not Blender materials
    info['skin_material_type'] = 'NONE'
    st = HumanService.get_default_deserialization_settings()
    st['subdiv_levels'] = 0
    bm = HumanService.deserialize_from_dict(info, st)
    FaceService.load_targets(bm, load_microsoft_visemes=False, load_meta_visemes=False, load_arkit_faceunits=True)
    FaceService.interpolate_targets(bm)
    rig = bm.parent

    # Which object is which part.
    role_of = {c[1]: c[0] for c in spec.get('clothes', [])}
    meta = {'id': spec['id'], 'heightCm': round(h * 100, 1), 'heightMacro': hm, 'parts': []}
    deleted = delete_hidden(bm)
    for o in [x for x in bpy.data.objects if x.type == 'MESH']:
        is_body = o is bm
        src = '' if is_body else str(o.get('MPFB_GEN_asset_source', ''))
        kind = 'body' if is_body else str(o.get('MPFB_GEN_object_type', 'Clothes')).lower()
        asset = src.split('/')[0] if src else ''
        role = 'skin' if is_body else role_of.get(asset, kind)
        if kind == 'tongue':
            bpy.data.objects.remove(o)
            continue
        morphs = bake_keys(o, is_body)
        if is_body:
            mat = material_info(asset_path('skins', spec.get('skin', 'young_caucasian_male')))
        else:
            mhclo = asset_path(kind if kind in ('eyes', 'eyebrows', 'eyelashes', 'teeth', 'hair') else 'clothes', asset)
            mm = asset_path('eyes', spec.get('eyeColor', 'brown')) if kind == 'eyes' else mhclo_material(mhclo)
            mat = material_info(mm) if mm else {'diffuse': None, 'normal': None, 'transparent': False, 'color': [0.5, 0.5, 0.5]}
        part = {
            'name': o.name, 'kind': kind, 'role': role, 'asset': asset or 'body',
            'license': {0: 'AGPL', 1: 'CC0', 2: 'CC-BY'}.get(o.get('MPFB_MC_license', 1), 'CC0') if not is_body else 'CC0',
            'author': str(o.get('MPFB_MC_author', '')) if not is_body else 'MakeHuman team',
            'morphs': sorted(morphs.keys()), 'verts': len(o.data.vertices), **mat,
        }
        o.name = f"{role}__{asset or 'body'}"
        o['gtb_role'] = role
        meta['parts'].append(part)
    eyes = next((o for o in bpy.data.objects if o.type == 'MESH' and o.get('gtb_role') == 'eyes'), None)
    if eyes:
        meta['eyes'] = add_eye_bones(rig, eyes)
    # Skeleton facts the game needs (rest pose, metres, Blender Z-up).
    meta['bones'] = {b.name: {'head': [round(x, 4) for x in b.head_local], 'tail': [round(x, 4) for x in b.tail_local],
                              'parent': b.parent.name if b.parent else None} for b in rig.data.bones}
    meta['deletedVerts'] = deleted

    path = os.path.join(out_dir, f"{spec['id']}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_skins=True,
                              export_morph=True, export_morph_normal=False, export_animations=False,
                              export_materials='NONE', export_extras=True, export_yup=True, export_apply=False,
                              export_texcoords=True, export_normals=True, export_try_sparse_sk=False,
                              export_def_bones=False, export_rest_position_armature=True)
    with open(os.path.join(out_dir, f"{spec['id']}.json"), 'w') as f:
        json.dump(meta, f, indent=1)
    log(spec['id'], f'{h * 100:.1f} cm', f'{time.time() - t0:.1f} s', ', '.join(f"{p['role']}:{p['verts']}" for p in meta['parts']))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    pop_file, out_dir, only = argv[0], argv[1], set(argv[2:])
    os.makedirs(out_dir, exist_ok=True)
    with open(pop_file) as f:
        pop = json.load(f)
    for spec in pop['people']:
        if only and spec['id'] not in only:
            continue
        try:
            build(spec, out_dir)
        except Exception as e:
            import traceback
            traceback.print_exc()
            log('FAILED', spec['id'], e)
            sys.exit(1)


if __name__ == '__main__':
    main()
