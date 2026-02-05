export { detectEngine } from './engine.js';
export { runInContainer, setWorkspaceDir } from './container.js';
export { createContainer } from './persistent-container.js';
export { rotateLogs } from './log-rotation.js';
export { getApiKey } from './credentials.js';
export { ensureImage, getSourceHash, IMAGE_NAME } from './image.js';
export { runPreflight, formatPreflightResults } from './preflight.js';
export type { RunResult } from './container.js';
export type { Container, ContainerOptions, ExecResult } from './types.js';
