import { prepareContentInputForAi, type AiPrivacySettings } from './privacy';
import type {
  AiProvider,
  ClassificationResult,
  ContentInput,
  SummaryResult,
} from './provider';

export class PrivacyAwareAiProvider implements AiProvider {
  readonly id: string;

  constructor(
    private readonly inner: AiProvider,
    private readonly settings: AiPrivacySettings,
  ) {
    this.id = `privacy:${inner.id}`;
  }

  summarize(input: ContentInput): Promise<SummaryResult> {
    return this.inner.summarize(prepareContentInputForAi(input, this.settings));
  }

  classify(input: ContentInput): Promise<ClassificationResult> {
    return this.inner.classify(prepareContentInputForAi(input, this.settings));
  }
}
