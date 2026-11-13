# Blender (headless) script: convert FBX files to binary glTF (.glb), keeping animations.
#   blender -b --factory-startup -P scripts/assets/fbx2glb.py -- in1.fbx out1.glb [in2.fbx out2.glb ...]
# Prints one line per file ("converted …" or "FAILED …") so the pipeline can log the result.
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
        bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)
        bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_yup=True, export_apply=False)
        print('converted', src, '->', dst, flush=True)
    except Exception as e:  # noqa: BLE001 — keep going with the other files
        print('FAILED', src, repr(e), flush=True)
        traceback.print_exc()
