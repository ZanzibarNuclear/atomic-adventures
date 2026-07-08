import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
CONTENT_PATH = ROOT / "game/public/content/utility-station.json"
OUT_DIR = ROOT / "game/artifacts/utility-station"
BLEND_PATH = OUT_DIR / "utility-station-first-pass.blend"
RENDER_PATH = OUT_DIR / "utility-station-first-pass.png"

SCALE = 3.0
LEVEL_HEIGHT = 3.4
WALL_HEIGHT = 2.7
LOW_RAIL_HEIGHT = 1.0
WALL_THICKNESS = 0.14


def load_building():
    with CONTENT_PATH.open() as f:
        return json.load(f)["building"]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color, roughness=0.7, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


MATS = {}


def setup_materials():
    global MATS
    MATS = {
        "floor_first": mat("floor first level - blue grey concrete", (0.28, 0.34, 0.43, 1)),
        "floor_second": mat("floor second level - warmer concrete", (0.36, 0.39, 0.43, 1)),
        "open_void": mat("open two story bay void", (0.05, 0.06, 0.07, 1)),
        "wall": mat("painted concrete walls", (0.72, 0.73, 0.68, 1)),
        "interior_wall": mat("interior partition walls", (0.58, 0.62, 0.64, 1)),
        "door": mat("wood and metal man doors", (0.48, 0.31, 0.18, 1)),
        "roll_door": mat("ribbed roll up doors", (0.40, 0.43, 0.43, 1), metallic=0.2),
        "window": mat("blue glass windows", (0.18, 0.58, 0.90, 0.45), roughness=0.2),
        "path": mat("pale gravel paths", (0.56, 0.52, 0.43, 1)),
        "river": mat("cascade river water", (0.08, 0.32, 0.52, 0.78), roughness=0.25),
        "cliff": mat("cut rock cliff wall", (0.38, 0.35, 0.30, 1)),
        "metal": mat("dark worn metal", (0.19, 0.20, 0.20, 1), metallic=0.45),
        "brass": mat("aged brass rails and gauges", (0.71, 0.55, 0.27, 1), metallic=0.35),
        "hydro_pipe": mat("blue hydro pipe paint", (0.25, 0.58, 0.72, 1), metallic=0.25),
        "hydro_house": mat("mossy powerhouse concrete", (0.26, 0.35, 0.30, 1)),
        "equipment": mat("utility equipment green", (0.28, 0.38, 0.29, 1), metallic=0.15),
        "prop": mat("small props warm neutral", (0.56, 0.47, 0.35, 1)),
        "text": mat("label text ivory", (0.92, 0.88, 0.72, 1)),
        "cloth": mat("dusty eBuggy cover cloth", (0.47, 0.46, 0.41, 1)),
        "black": mat("rubber and dark trim", (0.03, 0.035, 0.04, 1)),
    }
    MATS["window"].blend_method = "BLEND"
    MATS["river"].blend_method = "BLEND"


def collection(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def link_to(obj, col):
    col.objects.link(obj)
    try:
        bpy.context.collection.objects.unlink(obj)
    except RuntimeError:
        pass


def xy(p):
    return (p["x"] * SCALE, -p["y"] * SCALE)


def z_for_level(building, level_id):
    order = building["levelById"][level_id]["order"]
    return order * LEVEL_HEIGHT


def add_cube(name, loc, scale, material, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    link_to(obj, col)
    return obj


def add_cylinder_between(name, a, b, radius, material, col, vertices=24):
    a = Vector(a)
    b = Vector(b)
    mid = (a + b) / 2
    length = (b - a).length
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    direction = b - a
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    if material:
        obj.data.materials.append(material)
    link_to(obj, col)
    return obj


def add_text(name, body, loc, size, col, rot=(math.radians(60), 0, math.radians(0))):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.materials.append(MATS["text"])
    link_to(obj, col)
    return obj


def room_center(room, z):
    return (room["x"] * SCALE + (room.get("w", 1) * SCALE) / 2, -room["y"] * SCALE - (room.get("h", 1) * SCALE) / 2, z)


def add_room_floor(room, z, col):
    w = room.get("w", 1) * SCALE
    h = room.get("h", 1) * SCALE
    cx, cy, _ = room_center(room, z)
    material = MATS["open_void"] if room.get("open") else MATS["floor_second" if room.get("level") == "second" else "floor_first"]
    return add_cube(f"room floor: {room['id']} - {room.get('label', room['id'])}", (cx, cy, z - 0.04), (w, h, 0.08), material, col)


def add_room_walls(room, z, col):
    if room.get("open"):
        return
    x = room["x"] * SCALE
    y = -room["y"] * SCALE
    w = room.get("w", 1) * SCALE
    h = room.get("h", 1) * SCALE
    wall_mat = MATS["wall"]
    add_cube(f"north wall: {room['id']}", (x + w / 2, y + WALL_THICKNESS / 2, z + WALL_HEIGHT / 2), (w, WALL_THICKNESS, WALL_HEIGHT), wall_mat, col)
    add_cube(f"south wall: {room['id']}", (x + w / 2, y - h - WALL_THICKNESS / 2, z + WALL_HEIGHT / 2), (w, WALL_THICKNESS, WALL_HEIGHT), wall_mat, col)
    add_cube(f"west wall: {room['id']}", (x - WALL_THICKNESS / 2, y - h / 2, z + WALL_HEIGHT / 2), (WALL_THICKNESS, h, WALL_HEIGHT), wall_mat, col)
    add_cube(f"east wall: {room['id']}", (x + w + WALL_THICKNESS / 2, y - h / 2, z + WALL_HEIGHT / 2), (WALL_THICKNESS, h, WALL_HEIGHT), wall_mat, col)


def add_windows(room, z, col):
    for edge in room.get("windows", []):
        x = room["x"] * SCALE
        y = -room["y"] * SCALE
        w = room.get("w", 1) * SCALE
        h = room.get("h", 1) * SCALE
        inset = 0.7
        if edge in ("west", "left"):
            add_cube(f"window band west: {room['id']}", (x - 0.09, y - h / 2, z + 1.65), (0.08, max(0.6, h - inset), 0.72), MATS["window"], col)
        if edge in ("east", "right"):
            add_cube(f"window band east: {room['id']}", (x + w + 0.09, y - h / 2, z + 1.65), (0.08, max(0.6, h - inset), 0.72), MATS["window"], col)
        if edge in ("north", "top"):
            add_cube(f"window band north: {room['id']}", (x + w / 2, y + 0.09, z + 1.65), (max(0.6, w - inset), 0.08, 0.72), MATS["window"], col)
        if edge in ("south", "bottom"):
            add_cube(f"window band south: {room['id']}", (x + w / 2, y - h - 0.09, z + 1.65), (max(0.6, w - inset), 0.08, 0.72), MATS["window"], col)


def add_room_label(room, z, col):
    cx, cy, _ = room_center(room, z)
    add_text(f"label: {room['id']}", room.get("label", room["id"]), (cx, cy, z + 0.16), 0.22, col, rot=(math.radians(90), 0, 0))


def add_door(door, building, col):
    if door["kind"] == "man" and "at" in door:
        levels = door.get("onLevels") or [door.get("level", "first")]
        for level in levels:
            z = z_for_level(building, level)
            x, y = xy(door["at"])
            vertical = door.get("vertical", False)
            dims = (0.12, 0.95, 2.0) if vertical else (0.95, 0.12, 2.0)
            obj = add_cube(f"man door: {door['id']} ({level})", (x, y, z + 1.0), dims, MATS["door"], col)
            obj["door_id"] = door["id"]
            if door.get("initial", {}).get("locked"):
                add_cube(f"lock marker: {door['id']} ({level})", (x, y, z + 2.15), (0.28, 0.06, 0.28), MATS["brass"], col)
    elif door["kind"] == "roll":
        room = building["roomById"].get(door.get("room"))
        if not room:
            return
        z = z_for_level(building, room["level"])
        rect = roll_door_rect(room)
        if not rect:
            return
        cx = rect["x"] + rect["w"] / 2
        cy = rect["y"] + rect["h"] / 2
        obj = add_cube(f"roll-up garage door: {door['id']}", (cx, cy, z + 1.35), (rect["w"], rect["h"], 2.7), MATS["roll_door"], col)
        obj["door_id"] = door["id"]
        for i in range(5):
            dz = z + 0.35 + i * 0.42
            add_cube(f"roll door rib {i + 1}: {door['id']}", (cx, cy, dz), (rect["w"] * 0.98, rect["h"] + 0.02, 0.035), MATS["metal"], col)


def roll_door_rect(room):
    edge = room.get("rollDoor")
    if not edge:
        return None
    x = room["x"] * SCALE
    y = -room["y"] * SCALE
    w = room.get("w", 1) * SCALE
    h = room.get("h", 1) * SCALE
    span = room.get("rollSpan", 0.6) * (w if edge in ("north", "south") else h)
    thick = 0.14
    if edge == "north":
        return {"x": x + w / 2 - span / 2, "y": y - thick / 2, "w": span, "h": thick}
    if edge == "south":
        return {"x": x + w / 2 - span / 2, "y": y - h - thick / 2, "w": span, "h": thick}
    if edge == "west":
        return {"x": x - thick / 2, "y": y - h / 2 - span / 2, "w": thick, "h": span}
    return {"x": x + w - thick / 2, "y": y - h / 2 - span / 2, "w": thick, "h": span}


def add_straight_stairs(fixture, building, col):
    r = fixture["rect"]
    levels = fixture.get("onLevels", ["first"])
    z = z_for_level(building, levels[0])
    x = r["x"] * SCALE
    y = -r["y"] * SCALE
    w = r["w"] * SCALE
    h = r["h"] * SCALE
    steps = 7
    for i in range(steps):
        if fixture.get("run", "horizontal") == "horizontal":
            sx = x + (i + 0.5) * w / steps
            sy = y - h / 2
            dims = (w / steps * 0.92, h, 0.16)
        else:
            sx = x + w / 2
            sy = y - (i + 0.5) * h / steps
            dims = (w, h / steps * 0.92, 0.16)
        add_cube(f"stair tread {i + 1}: {fixture['id']}", (sx, sy, z + 0.08 + i * 0.11), dims, MATS["brass"], col)


def add_spiral_stairs(fixture, building, col):
    x, y = xy(fixture["at"])
    r = fixture.get("radius", 0.66) * SCALE
    z0 = z_for_level(building, "first")
    z1 = z_for_level(building, "second")
    add_cylinder_between(f"spiral center pole: {fixture['id']}", (x, y, z0), (x, y, z1 + WALL_HEIGHT), 0.08, MATS["metal"], col)
    steps = 18
    for i in range(steps):
        a = math.radians(230 - i * 18)
        z = z0 + 0.25 + i * ((z1 - z0) / steps)
        sx = x + math.cos(a) * r * 0.48
        sy = y + math.sin(a) * r * 0.48
        tread = add_cube(f"spiral tread {i + 1}: {fixture['id']}", (sx, sy, z), (r * 0.72, 0.18, 0.08), MATS["brass"], col)
        tread.rotation_euler[2] = a
    add_cylinder_between(f"spiral glass shell left: {fixture['id']}", (x - r, y, z0), (x - r, y, z1 + 2.2), 0.035, MATS["window"], col, vertices=12)
    add_cylinder_between(f"spiral glass shell right: {fixture['id']}", (x + r, y, z0), (x + r, y, z1 + 2.2), 0.035, MATS["window"], col, vertices=12)


def add_basic_prop(name, loc, dims, col, material="prop"):
    return add_cube(name, loc, dims, MATS[material], col)


def add_room_props(building, col):
    for room in building["rooms"]:
        if room.get("feature") or room.get("open"):
            continue
        z = z_for_level(building, room["level"])
        cx, cy, _ = room_center(room, z)
        rid = room["id"]
        if rid == "library":
            add_basic_prop("library bookshelves west wall", (cx - 2.3, cy, z + 0.9), (0.35, 4.4, 1.8), col)
            add_basic_prop("overstuffed chair / window seating", (cx - 0.2, cy + 1.0, z + 0.35), (0.9, 0.8, 0.7), col)
            for i, stand in enumerate(room.get("stands", [])):
                sx, sy = xy(stand["at"])
                add_basic_prop(f"stand marker: {rid}/{stand['id']} - {stand['label']}", (sx, sy, z + 0.45), (0.45, 0.45, 0.9), col, "equipment")
        elif rid == "control-room":
            add_basic_prop("control console with startup card", (cx + 0.7, cy, z + 0.55), (1.5, 0.8, 1.1), col, "equipment")
            add_basic_prop("breaker panel wall", (cx - 3.2, cy, z + 1.35), (0.12, 3.2, 1.8), col, "metal")
            add_basic_prop("annunciator switch wall", (cx - 2.9, cy + 1.4, z + 1.4), (0.18, 1.2, 1.4), col, "equipment")
        elif rid == "control-lobby":
            add_basic_prop("reception desk with keys", (cx, cy, z + 0.45), (1.6, 0.55, 0.9), col)
        elif "bathroom" in rid:
            add_basic_prop(f"toilet: {rid}", (cx - 0.45, cy, z + 0.32), (0.45, 0.62, 0.64), col, "wall")
            add_basic_prop(f"sink: {rid}", (cx + 0.42, cy + 0.35, z + 0.42), (0.5, 0.32, 0.42), col, "wall")
        elif rid == "small-bay":
            add_basic_prop("covered eBuggy", (cx + 0.1, cy + 0.2, z + 0.65), (2.4, 1.35, 1.3), col, "cloth")
            add_basic_prop("EV charging cable post", (cx - 1.7, cy - 1.8, z + 0.65), (0.18, 0.18, 1.3), col, "equipment")
            add_basic_prop("field backpack near eBuggy", (cx + 1.5, cy - 1.4, z + 0.22), (0.55, 0.35, 0.44), col, "prop")
        elif rid == "large-bay":
            add_basic_prop("garage service bench with bolt cutter", (cx + 3.4, cy - 3.3, z + 0.45), (1.8, 0.45, 0.9), col)
            add_basic_prop("oil stain / missing large vehicle footprint", (cx, cy, z + 0.025), (3.0, 1.6, 0.05), col, "black")
            for i in range(4):
                add_basic_prop(f"large bay steel column {i + 1}", (cx + (-2.4 if i < 2 else 2.4), cy + (-2.4 if i % 2 else 2.4), z + 1.35), (0.18, 0.18, 2.7), col, "metal")
        elif rid == "conference":
            add_basic_prop("conference table", (cx, cy, z + 0.42), (2.4, 1.1, 0.18), col)
            for i in range(6):
                angle = i * math.tau / 6
                add_basic_prop(f"conference chair {i + 1}", (cx + math.cos(angle) * 1.6, cy + math.sin(angle) * 0.9, z + 0.35), (0.38, 0.38, 0.7), col)
        elif rid == "kitchen":
            add_basic_prop("kitchen cabinets and rations", (cx + 2.35, cy, z + 0.65), (0.5, 3.2, 1.3), col)
            add_basic_prop("electric stove", (cx - 1.0, cy - 1.7, z + 0.45), (0.8, 0.7, 0.9), col, "equipment")
            add_basic_prop("water purifier", (cx + 1.2, cy - 1.7, z + 0.65), (0.5, 0.4, 0.8), col, "equipment")
            add_basic_prop("kitchen table", (cx + 0.8, cy + 1.25, z + 0.42), (1.4, 0.9, 0.16), col)
        elif rid == "corridor":
            add_basic_prop("corridor conduit bundle", (cx, cy + 0.68, z + 1.8), (5.4, 0.08, 0.12), col, "hydro_pipe")


def add_exterior(building, col):
    ext = building.get("exterior", {})
    z = 0
    # Ground plane and river.
    add_cube("site ground plane", (0, -5.7, -0.08), (44, 28, 0.08), MATS["path"], col)
    add_cube("visible cascade river", (-1.5, 8.1, -0.03), (38, 4.5, 0.06), MATS["river"], col)
    for path in ext.get("paths", []):
        pts = path.get("points", [])
        for i in range(len(pts) - 1):
            a = (*xy(pts[i]), z + 0.03)
            b = (*xy(pts[i + 1]), z + 0.03)
            add_cylinder_between(f"path segment: {path['id']} {i + 1}", a, b, 0.12, MATS["path"], col, vertices=10)
    for node in ext.get("nodes", []):
        x, y = xy(node["at"])
        add_cube(f"exterior node: {node['id']} - {node.get('label', '')}", (x, y, z + 0.07), (0.38, 0.38, 0.14), MATS["brass"] if node.get("door") else MATS["path"], col)
        add_text(f"exterior label: {node['id']}", node.get("label", node["id"]), (x, y, z + 0.45), 0.16, col, rot=(math.radians(90), 0, 0))
    cliff = building.get("cliffWall", {})
    pts = cliff.get("points", [])
    for i in range(len(pts) - 1):
        a = (*xy(pts[i]), 0.45)
        b = (*xy(pts[i + 1]), 0.45)
        add_cylinder_between(f"cliff wall run {i + 1}", a, b, 0.28, MATS["cliff"], col, vertices=8)


def add_hydro(col):
    z = 0.28
    def p(x, y, zz=z):
        return (x * SCALE, -y * SCALE, zz)

    ix, iy, ihw = 4.10, -2.55, 0.155
    py = -1.62
    px1, px2 = 4.10, -5.92
    vx = -1.12
    phx1, phx2 = -5.92, -7.08
    phy1, phy2 = -2.55, -1.10
    tcx, tr = -6.50, 0.26

    add_cylinder_between("hydro penstock pipe", p(px1, py, 0.42), p(px2, py, 0.42), 0.16, MATS["hydro_pipe"], col)
    add_cylinder_between("hydro intake connector pipe", p(ix, iy, 0.42), p(ix, py, 0.42), 0.12, MATS["hydro_pipe"], col)
    add_cube("intake screen box", (ix * SCALE, -iy * SCALE, 0.38), (ihw * 2 * SCALE, ihw * 2 * SCALE, 0.42), MATS["hydro_pipe"], col)
    for i in [-0.06, 0.06]:
        add_cube(f"intake screen crossbar {i}", (ix * SCALE + i * SCALE, -iy * SCALE, 0.65), (0.025, ihw * 2 * SCALE, 0.05), MATS["metal"], col)
        add_cube(f"intake screen crossbar y {i}", (ix * SCALE, -iy * SCALE + i * SCALE, 0.7), (ihw * 2 * SCALE, 0.025, 0.05), MATS["metal"], col)

    add_cylinder_between("divert valve body", p(vx, py, 0.42), p(vx, py, 0.85), 0.28, MATS["equipment"], col, vertices=32)
    add_cylinder_between("divert valve handwheel east-west", p(vx - 0.26, py, 0.95), p(vx + 0.26, py, 0.95), 0.025, MATS["brass"], col)
    add_cylinder_between("divert valve handwheel north-south", p(vx, py - 0.26, 0.95), p(vx, py + 0.26, 0.95), 0.025, MATS["brass"], col)
    add_cylinder_between("dashed bypass pipe impression", p(vx, py, 0.24), p(vx, iy - 0.1, 0.24), 0.07, MATS["hydro_pipe"], col)

    cx = (phx1 + phx2) / 2 * SCALE
    cy = -(phy1 + phy2) / 2 * SCALE
    w = abs(phx2 - phx1) * SCALE
    h = abs(phy2 - phy1) * SCALE
    add_cube("micro hydro powerhouse enclosure", (cx, cy, 1.05), (w, h, 2.1), MATS["hydro_house"], col)
    add_cylinder_between("powerhouse entry valve", p(phx1, py, 0.42), p(phx1, py, 0.95), 0.18, MATS["equipment"], col, vertices=24)
    add_cylinder_between("turbine runner", p(tcx, py, 0.42), p(tcx, py, 0.88), tr * SCALE, MATS["hydro_pipe"], col, vertices=32)
    add_cube("generator box", ((tcx + 0.02) * SCALE, -(py + 0.48) * SCALE, 0.75), (1.15, 0.7, 0.75), MATS["equipment"], col)
    add_cylinder_between("tailrace drain pipe", p(tcx, phy1, 0.2), p(tcx, iy - 0.15, 0.2), 0.1, MATS["hydro_pipe"], col)
    add_text("hydro label: penstock", "penstock", (((px1 + px2) / 2) * SCALE, -py * SCALE, 1.0), 0.18, col, rot=(math.radians(75), 0, 0))
    add_text("hydro label: powerhouse", "powerhouse", (cx, cy, 2.35), 0.18, col, rot=(math.radians(75), 0, 0))


def prepare_building(data):
    rooms = data.get("rooms", [])
    levels = data.get("levels", [])
    out = dict(data)
    out["roomById"] = {r["id"]: r for r in rooms}
    out["levelById"] = {l["id"]: l for l in levels}
    return out


def build_scene():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    setup_materials()
    raw = load_building()
    building = prepare_building(raw)

    root_col = collection("Utility Station - generated from grid map")
    architecture = collection("architecture: rooms, floors, walls", root_col)
    doors = collection("doors: man doors and roll-up doors", root_col)
    fixtures = collection("fixtures: stairs and vertical circulation", root_col)
    props = collection("props: written scene details and pickups", root_col)
    exterior = collection("exterior: paths, river, nodes, cliff", root_col)
    hydro = collection("hydro system: intake, penstock, powerhouse", root_col)
    labels = collection("labels", root_col)

    for room in building["rooms"]:
        level = room.get("level") or (room.get("levels") or ["first"])[0]
        if room.get("feature"):
            continue
        z = z_for_level(building, level)
        add_room_floor(room, z, architecture)
        add_room_walls(room, z, architecture)
        add_windows(room, z, architecture)
        add_room_label(room, z, labels)
        if room["id"] == "large-bay":
            # Two story high bay roof/rafter indication.
            cx, cy, _ = room_center(room, z)
            add_cube("large bay high roof volume guide", (cx, cy, z + LEVEL_HEIGHT + 1.55), (room["w"] * SCALE, room["h"] * SCALE, 0.12), MATS["metal"], architecture)
    for door in building.get("doors", []):
        add_door(door, building, doors)
    for fixture in building.get("fixtures", []):
        if fixture["kind"] == "spiral-stairs":
            add_spiral_stairs(fixture, building, fixtures)
        elif fixture["kind"] == "straight-stairs":
            add_straight_stairs(fixture, building, fixtures)
    add_room_props(building, props)
    add_exterior(building, exterior)
    add_hydro(hydro)

    for level in building["levels"]:
        z = z_for_level(building, level["id"])
        add_text(f"level label: {level['id']}", level["label"], (-18, -15, z + 0.4), 0.36, labels, rot=(math.radians(90), 0, 0))

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 14))
    sun = bpy.context.object
    sun.name = "soft afternoon sun"
    sun.data.energy = 2.0
    sun.rotation_euler = (math.radians(45), 0, math.radians(-35))

    bpy.ops.object.light_add(type="AREA", location=(-6, -8, 9))
    area = bpy.context.object
    area.name = "large soft inspection light"
    area.data.energy = 420
    area.data.size = 7

    bpy.ops.object.camera_add(location=(8, -24, 18), rotation=(math.radians(58), 0, math.radians(27)))
    camera = bpy.context.object
    bpy.context.scene.camera = camera
    camera.name = "overview camera"
    camera.data.lens = 24

    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    bpy.context.scene.render.resolution_x = 1800
    bpy.context.scene.render.resolution_y = 1200
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.context.scene.render.filepath = str(RENDER_PATH)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    build_scene()
