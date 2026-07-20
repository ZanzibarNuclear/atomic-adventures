# Story Arc Builder: First Use

The Story Arc Builder organizes story structure. Use the Area or Utility
Station scene editor to change prose, triggers, conditions, and choices.

## Inspect an Arc or Beat

1. Open `/builder/story` and choose **Story arcs**.
2. Select an arc name to see its starting beat, beat count, and neighboring
   handoffs.
3. Expand the arc and select a beat to see its position and linked scenes.
4. Select a scene to open it for editing in the existing map-first scene
   editor.

Selection is read-only. Use **Edit arc** or **Edit title** when you intend to
change a title, then use **Save all** to publish the story-arc document.

## Move a Beat

Select a beat and choose **Move beat**, or drag it to another outline position.
Choose the destination arc and position, then review and confirm the move. The
beat's scenes and hidden runtime fields move with it. If the destination has a
non-linear handoff that cannot be changed safely, the builder stops and
explains the conflict.

## Split a Beat at a Scene Boundary

1. Select a beat with two or more linked scenes.
2. Choose **Split scenes**.
3. Enter the new beat title and stable kebab-case ID.
4. Choose the first scene that belongs to the new beat.
5. Review the original and new scene sequences, then confirm.

The scene membership and story-arc document are saved together. Existing
movement/action policy, completion conditions, and effects remain unchanged on
the original beat and are not copied to the new beat.

To move the opening portion of one arc to the previous arc, split at the first
scene that should remain in the later arc, select the original first portion,
and move it to the end of the previous arc.

## Attach or Add a Scene

Use **Attach scene** when the scene already exists. The picker shows available
scenes, their locations, and any story beat they currently belong to. Attaching
changes only the scene's story-beat association; its prose, trigger, choices,
and other content stay unchanged.

Use **Add scene** when writing a new scene. It opens a blank scene draft in the
map-first editor with the selected story beat already assigned. It does not
copy an existing scene. Complete the scene details there and save it normally.

## Save and Resolve Conflicts

Title and move changes remain unsaved until **Save all** is selected. A split
saves immediately because it changes both scene records and the story-arc
document atomically. If another window changed either record, reload before
trying the split again. **Revert** discards ordinary unsaved story-arc changes.
