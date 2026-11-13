# Blender (headless) script: convert FBX files to binary glTF (.glb), keeping animations.
#   blender -b --factory-startup -P scripts/assets/fbx2glb.py -- in1.fbx out1.glb [in2.fbx out2.glb ...]
# Prints one line per file ("converted …" or "FAILED …") so the pipeline can log the result.
import os
import sys
import traceback
import addon_utils
import bpy

# Make sure the FBX importer and glTF exporter are switched on (they are bundled add-ons).
for mod in ('io_scene_fbx', 'io_scene_gltf2'):
    try:
        addon_utils.enable(mod, default_set=True, persistent=True)
    except Exception as e:  # noqa: BLE001
        print('ADDON', mod, 'could not be enabled:', e)
print('blender', bpy.app.version_string, 'fbx importer:', hasattr(bpy.ops.import_scene, 'fbx'), 'gltf exporter:', hasattr(bpy.ops.export_scene, 'gltf'))

args = sys.argv[sys.argv.index('--') + 1:]
for src, dst in zip(args[0::2], args[1::2]):
    try:
        # Start each file from an empty scene.
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials, bpy.data.images):
            for item in list(coll):
                coll.remove(item)
        try:
            bpy.ops.import_scene.fbx(filepath=src)
        except Exception:  # noqa: BLE001 — some packaged builds break the operator; call the importer directly
            from io_scene_fbx import import_fbx

            class Op:  # the importer only needs report()
                def report(self, kind, msg):
                    print('FBX', kind, msg)

            import_fbx.load(Op(), bpy.context, filepath=src)
        # FBX actions come in unlinked (and with an unset id_root), so the exporter would keep only
        # the active one. Put every action on its own NLA track and export the tracks.
        arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
        mode = 'ACTIONS'
        if arm and bpy.data.actions:
            arm.animation_data_create()
            for act in list(bpy.data.actions):
                try:
                    act.id_root = 'OBJECT'
                except Exception:  # noqa: BLE001
                    pass
                act.name = act.name.split('|')[-1]
                act.use_fake_user = True
                track = arm.animation_data.nla_tracks.new()
                track.name = act.name
                track.strips.new(act.name, int(act.frame_range[0]), act)
            arm.animation_data.action = None
            mode = 'NLA_TRACKS'
        try:
            bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_animation_mode=mode, export_yup=True, export_apply=False)
        except TypeError:  # older exporter without animation modes
            bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_yup=True, export_apply=False)
        print('animations', [a.name for a in bpy.data.actions], flush=True)
        print('converted', src, '->', dst, flush=True)
    except Exception as e:  # noqa: BLE001 — keep going with the other files
        print('FAILED', src, repr(e), flush=True)
        traceback.print_exc()
