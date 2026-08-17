import { evaluateRequirements, normalizeRequirements } from "./requirements.js";

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
      const rank = Number(award.rank);
      if (rank <= Number(skill.rank ?? 0)) {
        applyAuthoredAward(skill, award, now);
        state.skills[definition.id] = skill;
        continue;
      }
      if (!awardHasGrantCriteria(award.require)) break;
      const require = requirementsForSkillAward(award.require, definition.id);
      if (!evaluateRequirements(require, { character: state, flags }).ok) break;
      skill.rank = rank;
      skill.acquiredAt ??= now();
      applyAuthoredAward(skill, award, now);
      state.skills[definition.id] = skill;
    }
  }
}

export function stampHeldSkillAwards(skill, definition, now) {
  const rank = Number(skill?.rank ?? 0);
  if (rank <= 0) return;
  skill.awards ??= {};
  for (const award of definition.practice?.awards ?? []) {
    if (Number(award.rank) > rank) continue;
    applyAuthoredAward(skill, award, now);
  }
}

function applyAuthoredAward(skill, award, now) {
  const key = String(award.rank);
  const existing = skill.awards[key] ?? {};
  skill.awards[key] = {
    earnedAt: existing.earnedAt ?? now(),
    badge: award.badge ?? existing.badge ?? null,
    earnedText: award.earnedText ?? existing.earnedText ?? null,
  };
}

export function awardHasGrantCriteria(require = {}) {
  const normalized = normalizeRequirements(require);
  return Boolean(
    normalized.flags.all.length ||
    normalized.flags.any.length ||
    normalized.flags.not.length ||
    normalized.knowledge.all.length ||
    normalized.knowledge.any.length ||
    normalized.knowledge.not.length ||
    normalized.documents.all.length ||
    normalized.documents.any.length ||
    normalized.documents.not.length ||
    normalized.items.all.length ||
    normalized.items.any.length ||
    normalized.items.not.length ||
    normalized.skills.length ||
    normalized.evidence.length ||
    normalized.stats.length ||
    normalized.quests.length
  );
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
