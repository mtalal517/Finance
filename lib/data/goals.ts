import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateContribution, validateGoal } from '../validation';
import type { Goal, GoalContribution } from '@/lib/types';

/**
 * Goals keep their contributions as a list rather than a single running total,
 * so "add money toward goal" leaves a history and the progress figure is always
 * the sum of real deposits.
 */

export async function createGoal(body: unknown): Promise<Goal> {
  const { result } = await updateData((data) => {
    const validated = validateGoal(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const goal: Goal = {
      id: createId('goal', data.goals.map((g) => g.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
      contributions: [],
    };
    data.goals.push(goal);
    return goal;
  });
  return result;
}

export async function updateGoal(id: string, body: unknown): Promise<Goal> {
  const { result } = await updateData((data) => {
    const index = data.goals.findIndex((g) => g.id === id);
    if (index === -1) throw notFound('That goal could not be found.');

    const validated = validateGoal(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.goals[index];
    const updated: Goal = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
      contributions: existing.contributions,
    };
    data.goals[index] = updated;
    return updated;
  });
  return result;
}

export async function deleteGoal(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.goals.findIndex((g) => g.id === id);
    if (index === -1) throw notFound('That goal could not be found.');
    data.goals.splice(index, 1);
  });
}

export async function addContribution(goalId: string, body: unknown): Promise<Goal> {
  const { result } = await updateData((data) => {
    const goal = data.goals.find((g) => g.id === goalId);
    if (!goal) throw notFound('That goal could not be found.');

    const validated = validateContribution(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const contribution: GoalContribution = {
      id: createId('gc', goal.contributions.map((c) => c.id)),
      ...validated.value,
    };
    goal.contributions.push(contribution);
    goal.contributions.sort((a, b) => a.date.localeCompare(b.date));
    return goal;
  });
  return result;
}

export async function deleteContribution(goalId: string, contributionId: string): Promise<Goal> {
  const { result } = await updateData((data) => {
    const goal = data.goals.find((g) => g.id === goalId);
    if (!goal) throw notFound('That goal could not be found.');

    const index = goal.contributions.findIndex((c) => c.id === contributionId);
    if (index === -1) throw notFound('That contribution could not be found.');

    goal.contributions.splice(index, 1);
    return goal;
  });
  return result;
}
