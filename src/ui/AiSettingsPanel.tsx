import { useState } from 'react';

import { OllamaProvider } from '../ai/ollama-provider';
import { OpenAiCompatibleProvider } from '../ai/openai-compatible-provider';

const STORAGE_KEY = 'wba-ai-settings';

interface AiSettings {
  provider: 'disabled' | 'ollama' | 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
}

const defaults: AiSettings = {
  provider: 'disabled',
  baseUrl: 'http://127.0.0.1:11434',
  model: 'llama3',
  apiKey: '',
};

function loadSettings(): AiSettings {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'),
    };
  } catch {
    return defaults;
  }
}

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [message, setMessage] = useState<string | null>(null);
  const update = (changes: Partial<AiSettings>): void =>
    setSettings((current) => ({ ...current, ...changes }));
  const save = (): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage('AI 设置已保存在本地。');
  };
  const testConnection = async (): Promise<void> => {
    setMessage(null);
    try {
      const provider =
        settings.provider === 'ollama'
          ? new OllamaProvider(settings)
          : new OpenAiCompatibleProvider(settings);
      await provider.summarize({
        title: '连接测试',
        url: 'https://example.com',
      });
      setMessage('AI Provider 连接成功。');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'AI Provider 连接失败。',
      );
    }
  };

  return (
    <section className="ai-settings" aria-labelledby="ai-settings-title">
      <header className="dashboard-overview__header">
        <h2 id="ai-settings-title">AI 设置</h2>
        <p>
          默认关闭。启用 Ollama 后，只有用户主动触发摘要或分类时才会发送内容。
        </p>
      </header>
      <label>
        Provider
        <select
          value={settings.provider}
          onChange={(event) =>
            update({ provider: event.target.value as AiSettings['provider'] })
          }
        >
          <option value="disabled">禁用</option>
          <option value="ollama">本地 Ollama</option>
          <option value="openai-compatible">OpenAI 兼容 API</option>
        </select>
      </label>
      <label>
        API 地址
        <input
          value={settings.baseUrl}
          disabled={settings.provider === 'disabled'}
          onChange={(event) => update({ baseUrl: event.target.value })}
        />
      </label>
      {settings.provider === 'ollama' ? (
        <p className="notice">
          首次使用 Ollama：先运行 <code>ollama serve</code>，执行{' '}
          <code>ollama list</code> 确认模型名称；如果测试返回 403，需要设置{' '}
          <code>OLLAMA_ORIGINS</code> 后重启 Ollama。
        </p>
      ) : null}
      {settings.provider === 'openai-compatible' ? (
        <label>
          API Key
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
          />
        </label>
      ) : null}
      <label>
        模型
        <input
          value={settings.model}
          disabled={settings.provider === 'disabled'}
          onChange={(event) => update({ model: event.target.value })}
        />
      </label>
      <div>
        <button type="button" onClick={save}>
          保存设置
        </button>{' '}
        <button
          type="button"
          disabled={
            settings.provider === 'disabled' ||
            (settings.provider === 'openai-compatible' && !settings.apiKey)
          }
          onClick={() => void testConnection()}
        >
          测试连接
        </button>
      </div>
      {message ? <p className="status">{message}</p> : null}
    </section>
  );
}
