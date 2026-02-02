export type {
  AgentSkillConfig,
  AgentSupportResult,
  AgentSupportStatus,
  SkillScope
} from "./configs.js";

export type { ApplyOptions } from "./types.js";

export {
  supportedAgents,
  resolveAgentSupport,
  getAgentConfig,
  resolveSkillDir
} from "./configs.js";

export { configure, unconfigure, UnsupportedAgentError } from "./apply.js";
