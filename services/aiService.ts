import { api } from './apiClient';
import { AIConfig } from '../types';

export interface AnalysisResult {
  summary: string;
  possibleCauses: string[];
  recommendation: string;
}

/** AI is deliberately called through the Java gateway; no provider SDK or API key is shipped to the browser. */
export const testAIConnection = async (config: AIConfig): Promise<string> => {
  const response = await api.testAiConnection({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  });
  return response.message;
};

export const analyzeFault = async (
  faultDescription: string,
  machineConfig: string,
  logs?: string,
): Promise<AnalysisResult> => {
  return api.analyzeAi({ faultDescription, machineConfig, logs });
};
