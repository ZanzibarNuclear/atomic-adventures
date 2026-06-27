# Character, Inventory, and Game-View Regression Checklist

**Status:** Active checklist
**Last updated:** 2026-06-27
**Related contracts:** [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md), [Hex Movement](../contracts/hex-crawling.md), [Deployment](../deployment.md)

Use this checklist at relevant phase boundaries for character, inventory,
story-integration, movement, save/load, builder, and close-up-view work.

## Regression Checks

- [ ] Existing movement and barrier tests remain green.
- [ ] Existing keys and doors behave identically.
- [ ] Legacy saves migrate and remain playable.
- [ ] New saves round-trip every character domain and holder.
- [ ] Reset/New Game clears player state but not authored definitions.
- [ ] Live authoring never replaces player-owned state.
- [ ] Unknown authored IDs fail validation; unknown saved IDs do not destroy a
  save.
- [ ] Effect lists never partially commit.
- [ ] Production build contains all runtime JSON and no builder chunks.
- [ ] Keyboard-only navigation works for Map, Character, close-up views, and
  builder tabs touched by the change.
- [ ] Narrow-screen Character and item transfer UI remains usable.

## Required Commands

Run at relevant phase boundaries:

```bash
npm run test
npm run build:game
```

Use `npm run deploy:check` before considering a complete release-facing feature
ready for merge.

## Notes

- This is a quality checklist, not an implementation plan.
- Keep individual feature plans focused on the work being built; link here
  rather than duplicating the full regression matrix.
- Expand this checklist when a new cross-cutting invariant becomes part of the
  game contract.
