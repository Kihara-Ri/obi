"""Blender-only structural study; never reads a ledger or writes collection data.

Run: blender --background --python build_jewel_study.py -- --output <directory>
Optional --textures points at disposable fixture PNGs named 0.png, 1.png, 3.png.
Geometry uses metres; dimensions below are nominal millimetres, not measurements.
"""
import argparse
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


def mm(values):
    return Vector(values) * .001


def material(name, color, roughness=.4, transmission=0, metallic=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Transmission Weight'].default_value = transmission
    node.inputs['IOR'].default_value = 1.59 if transmission else 1.46
    return result


def attach(obj, parent, mat):
    obj.data.materials.append(mat)
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix
    return obj


def bevel(obj, width=.15, segments=3):
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Injection edge radius', 'BEVEL')
    modifier.width = width * .001
    modifier.segments = segments
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    modifier = obj.modifiers.new('Weighted mould normals', 'WEIGHTED_NORMAL')
    modifier.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(name, size, location, mat, parent, radius=.15):
    bpy.ops.mesh.primitive_cube_add(size=1, location=mm(location))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = mm(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    attach(obj, parent, mat)
    if radius:
        bevel(obj, min(radius, min(size) * .4))
    return obj


def cylinder(name, radius, depth, location, mat, parent, axis='Z', vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius*.001,
                                      depth=depth*.001, location=mm(location))
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':
        obj.rotation_euler.x = math.pi/2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    attach(obj, parent, mat)
    return obj


def cut(target, cutter, operation='DIFFERENCE'):
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new('Real aperture', 'BOOLEAN')
    modifier.operation = operation
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def annulus(name, outer, inner, depth, location, mat, parent):
    obj = cylinder(name, outer, depth, location, mat, parent, vertices=128)
    bore = cylinder('Temporary central bore', inner, depth+2, location, mat, parent)
    cut(obj, bore)
    bevel(obj, .08, 2)
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Ring UV')
    for polygon in obj.data.polygons:
        if abs(polygon.normal.z) < .99:
            continue
        sign = 1 if polygon.normal.z > 0 else -1
        for loop in polygon.loop_indices:
            point = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (.5 + sign * point.x / (outer * .002), .5 + point.y / (outer * .002))
    return obj


def print_paper(obj, width, height, front=None, back=None):
    """Print the leaf's actual faces, rather than floating coplanar decals."""
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Print UV')
    for mat, sign in [(front,1),(back,-1)]:
        if mat is None:
            continue
        obj.data.materials.append(mat)
        index = len(obj.data.materials)-1
        for polygon in obj.data.polygons:
            if polygon.normal.z*sign < .99:
                continue
            polygon.material_index = index
            for loop_index in polygon.loop_indices:
                point = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (.5+sign*point.x/(width*.001),.5+point.y/(height*.001))


def empty(name, location=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = mm(location)
    if parent:
        obj.parent = parent
    return obj


def texture_material(name, filename, color):
    mat = material(name, color, .6)
    if filename and filename.is_file():
        image = bpy.data.images.load(str(filename))
        image.pack()
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return mat


def consolidate(parent):
    """One drawable per material/motion group, without merging the hinge hierarchy."""
    groups = {}
    for obj in list(parent.children):
        if obj.type == 'MESH' and not obj.keys():
            groups.setdefault(obj.active_material.name, []).append(obj)
    for name, objects in groups.items():
        if len(objects) < 2:
            continue
        if name == 'Polystyrene_Clear':
            # Adjacent walls form one optical volume. Joining intersecting
            # boxes without union would leave internal reflection surfaces.
            for obj in objects[1:]:
                cut(objects[0], obj, 'UNION')
            objects[0].name = parent.name + '__' + name
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = parent.name + '__' + name


def light(name, position, power, size, target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA', location=mm(position))
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = power
    obj.data.shape = 'RECTANGLE'
    obj.data.size = size*.001
    obj.data.size_y = size*.001*.38
    obj.rotation_euler = (mm(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def camera(position, target, scale):
    cam = bpy.context.scene.camera
    cam.location = mm(position)
    cam.rotation_euler = (mm(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale = scale*.001


def fit_camera(objects):
    bpy.context.view_layer.update()
    cam = bpy.context.scene.camera
    inverse = cam.matrix_world.inverted()
    points = [inverse @ (obj.matrix_world @ Vector(corner)) for obj in objects
              if obj.type == 'MESH' for corner in obj.bound_box]
    low_x,high_x = min(p.x for p in points),max(p.x for p in points)
    low_y,high_y = min(p.y for p in points),max(p.y for p in points)
    cam.location += cam.rotation_euler.to_quaternion() @ Vector(((low_x+high_x)/2,(low_y+high_y)/2,0))
    cam.data.ortho_scale = max(high_y-low_y,(high_x-low_x)*.75)*1.12


def build(args):
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    textures = Path(args.textures) if args.textures else None
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'MILLIMETERS'
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 1, 121
    root = empty('Jewel_Case_142x125x10_4')
    root['nominal_mm'] = [142,125,10.4]
    root['status'] = 'Structural study, not a measured collection copy'
    base = empty('Fixed_Base_And_Tray', parent=root)
    hinge = empty('Lid_Hinge_Y', (-68.5,0,2.35), parent=root)
    hinge['axis'] = 'Y'
    hinge['opening_degrees'] = 165
    clear = material('Polystyrene_Clear', (.96,.98,1), .055, .98)
    black = material('Tray_Graphite', (.004,.005,.007), .42)
    paper = material('Paper_Cut', (.82,.80,.73), .72)
    silver = material('Disc_Aluminium', (.68,.72,.75), .23, metallic=.92)
    hub = material('Disc_Hub', (.68,.72,.75), .16, .65)
    front = texture_material('Print_front', textures/'0.png' if textures else None, (.08,.22,.27))
    back = texture_material('Print_back', textures/'1.png' if textures else None, (.18,.14,.13))
    inside = texture_material('Print_insideLeft', textures/'3.png' if textures else None, (.13,.25,.20))

    # Fixed shell: a back sheet and four moulded walls; the cover is a separate part.
    box('Rear_shell', (142,125,.9), (0,0,-4.75), clear, base, .28)
    rear_card = box('Rear_card', (137,119,.16), (0,0,-4.20), paper, base, .03)
    print_paper(rear_card,137,119,back=back)
    for y in [-60.75,60.75]:
        wall = box('Base_wall', (141,.85,6.5), (0,y,-1.35), clear, base, 0)
        bore = cylinder('Hinge socket cutter', 1.26, 3, (-68.5,y,2.35), clear, base, 'Y')
        # The socket extends into a locally raised wall, not a floating end tab.
        collar = box('Hinge_socket', (4.8,.9,7.1), (-68.5,y,-.05), clear, base, 0)
        cut(wall, collar, 'UNION')
        cut(wall, bore)
        bevel(wall, .15)
        box('Nested_shell_lip', (129,.55,.8), (5.5,y,1.75), clear, base, .10)
    for x in [-70.5,70.5]:
        box('Base_spine_wall' if x < 0 else 'Base_latch_wall', (.8,121.5,6.0), (x,0,-1.55), clear, base)

    # The ribbed strip is part of the tray and stays fixed through the entire opening.
    tray = box('Disc_tray', (128,120.5,1.5), (6,0,-1.9), black, base, 0)
    well = cylinder('Disc well cutter', 60.1, 1.1, (7,0,-.95), black, base, vertices=128)
    cut(tray, well)
    for y in [-21,21]:
        notch = cylinder('Finger recess cutter', 6, 3, (66,y,-1.9), black, base, vertices=32)
        cut(tray, notch)
    bevel(tray, .14)
    # Subpixel ridges must be filtered in the web material rather than rasterised
    # as thirty thin boxes. Keep the moulded foundation and its bevel geometry.
    spine = box('Fixed_spine_foundation', (11.9,120,2), (-64,0,3.4), black, base, .22)
    spine['ribbedSpine'] = True
    spine['ribWidth_mm'], spine['ribPitch_mm'] = 11.9, .365
    spine['ribStart_mm'], spine['ribEnd_mm'] = .65, 11.315
    ribbed = material('Tray_Graphite_Ribbed', (.004,.005,.007), .48)
    spine.data.materials.append(ribbed)
    uv = spine.data.uv_layers.active or spine.data.uv_layers.new(name='Rib UV')
    for polygon in spine.data.polygons:
        if polygon.normal.z < .99:
            continue
        polygon.material_index = 1
        for loop_index in polygon.loop_indices:
            point = spine.data.vertices[spine.data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (.5+point.x/.0119, .5+point.y/.120)
    for y in [-58.8,58.8]:
        shoulder = box('Tray_retention_lip', (124,.9,2.2), (7,y,-.65), black, base, 0)
        clearance = cylinder('Shoulder disc clearance', 60.95, 5, (7,0,-.65), black, base, vertices=128)
        cut(shoulder, clearance)
        bevel(shoulder, .10)
    # The raised groove is anchored in the tray, and clipped to its rectangular
    # footprint. A full 121.6-mm ring would protrude through the 120.5-mm edges.
    rim = annulus('Disc_recess_ring', 60.8,60.2,1.1,(7,0,-1.05),black,base)
    footprint = box('Tray rim footprint', (128,120.5,4), (6,0,-1.05), black, base, 0)
    cut(rim, footprint, 'INTERSECT')
    annulus('CD_120mm', 60,17.5,1.2,(7,0,-.15),silver,base)
    annulus('Disc_translucent_hub', 17.5,7.5,1.2,(7,0,-.15),hub,base)
    for index in range(12):
        theta = index*math.tau/12
        finger = box('Retention_rosette_finger', (1.55,.7,1.55),
                     (7+6.65*math.cos(theta),6.65*math.sin(theta),.10),black,base,.13)
        finger.rotation_euler.z = theta

    # Clear cover starts after the fixed spine; its long ears reach the end sockets.
    box('Lid_clear_sheet', (128,124.2,.75), (6.1,0,4.80), clear, hinge, .28)
    for y in [-62.0,62.0]:
        box('Cover_ear_rail', (139.5,.85,3.45), (1,y,3.25), clear, hinge, .22)
        pin = cylinder('Pivot_pin_top' if y > 0 else 'Pivot_pin_bottom', 1.08,1.75,
                       (-68.5, math.copysign(61.15,y),2.35), clear, hinge, 'Y', vertices=48)
        bevel(pin, .07, 2)
    box('Cover_right_return', (.7,121.7,3.4), (69.65,0,3.0),clear,hinge,.15)
    booklet = box('Booklet_paper', (120,120,.38), (7,0,4.05),paper,hinge,.04)
    print_paper(booklet,120,120,front,inside)
    for x in [-48,61]:
        for y in [-60.4,60.4]:
            box('Booklet_capture_tab', (4.5,3.2,.5), (x,y,3.67),clear,hinge,.12)
    for y in [-19,19]:
        box('Cover_latch_nib', (.8,2.4,.7), (69.75,y,1.75),clear,hinge,.18)

    # Animation rotates around the line joining the actual pins. The fixed tray
    # has no animation track. End keys are reversible by a web AnimationMixer.
    hinge.rotation_euler.y = 0
    hinge.keyframe_insert(data_path='rotation_euler',frame=1)
    hinge.rotation_euler.y = -math.radians(165)
    hinge.keyframe_insert(data_path='rotation_euler',frame=121)
    hinge.animation_data.action.name = 'Open'
    for layer in hinge.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = 'LINEAR'
    scene.frame_set(1)

    # Preserve physical invariants before consolidating the static geometry.
    pins = [obj for obj in hinge.children if obj.name.startswith('Pivot_pin')]
    baseline = [obj.matrix_world.translation.copy() for obj in pins]
    fixed = base.matrix_world.copy()
    deviations = []
    for frame in [1,31,61,91,121]:
        scene.frame_set(frame)
        deviations.append(max((obj.matrix_world.translation-position).length for obj,position in zip(pins,baseline)))
        assert (base.matrix_world.translation-fixed.translation).length < 1e-10
    assert max(deviations) < 1e-8, deviations
    scene.frame_set(1)
    consolidate(base)
    consolidate(hinge)

    objects = [root,base,hinge,*base.children,*hinge.children]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(output/'jewel-case.glb'),export_format='GLB',
        use_selection=True, export_extras=True, export_animations=True,
        export_animation_mode='SCENE', export_frame_range=True)
    binary = (output/'jewel-case.glb').read_bytes()
    json_length = struct.unpack_from('<I',binary,12)[0]
    exported = json.loads(binary[20:20+json_length])
    targets = {(exported['nodes'][c['target']['node']]['name'],c['target']['path'])
               for clip in exported['animations'] for c in clip['channels']}
    assert targets == {('Lid_Hinge_Y','rotation')}, targets

    # Studio lighting is for native geometry inspection, excluded from the GLB.
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.028,.032,.039,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    light('Large softbox',(-90,-80,230),1,160)
    light('Edge strip',(160,40,150),.5,120)
    light('Back fill',(-180,120,110),.4,150)
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    scene.camera.name = 'Inspection_camera'
    scene.camera.data.type = 'ORTHO'
    scene.camera.data.clip_start = .001
    scene.camera.data.clip_end = 10
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.cycles.transmission_bounces = 8
    scene.render.resolution_x, scene.render.resolution_y = 1400,1050
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = -.5
    views = [
        ('closed',1,(160,-240,300),(0,0,0),195),
        ('half-open',61,(190,-290,330),(-35,0,30),250),
        ('open',121,(120,-270,340),(-72,0,12),325),
        ('hinge-detail',61,(-90,-190,120),(-68.5,-59,2.35),35),
    ]
    camera(views[0][2],views[0][3],views[0][4])
    scene.frame_set(1)
    fit_camera(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(output/'jewel-case.blend'))
    report = {'nominal_mm':[142,125,10.4],'hinge_mm':[-68.5,0,2.35],
        'pin_motion_metres':deviations,'mesh_nodes':len(base.children)+len(hinge.children),
        'glb_primitives':sum(len(mesh['primitives']) for mesh in exported['meshes']),
        'triangles':sum(exported['accessors'][p['indices']]['count']//3 for mesh in exported['meshes'] for p in mesh['primitives']),
        'scope':'One standard Jewel Case study; not installed in the ledger viewer.'}
    (output/'geometry-report.json').write_text(json.dumps(report,indent=2))
    if not args.no_render:
        for name,frame,position,target,scale in views:
            scene.frame_set(frame)
            camera(position,target,scale)
            if name != 'hinge-detail':
                fit_camera(objects)
            scene.render.filepath = str(output/(name+'.png'))
            bpy.ops.render.render(write_still=True)
            print('STUDY_RENDER',name,flush=True)
    print('STUDY_COMPLETE',json.dumps(report),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    parser.add_argument('--textures')
    parser.add_argument('--no-render',action='store_true')
    build(parser.parse_args(sys.argv[sys.argv.index('--')+1:]))
