import type {
  AgentSkillConfig as AgentSkillConfigFromConfigs,
  AgentSupportResult as AgentSupportResultFromConfigs,
  AgentSupportStatus as AgentSupportStatusFromConfigs,
  SkillScope as SkillScopeFromConfigs
} from "./configs.js";
import type { ApplyOptions as ApplyOptionsFromTypes } from "./types.js";
import type {
  AgentSkillConfig,
  AgentSupportResult,
  AgentSupportStatus,
  ApplyOptions,
  SkillScope
} from "./index.js";

type AssertAssignable<To, ignoredFrom extends To> = true;

type ignoredAgentSkillConfigIsExported = AssertAssignable<
  AgentSkillConfigFromConfigs,
  AgentSkillConfig
>;

type ignoredAgentSupportResultIsExported = AssertAssignable<
  AgentSupportResultFromConfigs,
  AgentSupportResult
>;

type ignoredAgentSupportStatusIsExported = AssertAssignable<
  AgentSupportStatusFromConfigs,
  AgentSupportStatus
>;

type ignoredApplyOptionsIsExported = AssertAssignable<ApplyOptionsFromTypes, ApplyOptions>;

type ignoredSkillScopeIsExported = AssertAssignable<SkillScopeFromConfigs, SkillScope>;

type ignoredSupportedAgentsIsExported = typeof import("./index.js").supportedAgents;
type ignoredResolveAgentSupportIsExported = typeof import("./index.js").resolveAgentSupport;
type ignoredGetAgentConfigIsExported = typeof import("./index.js").getAgentConfig;
type ignoredResolveSkillDirIsExported = typeof import("./index.js").resolveSkillDir;
type ignoredConfigureIsExported = typeof import("./index.js").configure;
type ignoredUnconfigureIsExported = typeof import("./index.js").unconfigure;
type ignoredUnsupportedAgentErrorIsExported = typeof import("./index.js").UnsupportedAgentError;

// @ts-expect-error agentSkillConfigs is internal and must not be exported
type ignoredInternalSymbolIsNotExported = typeof import("./index.js").agentSkillConfigs;
