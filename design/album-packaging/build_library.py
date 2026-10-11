"""Author the shared, texture-free packaging library in Blender.

blender --background --python build_library.py -- --output static/models/packaging
Optional --blend-output saves editable sources outside the deployable library.
All dimensions are nominal millimetres. No ledger, photographs or data/ access.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
from types import SimpleNamespace

import bpy
from mathutils import Vector

spec = importlib.util.spec_from_file_location('jewel_tools', Path(__file__).with_name('build_jewel_study.py'))
j = importlib.util.module_from_spec(spec)
spec.loader.exec_module(j)


def local_box(name, size, position, mat, parent, radius=.08):
    obj = j.box(name, size, (0, 0, 0), mat, parent, radius)
    obj.matrix_parent_inverse.identity()
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    obj.location = j.mm(position)
    return obj


def local_cylinder(name, radius, depth, position, mat, parent):
    obj = j.cylinder(name, radius, depth, (0, 0, 0), mat, parent)
    obj.matrix_parent_inverse.identity()
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    obj.location = j.mm(position)
    return obj


def linear_keys(obj):
    data = obj.animation_data
    if not data or not data.action:
        return
    for layer in data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = 'LINEAR'


def group(name, parent, **extras):
    result = j.empty(name, parent=parent)
    for key, value in extras.items():
        result[key] = value
    return result


def reset(name, dimensions):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 121, 30
    scene.unit_settings.system = 'METRIC'
    root = j.empty(name)
    root['nominal_mm'] = dimensions
    root['reference'] = 'Nominal template, not a measured collection copy'
    return root


def stock():
    return {
        'paper': j.material('Paper_Cut', (.72, .69, .61), .8),
        'wrap': j.material('Paper_Wrap', (.38, .37, .34), .67),
        'clear': j.material('Tray_Clear', (.96, .98, 1), .12, .94),
        'tray': j.material('Tray_Graphite', (.004, .005, .007), .42),
        'silver': j.material('Disc_Aluminium', (.68, .72, .75), .23, metallic=.92),
        **{role: j.material('Print_' + role, (.35, .36, .37), .65)
           for role in ['front', 'back', 'spine', 'insideSpine', 'insideLeft', 'insideRight', 'insideCenter', 'insideExtra', 'outer', 'disc']},
    }


def disc(parent, materials, position=(0, 0, 1), slot=0, panel=1):
    container = group('Disc_%s_%s' % (panel, slot), parent, discSlot=slot, panel=panel)
    # The label stops at the transparent clamping hub. A scan's white scanner
    # reflection is not ink and must not make the clear centre opaque.
    obj = j.annulus('CD_reflective_ring', 60, 17.5, 1.2, (0, 0, 0), materials['silver'], container)
    obj.rotation_euler = (0, 0, 0)
    obj.location = j.mm(position)
    j.print_paper(obj, 120, 120, front=materials['disc'])
    hub = j.annulus('Clear_hub', 17.5, 7.5, 1.2, (0, 0, 0), materials['clear'], container)
    hub.rotation_euler = (0, 0, 0)
    hub.location = j.mm(position)
    return container


def tray(parent, materials, position=(0, 0, 0), panel=1):
    carrier = group('Tray_%s' % panel, parent, holder='tray', panel=panel)
    carrier.location = j.mm(position)
    plate = local_box('Moulded_tray', (124, 124, 1.5), (0, 0, 0), materials['tray'], carrier, 0)
    cutter = local_cylinder('Disc_well_cutter', 60.2, 1.15, (0, 0, .6), materials['tray'], carrier)
    j.cut(plate, cutter)
    for x in [-59, 59]:
        cutter = local_cylinder('Finger_notch', 6, 3, (x, 19, 0), materials['tray'], carrier)
        j.cut(plate, cutter)
    j.bevel(plate, .16)
    ring = j.annulus('Raised_disc_rim', 60.85, 60.2, .6, (0, 0, 0), materials['tray'], carrier)
    ring.rotation_euler = (0, 0, 0)
    ring.location.z = .001
    for i in range(12):
        angle = i * math.tau / 12
        finger = local_box('Rosette_finger', (1.5, .7, 1.5),
                           (6.7 * math.cos(angle), 6.7 * math.sin(angle), 1), materials['tray'], carrier)
        finger.rotation_euler.z = angle
    disc(carrier, materials, (0, 0, 1.7), panel=panel)
    # A second disc is supported by an actual reversible carrier, with its own pivot.
    swing = group('Swing_carrier_%s' % panel, carrier, extraDisc=True, panel=panel)
    swing.location = j.mm((-61, 0, 1.3))
    local_box('Swing_frame', (121, 121, .7), (61, 0, .5), materials['tray'], swing)
    other = disc(swing, materials, (61, 0, 1.5), slot=1, panel=panel)
    for frame, angle in [(1, 0), (61, 0), (121, -140)]:
        swing.rotation_euler.y = math.radians(angle)
        swing.keyframe_insert(data_path='rotation_euler', frame=frame)
    linear_keys(swing)
    return carrier


def pocket(parent, materials, position, width, height, panel, mini=False, inward=False):
    mouth_side = (1 if panel == 0 else -1) if inward else 1
    carrier = group('Pocket_%s' % panel, parent, holder='pocket', panel=panel, mouthSide=mouth_side)
    carrier.location = j.mm(position)
    # Three closed seams and one open edge; the lip does not cap the cavity.
    skin = local_box('Pocket_lip', (width, height, .30 if inward else .36),
                     (0, 0, 1.86 if inward else 3.0), materials['wrap'], carrier, .06)
    skin['pocketLip'] = True
    j.print_paper(skin, width, height, front=materials['insideLeft' if panel == 0 else 'insideRight'])
    notch = local_cylinder('Pocket_thumb_cut', 18 if inward else 10, 2,
                           (mouth_side * (width / 2 + (0 if inward else 2)), 0, 1.86 if inward else 3), materials['paper'], carrier)
    if inward:
        notch.scale.x = 25 / 18
    j.cut(skin, notch)
    for y in [-height / 2 + 1, height / 2 - 1]:
        if inward:
            y = math.copysign(height / 2 - .3, y)
        wall = local_box('Glued_fold_return', (width, .55 if inward else 2, 1.68 if inward else 2.5),
                         (0, y, 1.02 if inward else 1.55), materials['paper'], carrier)
        wall['pocketWall'] = True
        wall['wallHeight'] = 1.68 if inward else 2.5
    wall = local_box('Pocket_closed_spine', (.55 if inward else 1.2, height - 2, 1.68 if inward else 2.5),
                     (-mouth_side * (width / 2 - (.3 if inward else .6)), 0, 1.02 if inward else 1.55), materials['paper'], carrier)
    wall['pocketWall'] = True
    wall['wallHeight'] = 1.68 if inward else 2.5
    # A visible inner sleeve and disc edge remain inside the open mouth.
    local_box('Inner_sleeve', (width - 2, height - 5, .10 if inward else .15),
              (0, 0, .32 if inward else .9), materials['paper'], carrier, .04)
    for slot in range(4):
        disc(carrier, materials, (-mouth_side * 6.5 if inward else 0, 0, (1.07 if inward else 1.8) + slot * 1.25), slot=slot, panel=panel)
    if mini:
        local_box('Mini_LP_folded_inner_flap', (3.5, height - 5, .2), (-width / 2 + 2.5, 0, 1.1), materials['paper'], carrier)
    return carrier


def crease(parent, materials, length, height, index, direction=-1, bend_side=1, phase='full', flat_spine=False):
    """A solid curved sheet with morphs; its endpoints coincide with the boards.

    The same sampled arc drives both morph vertices and the moving board's pivot.
    Their exported linear interpolation also preserves this seam between keys.
    """
    segments, height_rows = 24, 16
    vertices, faces = [], []
    row, layer_size = segments + 1, (segments + 1) * (height_rows + 1)
    for side in [-1, 1]:
        for longitudinal in range(height_rows + 1):
            y = height * (longitudinal / height_rows - .5)
            for step in range(segments + 1):
                vertices.append((direction * length * step / segments * .001, y * .001, side * .19 * .001))
    for layer in [0, 1]:
        for longitudinal in range(height_rows):
            for step in range(segments):
                offset = layer * layer_size + longitudinal * row + step
                face = [offset, offset + 1, offset + row + 1, offset + row]
                faces.append(face[::-1] if (layer == 0) == (direction > 0) else face)
    for edge in [0, height_rows * row]:
        for step in range(segments):
            faces.append([edge + step, edge + layer_size + step,
                          edge + layer_size + step + 1, edge + step + 1])
    for step in [0, segments]:
        for longitudinal in range(height_rows):
            offset = longitudinal * row + step
            faces.append([offset, offset + row, offset + row + layer_size, offset + layer_size])
    mesh = bpy.data.meshes.new('Continuous_fold_sheet')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Paper_fold_%s' % index, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj['foldLengthMm'], obj['foldHeightMm'] = length, height
    obj['foldSegments'], obj['foldRows'] = segments, height_rows
    obj['foldDirection'], obj['foldBendSide'], obj['foldFlat'] = direction, bend_side, flat_spine
    mesh.materials.append(materials['spine'])
    if flat_spine:
        mesh.materials.append(materials['insideSpine'])
        mesh.materials.append(materials['paper'])
    uv = mesh.uv_layers.new(name='Spine print UV')
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        if flat_spine:
            # +Z is the inner sheet; the reverse face is the outer printed
            # spine. Cut edges remain unprinted paper rather than stretched ink.
            polygon.material_index = 0 if polygon.index < segments * height_rows else 1 if polygon.index < 2 * segments * height_rows else 2
        for loop in polygon.loop_indices:
            point = mesh.vertices[mesh.loops[loop].vertex_index].co
            u = point.x / (direction * length * .001)
            uv.data[loop].uv = (1 - u if flat_spine and polygon.material_index == 0 else u, .5 + point.y / (height * .001))
    obj.shape_key_add(name='Basis')
    keys, ends = [], []
    angle_span = 180 if flat_spine else 168
    for sample in range(9):
        # A CD wallet has two scored corners and a flat spine strip. Other
        # folded templates retain their curved flexible binding.
        angle = math.radians(180 - angle_span * sample / 8)
        radius = length / angle if angle else 0
        key = obj.shape_key_add(name='Bend_%s' % sample)
        for vert, point in zip(key.data, vertices):
            fraction = point[0] / (direction * length * .001)
            theta = fraction * angle
            n = point[2] * 1000
            if flat_spine:
                normal_angle = 0 if fraction == 0 else angle if fraction == 1 else angle / 2
                vert.co = j.mm((direction * length * fraction * math.cos(angle / 2) - bend_side * direction * n * math.sin(normal_angle),
                                point[1] * 1000, bend_side * length * fraction * math.sin(angle / 2) + n * math.cos(normal_angle)))
            else:
                vert.co = j.mm((direction * radius * math.sin(theta) - bend_side * direction * n * math.sin(theta), point[1] * 1000,
                                bend_side * radius * (1 - math.cos(theta)) + n * math.cos(theta)))
        frame = 1 + sample * 10 if phase == 'front' else 41 + sample * 10 if phase == 'inner' else 1 + sample * 15
        keys.append(key)
        x, z = (direction * length * math.cos(angle / 2), bend_side * length * math.sin(angle / 2)) if flat_spine else (
            direction * radius * math.sin(angle), bend_side * radius * (1 - math.cos(angle)))
        ends.append((frame, -direction * bend_side * angle, x, z))
    if phase == 'front':
        ends.append((121, *ends[-1][1:]))
    elif phase == 'inner':
        ends.insert(0, (1, *ends[0][1:]))
    for frame, angle, _, _ in ends:
        sample = round((180 - abs(math.degrees(angle))) / angle_span * 8)
        for number, key in enumerate(keys):
            key.value = 1 if sample == number else 0
            key.keyframe_insert(data_path='value', frame=frame)
    linear_keys(mesh.shape_keys)
    return obj, ends


def folded(kind, panels, inward=False, flat_spine=False):
    width, height = (139, 125) if kind == 'digipak' else (135, 135)
    depth = (9 if kind == 'digipak' else 5) * (panels - 1)
    if inward:
        width, height, depth = 138, 125, 5.0 * (panels - 1)
    if kind == 'digibook':
        width, height, depth = 140, 140, 16
    root = reset(kind, [width, height, depth])
    materials = stock()
    base = group('Panel_Right', root, panel=1)
    board = local_box('Back_board', (width, height, 1.6 if kind == 'digibook' else .36 if inward else .55), (0, 0, 0), materials['paper'], base)
    j.print_paper(board, width, height, materials['insideRight'], materials['back'])
    parents = [base]
    for index in range(panels - 1):
        current = base if index < 2 else parents[-1]
        direction = -1 if index == 0 else 1
        bend_side = -1 if index == 2 else 1
        anchor = group('Crease_anchor_%s' % index, current)
        anchor.location = j.mm((direction * width / 2, 0, 0))
        gap = (4.6 if inward else 13 if kind == 'digibook' else 7 if kind == 'digipak' else 4) * (panels - 1 if index == 0 else 1)
        length = gap if inward or flat_spine else math.pi * gap / 2
        phase = 'front' if panels > 2 and index == 0 else 'inner' if panels > 2 else 'full'
        sheet, ends = crease(anchor, materials, length, height, index, direction, bend_side, phase, inward or flat_spine)
        sheet['foldSheet'], sheet['foldGap'], sheet['foldIndex'] = True, gap, index
        hinge = group('Fold_Joint_%s' % index, anchor)
        hinge['foldJoint'], hinge['foldGap'], hinge['foldIndex'] = True, gap, index
        for frame, angle, x, z in ends:
            hinge.location = j.mm((x, 0, z))
            hinge.rotation_euler.y = angle
            hinge.keyframe_insert(data_path='location', frame=frame)
            hinge.keyframe_insert(data_path='rotation_euler', frame=frame)
            # Both physical seam endpoints use the exact same arc, not a fixed gap.
            sample = round((180 - abs(math.degrees(angle))) / (180 if inward or flat_spine else 168) * 8)
            key = sheet.data.shape_keys.key_blocks['Bend_%s' % sample]
            assert (key.data[24].co - j.mm((x - .19 * math.sin(angle), -height / 2, z - .19 * math.cos(angle)))).length < 1e-8
        linear_keys(hinge)
        panel_index = 0 if index == 0 else index + 1
        leaf = group('Panel_Left' if index == 0 else 'Panel_%s' % panel_index, hinge, panel=panel_index)
        leaf.location = j.mm((direction * width / 2, 0, 0))
        role = 'insideLeft' if index == 0 else 'insideCenter' if index == 1 else 'insideExtra'
        board = local_box('Wrapped_leaf_board' if kind == 'digibook' else 'Printed_fold_leaf',
                          (width, height, 1.6 if kind == 'digibook' else .36 if inward else .55), (0, 0, 0), materials['paper'], leaf)
        j.print_paper(board, width, height, materials[role], materials['front'] if index == 0 else materials['wrap'])
        board['printLeaf'] = index == 0
        parents.append(leaf)
    for panel, parent in zip([1, 0, 2, 3], parents):
        lift = 4.5 if kind == 'digibook' and panel == 0 else 0
        tray(parent, materials, (0, 0, 1.05 + lift), panel)
        pocket(parent, materials, (0, 0, (.06 if inward else .4) + lift), width - 1.5, height - 1.5, panel, inward=inward)
    if kind == 'digibook':
        pages = group('Bound_page_block', parents[1])
        for i in range(18):
            page = local_box('Page_leaf', (width - 6, height - 7, .2), (1.5, 0, .8 + i * .2), materials['paper'], pages, .025)
            if i == 17:
                j.print_paper(page, width - 6, height - 7, front=materials['insideLeft'])
        for y in [-height / 2 + .9, height / 2 - .9]:
            local_box('Cloth_headband', (4, 1.4, 4.0), (-width / 2 + 3, y, 2.6), materials['wrap'], parents[1])
    return root


def sleeve(mini=False):
    width = height = 135 if mini else 130
    root = reset('mini-lp-sleeve' if mini else 'card-sleeve', [width, height, 3.5])
    m = stock()
    front = local_box('Single_mouth_front', (width, height, .38), (0, 0, 1.55), m['paper'], root)
    front['sleeveFront'] = True
    j.print_paper(front, width, height, m['front'])
    cutter = local_cylinder('Thumb_notch', 10, 2, (width / 2 + 2, 0, 1.55), m['paper'], root)
    j.cut(front, cutter)
    rear = local_box('Single_mouth_rear', (width, height, .38), (0, 0, -1.55), m['paper'], root)
    j.print_paper(rear, width, height, back=m['back'])
    for y in [-height / 2 + .4, height / 2 - .4]:
        wall = local_box('Glued_top_bottom_fold', (width, .8, 3.2), (0, y, 0), m['paper'], root)
        wall['sleeveWall'] = True
        local_box('Glue_flap_overlap', (width - 1, 3, .16), (0, y - math.copysign(1.3, y), -1.28), m['wrap'], root, .025)
    spine = local_box('Closed_fold_spine', (.7, height, 3.2), (-width / 2 + .35, 0, 0), m['paper'], root)
    spine['sleeveWall'] = True
    # Side print has its own UV/material, not a reused front image.
    side_print(spine, m['spine'], 'X')
    inner = local_box('Mini_LP_inner_sleeve' if mini else 'Paper_inner', (width - 2, height - 5, .14), (.2, 0, -.85), m['paper'], root, .02)
    for slot in range(4):
        disc(root, m, (0, 0, slot * 1.25), slot=slot, panel=1)
    return root


def side_print(obj, mat, axis):
    obj.data.materials.append(mat)
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Side print UV')
    index = len(obj.data.materials) - 1
    size = obj.dimensions
    for polygon in obj.data.polygons:
        if (polygon.normal.x if axis == 'X' else polygon.normal.y) > -.99:
            continue
        polygon.material_index = index
        for loop in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (.5 + p.z / size.z, .5 + (p.y / size.y if axis == 'X' else p.x / size.x))


def rigid():
    root = reset('rigid-box', [145, 145, 24])
    m = stock()
    base = group('Rigid_base', root)
    lid = group('Lift_off_lid', root)
    bottom = local_box('Wrapped_base_board', (141, 141, 1.8), (0, 0, -10.7), m['paper'], base, .22)
    j.print_paper(bottom, 141, 141, m['insideRight'], m['back'])
    top = local_box('Wrapped_lid_board', (145, 145, 1.8), (0, 0, 11.1), m['paper'], lid, .28)
    j.print_paper(top, 145, 145, m['front'], m['insideLeft'])
    for parent, width, z, depth in [(base, 141, -1, 19.4), (lid, 145, 5.5, 9.8)]:
        for x in [-width / 2 + .85, width / 2 - .85]:
            wall = local_box('Wrapped_side_return', (1.7, width, depth), (x, 0, z), m['wrap'], parent, .16)
            if x < 0:
                side_print(wall, m['spine'], 'X')
        for y in [-width / 2 + .85, width / 2 - .85]:
            local_box('Wrapped_end_return', (width - 3.4, 1.7, depth), (0, y, z), m['wrap'], parent, .16)
        for x in [-width / 2 + 2, width / 2 - 2]:
            local_box('Paper_turned_in_seam', (.3, width - 4, depth - .7), (x, 0, z), m['paper'], parent, .03)
    tray(base, m, (0, 0, -8.7), 1)
    pocket(base, m, (0, 0, -8), 133, 133, 1)
    for frame, position in [(1, (0, 0, 0)), (46, (0, 0, 28)), (121, (-158, 0, 45))]:
        lid.location = j.mm(position)
        lid.keyframe_insert(data_path='location', frame=frame)
    linear_keys(lid)
    return root


def slipcase():
    root = reset('slipcase', [150, 150, 30])
    m = stock()
    front = local_box('Slipcase_printed_face', (150, 150, .55), (0, 0, 14.7), m['paper'], root)
    j.print_paper(front, 150, 150, m['outer'])
    rear = local_box('Slipcase_back', (150, 150, .55), (0, 0, -14.7), m['paper'], root)
    j.print_paper(rear, 150, 150, back=m['wrap'])
    for y in [-74.7, 74.7]:
        local_box('Slipcase_top_bottom', (150, .6, 29.4), (0, y, 0), m['wrap'], root)
    local_box('Slipcase_closed_spine', (.6, 150, 29.4), (-74.7, 0, 0), m['wrap'], root)
    return root


def neutral():
    root = reset('neutral', [135, 135, 2])
    m = stock()
    obj = local_box('Unspecified_packaging', (135, 135, 2), (0, 0, 0), m['paper'], root)
    j.print_paper(obj, 135, 135, m['front'], m['back'])
    return root


def slim():
    root = reset('slimline-jewel', [142, 125, 5.2])
    m = stock()
    base = group('Slim_back_tray', root)
    lid = group('Slim_cover_pivot', root)
    lid.location = j.mm((-69, 0, .6))
    for y in [-61.5, 61.5]:
        wall = local_box('Slim_shell_wall', (142, .85, 4.4), (0, y, -.1), m['tray'], base)
        socket = j.cylinder('Slim_pin_socket', 1.1, 3, (-69, y, .6), m['tray'], base, 'Y')
        j.cut(wall, socket)
        pin = j.cylinder('Slim_cover_pin', .92, 1.8, (0, 0, 0), m['clear'], lid, 'Y', vertices=48)
        pin.location = j.mm((0, y, 0))
    rear = local_box('Slim_base_floor', (142, 125, .8), (0, 0, -2.1), m['tray'], base)
    j.print_paper(rear, 142, 125, back=m['back'])
    tray(base, m, (7, 0, -1.6), 1)
    cover = local_box('Slim_transparent_cover', (140.5, 124.5, .65), (69, 0, 1.65), m['clear'], lid, .2)
    booklet = local_box('Slim_booklet', (120, 120, .25), (76, 0, 1.0), m['paper'], lid, .03)
    j.print_paper(booklet, 120, 120, m['front'], m['insideLeft'])
    for y in [-61.6, 61.6]:
        local_box('Slim_cover_ear', (139.7, .75, 2.8), (69, y, .6), m['clear'], lid, .18)
    for frame, angle in [(1, 0), (121, -165)]:
        lid.rotation_euler.y = math.radians(angle)
        lid.keyframe_insert(data_path='rotation_euler', frame=frame)
    linear_keys(lid)
    return root


def export(root, name, output, blends):
    scene = bpy.context.scene
    scene.frame_set(1)
    # Merge opaque static details within their own motion/visibility group only.
    for parent in [obj for obj in [root, *root.children_recursive] if obj.type == 'EMPTY']:
        meshes = [child for child in parent.children if child.type == 'MESH' and not child.data.shape_keys and not child.keys()]
        by_material = {}
        for obj in meshes:
            if any(mat and ('Clear' in mat.name or mat.name == 'Polystyrene_Clear') for mat in obj.data.materials):
                continue
            by_material.setdefault(tuple(mat.name for mat in obj.data.materials), []).append(obj)
        for objects in by_material.values():
            if len(objects) < 2:
                continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
    objects = [root, *root.children_recursive]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = output / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_extras=True, export_animations=True, export_animation_mode='SCENE',
                             export_frame_range=True, export_morph=True)
    raw = path.read_bytes()
    doc = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
    assert not doc.get('images'), 'Shared assets must not contain personal or fixture photographs'
    if blends:
        bpy.ops.wm.save_as_mainfile(filepath=str(blends / (name + '.blend')))
    return {'nominal_mm': list(root['nominal_mm']), 'bytes': len(raw),
            'primitives': sum(len(mesh['primitives']) for mesh in doc['meshes']),
            'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for mesh in doc['meshes'] for p in mesh['primitives']),
            'animated': bool(doc.get('animations'))}


def jewel(output, blends, temporary, count=1, thick=False):
    j.build(SimpleNamespace(output=str(temporary), textures=None, no_render=True))
    root = bpy.data.objects['Jewel_Case_142x125x10_4']
    root['reference'] = 'Nominal template, not a measured collection copy'
    root['status'] = 'Shared Blender packaging template'
    m = stock()
    obj = bpy.data.objects.get('CD_120mm')
    obj['discSlot'], obj['panel'] = 0, 1
    j.print_paper(obj, 120, 120, front=m['disc'])
    rear_shell = bpy.data.objects.get('Fixed_Base_And_Tray__Polystyrene_Clear')
    # The tray card folds up inside the transparent back-shell spine.
    card = local_box('Spine_card_return', (.14, 119, 5.2), (-69.7, 0, -1.5), m['paper'], bpy.data.objects['Fixed_Base_And_Tray'], .02)
    side_print(card, m['spine'], 'X')
    if count > 1:
        bpy.data.objects.remove(obj, do_unlink=True)
        old_hub = bpy.data.objects.get('Disc_translucent_hub')
        if old_hub:
            bpy.data.objects.remove(old_hub, do_unlink=True)
        carrier = group('Standard_swing_tray', bpy.data.objects['Fixed_Base_And_Tray'])
        carrier.location = j.mm((-54, 0, -.1))
        local_box('Double_sided_swing_frame', (122, 121, .6), (61, 0, .3), m['tray'], carrier)
        disc(carrier, m, (61, 0, 1.15), panel=1)
        back_disc = disc(carrier, m, (0, 0, 0), slot=1, panel=1)
        back_disc.location = j.mm((61, 0, -.65))
        back_disc.rotation_euler.y = math.pi
        for frame, angle in [(1, 0), (61, 0), (121, -135)]:
            carrier.rotation_euler.y = math.radians(angle)
            carrier.keyframe_insert(data_path='rotation_euler', frame=frame)
        linear_keys(carrier)
        if count > 2:
            other = carrier.copy()
            bpy.context.collection.objects.link(other)
            other.name = 'Second_swing_tray'
            other.parent = carrier.parent
            other.location.z -= .0028
            for child in carrier.children_recursive:
                clone = child.copy()
                if child.type == 'MESH':
                    clone.data = child.data.copy()
                bpy.context.collection.objects.link(clone)
                clone.parent = other if child.parent == carrier else bpy.data.objects[child.parent.name + '_extra']
                clone.name = child.name + '_extra'
                if 'discSlot' in clone:
                    clone['discSlot'] += 2
    if thick:
        # Fatbox has two outer covers, a central spine and two separate chambers.
        # It is not a depth-scaled standard case; each cover keeps its own pin/socket.
        front = group('Fatbox_front_chamber', root, frontChamber=True)
        for child in list(root.children):
            if child != front:
                child.parent = front
        front.location.z = .0055
        reverse = group('Fatbox_rear_chamber', root, rearChamber=True)
        reverse.location.z = -.0055
        reverse.rotation_euler.y = math.pi
        clones = {front: reverse}
        for child in front.children_recursive:
            clone = child.copy()
            if child.type == 'MESH':
                clone.data = child.data.copy()
                for slot in clone.material_slots:
                    if slot.material and slot.material.name.startswith('Print_front'):
                        slot.material = m['back']
            bpy.context.collection.objects.link(clone)
            clone.name = child.name + '_rear'
            clone.parent = clones[child.parent]
            clones[child] = clone
            if 'discSlot' in clone:
                clone['discSlot'] += 2
        local_box('Central_fatbox_spine', (13, 124, 12), (-63.5, 0, 0), m['tray'], root, .4)
        root['nominal_mm'] = [142, 125, 22]
    name = 'jewel-fat' if thick else 'jewel-swing-4' if count > 2 else 'jewel-swing-2' if count > 1 else 'jewel-case'
    return name, export(root, name, output, blends)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--blend-output')
    parser.add_argument('--models', help='Comma-separated model names; leave other deployed models untouched')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    blends = Path(args.blend_output).resolve() if args.blend_output else None
    if blends:
        blends.mkdir(parents=True, exist_ok=True)
    import tempfile
    selected = set(args.models.split(',')) if args.models else None
    manifest = output / 'manifest.json'
    reports = json.loads(manifest.read_text())['models'] if selected and manifest.exists() else {}
    with tempfile.TemporaryDirectory(prefix='packaging-author-') as temp:
        for count, thick in [(1, False), (2, False), (4, False), (2, True)]:
            candidate = 'jewel-fat' if thick else 'jewel-case' if count == 1 else 'jewel-swing-' + str(count)
            if selected and candidate not in selected:
                continue
            name, report = jewel(output, blends, Path(temp), count, thick)
            reports[name] = report
    builders = [('slimline-jewel', slim), ('card-sleeve', sleeve), ('mini-lp-sleeve', lambda: sleeve(True)),
                ('digibook', lambda: folded('digibook', 2)), ('rigid-box', rigid), ('slipcase', slipcase), ('neutral', neutral)]
    builders += [(kind + '-' + str(panels), lambda k=kind, p=panels: folded(k, p))
                 for kind in ['gatefold', 'digipak'] for panels in [2, 3, 4]]
    builders += [('gatefold-2-mini-lp', lambda: folded('gatefold', 2, flat_spine=True))]
    builders += [('gatefold-' + str(panels) + '-inner', lambda p=panels: folded('gatefold', p, True))
                 for panels in [2, 3, 4]]
    for name, builder in builders:
        if selected and name not in selected:
            continue
        root = builder()
        reports[name] = export(root, name, output, blends)
        print('MODEL_COMPLETE', name, json.dumps(reports[name]), flush=True)
    (output / 'manifest.json').write_text(json.dumps({'generator': 'Blender', 'units': 'metres',
        'dimensions': 'nominal millimetres; not measurements', 'models': reports}, indent=2) + '\n')


if __name__ == '__main__':
    main()
