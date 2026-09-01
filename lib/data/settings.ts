import 'server-only';
import { updateData } from './store';
import { badRequest } from '../errors';
import { validateSettings } from '../validation';
import type { Settings } from '@/lib/types';

export async function saveSettings(body: unknown): Promise<Settings> {
  const { result } = await updateData((data) => {
    const validated = validateSettings(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);
    data.settings = { ...data.settings, ...validated.value };
    return data.settings;
  });
  return result;
}
