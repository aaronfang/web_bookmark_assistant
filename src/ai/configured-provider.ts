import { OllamaProvider } from './ollama-provider';
import { OpenAiCompatibleProvider } from './openai-compatible-provider';
import { PrivacyAwareAiProvider } from './privacy-provider';
import type { AiProvider } from './provider';

export const AI_SETTINGS_KEY = 'wba-ai-settings';

export interface StoredAiSettings {
  provider: 'disabled' | 'ollama' | 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
  excludedDomains?: string[];
}

export function loadStoredAiSettings(): StoredAiSettings {
  try {
    return JSON.parse(
      localStorage.getItem(AI_SETTINGS_KEY) ?? '',
    ) as StoredAiSettings;
  } catch {
    return {
      provider: 'disabled',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3',
      apiKey: '',
    };
  }
}

export function createConfiguredAiProvider(): AiProvider | null {
  const settings = loadStoredAiSettings();
  if (settings.provider === 'disabled') return null;
  const inner =
    settings.provider === 'ollama'
      ? new OllamaProvider(settings)
      : new OpenAiCompatibleProvider(settings);
  return new PrivacyAwareAiProvider(inner, {
    excludedDomains: settings.excludedDomains ?? [],
  });
}
