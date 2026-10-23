/**
 * TypeScript wrapper & type definitions for Stage Contract Validator (UG-07, UG-09)
 */

export interface StageContractViolation {
  code: string;
  file: string;
  message: string;
  placeholder?: string;
  inputPath?: string;
  inputStatus?: string;
  level?: string;
}

export interface StageValidationResult {
  ok: boolean;
  violations: StageContractViolation[];
  frontmatter?: Record<string, unknown> | null;
  contractsChecked?: number;
}

// Dynamically resolve the JS implementation to avoid TS module resolution alias loops
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const impl = require('./validate-stage-contracts.js');

export const extractFrontmatter: (raw: string) => { frontmatter: Record<string, unknown> | null; content: string } = impl.extractFrontmatter;
export const validateStageContractContent: (filePath: string, rawContent: string, options?: { root?: string }) => StageValidationResult = impl.validateStageContractContent;
export const validateStageContractFile: (filePath: string, options?: { root?: string }) => StageValidationResult = impl.validateStageContractFile;
export const validateStageContracts: (options?: { root?: string; contracts?: string[] }) => StageValidationResult = impl.validateStageContracts;
