import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  FileCheck,
  Cpu,
  Layers,
  Database,
  Truck,
  Scissors,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import {
  AgentAuditLogEntry,
  AgentOrchestratorState,
  DeliveryTask,
  InternalAgentRole,
  TailorOrder,
} from '../types/appTypes';

export interface AgenticWorkflowBarProps {
  portalRole: 'delivery' | 'tailor';
  orders?: TailorOrder[];
  tasks?: DeliveryTask[];
  agentState?: AgentOrchestratorState;
  onTriggerOrchestration?: (triggerReason?: string, targetOrderId?: string) => void;
  onOrdersUpdated?: (orders: TailorOrder[], tasks?: DeliveryTask[]) => void;
  onOpenChatbot?: () => void;
}

const AGENT_BADGES: { role: InternalAgentRole; icon: string; shortName: string }[] = [
  { role: 'Order Agent', icon: '📋', shortName: 'Order Agent' },
  { role: 'Dispatch Agent', icon: '⚡', shortName: 'Dispatch Agent' },
  { role: 'Tailor Workflow Agent', icon: '✂️', shortName: 'Tailor Agent' },
  { role: 'Delivery Monitoring Agent', icon: '🛵', shortName: 'Delivery Monitor' },
  { role: 'Communication Agent', icon: '💬', shortName: 'Comms Agent' },
  { role: 'Exception Agent', icon: '🛡️', shortName: 'Safety & Exceptions' },
];

export const AgenticWorkflowBar: React.FC<AgenticWorkflowBarProps> = ({
  portalRole,
  orders = [],
  tasks = [],
  agentState,
  onTriggerOrchestration,
  onOpenChatbot,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'workflows' | 'exceptions' | 'summaries'>('audit');

  const isRunning = Boolean(agentState?.isRunning);
  const auditLogs: AgentAuditLogEntry[] = agentState?.auditLog || [];
  const exceptions = agentState?.exceptions || [];
  const orderSummaries = agentState?.orderSummaries || {};
  const activeAgent = agentState?.activeAgent || 'Order Agent';

  const handleRunCheck = () => {
    if (onTriggerOrchestration) {
      onTriggerOrchestration(`Manual ${portalRole === 'tailor' ? 'Tailor' : 'Delivery'} Diagnostic Check`);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-900/60 shadow-md overflow-hidden transition-all">
      {/* Main Bar */}
      <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Engine Status & Active Agent */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
            {isRunning ? (
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            ) : (
              <Cpu className="w-5 h-5 text-indigo-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Trench Central AI Orchestrator
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-medium flex items-center gap-1">
                <Database className="w-2.5 h-2.5 text-cyan-400" />
                RAG Connected
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 border border-purple-500/30 font-medium">
                gemini-3.8-flash
              </span>
              {exceptions.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {exceptions.length} Alert{exceptions.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
              Active coordinator: <span className="font-semibold text-white">{activeAgent}</span> &bull; Last run: {agentState?.lastRunAt || 'Just now'} ({agentState?.lastTriggerEvent || 'Synced'})
            </p>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {onOpenChatbot && (
            <button
              type="button"
              onClick={onOpenChatbot}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Copilot</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunCheck}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            title="Trigger agent self-check across all active orders and tasks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Auditing...' : 'Run Diagnostics'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700/60 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Intel' : 'Agent Intel'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Agents Row (Always visible) */}
      <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-indigo-900/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3" /> 6 Specialised Agents:
        </span>
        <div className="flex items-center gap-1.5">
          {AGENT_BADGES.map((b) => {
            const isCurrent = activeAgent === b.role;
            return (
              <span
                key={b.role}
                className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium transition-colors shrink-0 ${
                  isCurrent
                    ? 'bg-indigo-500/30 text-indigo-100 border border-indigo-400/50'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:text-slate-200'
                }`}
                title={b.role}
              >
                <span>{b.icon}</span>
                <span>{b.shortName}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Expandable Intelligence Drawer */}
      {isExpanded && (
        <div className="border-t border-indigo-900/60 bg-slate-950/90 p-4 space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Autonomous Audit Log ({auditLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('workflows')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'workflows'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3 Workflows Lifecycle
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summaries')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'summaries'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Order Summaries ({Object.keys(orderSummaries).length})
            </button>
            {exceptions.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('exceptions')}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeTab === 'exceptions'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-400 hover:text-white'
                }`}
              >
                Exceptions ({exceptions.length})
              </button>
            )}
          </div>

          {/* 3 Workflows Tab */}
          {activeTab === 'workflows' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Workflow 1: Customer-to-Tailor</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Order Feasibility Checked (Order Agent)
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> First Leg Partner Dispatched (Dispatch Agent)
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <ArrowRight className="w-3 h-3" /> Garment Receipt at Atelier (Delivery Agent)
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Workflow 2: Tailor Atelier Workbench</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Customer Fit Consultation Gate
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> In-Progress Alteration Workbench
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <ArrowRight className="w-3 h-3" /> Finished Garment QC Photo Approval
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Workflow 3: Tailor-to-Customer</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Second Leg Partner Dispatched
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Real-time Geofence Tracking
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Doorstep OTP Handover & Wallet Settlement
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No audit entries yet. Click "Run Diagnostics" to perform a real-time system audit.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {log.agent} &bull; Order #{log.orderNumber}
                      </span>
                      <span className="font-mono text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-200">{log.reasoning}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-mono text-slate-400">Tool: {log.toolCalled}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-400 font-medium">{log.outcomeSummary}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Summaries Tab */}
          {activeTab === 'summaries' && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {Object.keys(orderSummaries).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No active orders registered in agent workflow tracker.
                </div>
              ) : (
                Object.values(orderSummaries).map((sum) => (
                  <div
                    key={sum.orderId}
                    className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Order #{sum.orderNumber}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-900/60 text-indigo-300 font-mono">
                        Step {sum.workflowStepIndex}/9: {sum.workflowStepLabel}
                      </span>
                    </div>
                    <p className="text-slate-300">{sum.currentStepAnalysis}</p>
                    <p className="text-[11px] text-indigo-300">
                      <span className="font-semibold">Next Action:</span> {sum.nextRecommendedAction}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {exceptions.map((exc) => (
                <div
                  key={exc.id}
                  className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-amber-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {exc.issueType.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] uppercase font-mono">{exc.severity}</span>
                  </div>
                  <p className="text-slate-200">{exc.message}</p>
                  <p className="text-[11px] text-amber-300/90 font-medium">
                    Recommendation: {exc.resolutionHint}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
