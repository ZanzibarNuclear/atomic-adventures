import { evaluateRequirements } from "./requirements.js";

export function evaluateSkillAwards(state, flags, definitions, now) {
  const skills = [...(definitions.skills ?? [])]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) ||
      String(left.id).localeCompare(String(right.id)));
  for (const definition of skills) {
    const awards = [...(definition.practice?.awards ?? [])]
      .sort((left, right) => Number(left.rank) - Number(right.rank));
    if (!awards.length) continue;
    const skill = state.skills[definition.id] ?? {
      rank: 0,
      evidence: {},
      evidenceEvents: {},
      awards: {},
    };
    skill.evidence ??= {};
    skill.evidenceEvents ??= {};
    skill.awards ??= {};
    for (const award of awards) {
      if (Number(award.rank) <= Number(skill.rank ?? 0)) continue;
      const require = requirementsForSkillAward(award.require, definition.id);
      if (!evaluateRequirements(require, { character: state, flags }).ok) break;
      skill.rank = Number(award.rank);
      skill.acquiredAt ??= now();
      skill.awards[String(award.rank)] = {
        earnedAt: now(),
        badge: award.badge ?? null,
        earnedText: award.earnedText ?? null,
      };
      state.skills[definition.id] = skill;
    }
  }
}

function requirementsForSkillAward(require = {}, skillId) {
  return {
    ...require,
    evidence: (require.evidence ?? []).map((condition) => ({
      ...condition,
      skill: condition.skill ?? skillId,
    })),
  };
}
