# Blender (headless) script: convert FBX files to binary glTF (.glb), keeping animations.
#   blender -b -P scripts/assets/fbx2glb.py -- in1.fbx out1.glb [in2.fbx out2.glb ...]
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
for src, dst in zip(args[0::2], args[1::2]):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=src)
        bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_yup=True)
        print('converted', src, '->', dst)
    except Exception as e:  # keep going with the other files
        print('FAILED', src, e)
