import { api } from './apiClient';

export interface AnalysisResult {
  summary: string;
  possibleCauses: string[];
  recommendation: string;
}

export const analyzeFault = async (
  faultDescription: string,
  machineConfig: string,
  logs?: string,
): Promise<AnalysisResult> => {
  return api.analyzeAi({ faultDescription, machineConfig, logs });
};
