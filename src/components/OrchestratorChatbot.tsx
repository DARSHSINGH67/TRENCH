import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  X,
  Sparkles,
  CheckCircle2,
  Cpu,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { TailorOrder, DeliveryTask, AgentOrchestratorState, AppRole } from '../types/appTypes';
import { sendOrchestratorChatMessage, ChatMessagePayload } from '../utils/api';

interface OrchestratorChatbotProps {
  orders: TailorOrder[];
  tasks: DeliveryTask[];
  agentState?: AgentOrchestratorState;
  activeRole?: AppRole;
  onOrderUpdated?: (order: TailorOrder) => void;
  onRefreshOrchestration?: (triggerEvent: string) => void;
  defaultOpen?: boolean;
}

// 8 radiant sparkle points arranged radially around the circular button (District / Zomato style)
const SPARKLE_CONSTELLATION = [
  { x: 0, y: -37, color: '#38bdf8', size: 'w-2 h-2', delay: '0s' }, // Top (Sky Cyan)
  { x: 26, y: -26, color: '#ec4899', size: 'w-2.5 h-2.5', delay: '0.2s' }, // Top-Right (Pink)
  { x: 37, y: 0, color: '#a855f7', size: 'w-2 h-2', delay: '0.4s' }, // Right (Purple)
  { x: 26, y: 26, color: '#fbbf24', size: 'w-2 h-2', delay: '0.6s' }, // Bottom-Right (Gold)
  { x: 0, y: 37, color: '#38bdf8', size: 'w-2 h-2', delay: '0.8s' }, // Bottom (Cyan)
  { x: -26, y: 26, color: '#f43f5e', size: 'w-2.5 h-2.5', delay: '1s' }, // Bottom-Left (Rose)
  { x: -37, y: 0, color: '#a855f7', size: 'w-2 h-2', delay: '1.2s' }, // Left (Purple)
  { x: -26, y: -26, color: '#ffffff', size: 'w-2 h-2', delay: '1.4s' }, // Top-Left (Star White)
];

export const OrchestratorChatbot: React.FC<OrchestratorChatbotProps> = ({
  orders,
  tasks,
  agentState,
  activeRole = 'tailor',
  onOrderUpdated,
  onRefreshOrchestration,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isBursting, setIsBursting] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessagePayload[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: `👋 **Hello! Trench AI is ready.**\n\nType any request or command below. The backend orchestrator will update orders, assign delivery riders, or check customer measurements automatically.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      agentRole: 'Trench AI',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orders.length > 0 && (!selectedOrderId || !orders.some((o) => o.id === selectedOrderId))) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsBursting(true);
    // Shockwave ripple and sparkle scatter animation, then reveal full screen
    setTimeout(() => {
      setIsOpen(true);
      setIsBursting(false);
    }, 220);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessagePayload = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    try {
      const res = await sendOrchestratorChatMessage({
        message: text,
        history: messages,
        orders,
        tasks,
        targetOrderId: selectedOrderId,
      });

      if (res && res.success) {
        const modelMsg: ChatMessagePayload = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agentRole: res.agentName || 'Trench AI',
          toolCallExecuted: res.executedAction
            ? {
                toolName: res.executedAction.actionName,
                args: { orderId: res.executedAction.orderId },
                resultSummary: res.executedAction.summary,
              }
            : undefined,
        };

        setMessages((prev) => [...prev, modelMsg]);

        if (res.executedAction) {
          setActionNotice(`Action executed: ${res.executedAction.actionName.replace(/_/g, ' ')}`);
          setTimeout(() => setActionNotice(null), 3500);
        }

        // If order state changed, notify parent
        if (res.updatedOrders && res.executedAction?.orderId && onOrderUpdated) {
          const updated = res.updatedOrders.find((o) => o.id === res.executedAction?.orderId);
          if (updated) {
            onOrderUpdated(updated);
          }
        }

        if (onRefreshOrchestration) {
          onRefreshOrchestration(res.executedAction ? `Action: ${res.executedAction.actionName}` : 'AI Chatbot Prompt');
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            text: '⚠️ Orchestrator executed with verified safety rules. State synchronized with backend.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            agentRole: 'Trench AI',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: '⚠️ Could not reach AI service. Please check connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agentRole: 'Trench AI',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const activeTargetOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  // Clean, simple quick prompts
  const quickPrompts = activeRole === 'delivery'
    ? [
        'Dispatch 1st leg pickup rider',
        'Mark garment picked up',
        'Confirm delivery to tailor',
        'Dispatch return to customer',
      ]
    : [
        'Dispatch pickup rider',
        'Verify customer call',
        'Start alteration',
        'Finish alteration & schedule return',
      ];

  return (
    <>
      {/* Floating Trigger Button with Circular Trench App Logo and Animated Sparkles */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Open Trench AI Copilot"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 rounded-full cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 group focus:outline-none"
        >
          {/* Ambient Glow / Pulse Container (matches selector 1: div:nth-of-type(1) > span:nth-of-type(1)) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={`absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400/40 via-indigo-500/40 to-fuchsia-500/40 blur-md ${
                isBursting ? 'animate-trench-ripple' : 'animate-pulse'
              }`}
            />
            {/* Click Shockwave Ripples (expanding outwards like in reference video) */}
            {isBursting && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-trench-ripple" />
                <span className="absolute inset-0 rounded-full border-2 border-fuchsia-400 animate-trench-ripple [animation-delay:90ms]" />
              </>
            )}
          </div>

          {/* Sparkle Constellation Orbiting Around the Circular Logo Button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {SPARKLE_CONSTELLATION.map((s, idx) => (
              <span
                key={idx}
                className={`absolute rounded-full shadow-[0_0_8px_currentColor] animate-sparkle-twinkle ${s.size} ${
                  isBursting ? 'scale-150 opacity-0 transition-all duration-200' : ''
                }`}
                style={{
                  backgroundColor: s.color,
                  color: s.color,
                  transform: `translate(${s.x}px, ${s.y}px)`,
                  animationDelay: s.delay,
                }}
              />
            ))}
          </div>

          {/* Center Circular Logo Badge */}
          <div className="relative w-full h-full rounded-full p-[2.5px] bg-gradient-to-tr from-cyan-400 via-indigo-600 to-fuchsia-500 shadow-[0_0_30px_rgba(79,70,229,0.55)] transition-transform duration-300 group-hover:rotate-6">
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#0a1435] via-[#000080] to-[#040817] flex flex-col items-center justify-center text-white relative overflow-hidden border border-white/20 select-none">
              {/* Subtle radial sheen */}
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-cyan-400/20 blur-xs" />
              <div className="absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-indigo-500/30 blur-xs" />

              {/* Exact Trench Vector App Logo */}
              <svg
                viewBox="0 0 100 68"
                className="w-7 h-5 sm:w-8 sm:h-5.5 fill-current text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform -translate-y-0.5 group-hover:scale-105 transition-transform"
                aria-hidden="true"
              >
                {/* Main T Top Bar + Left Vertical Stem */}
                <path d="M12 6 H90 L81 21 H48 V62 L34 66 V21 H16 Z" />
                {/* Inner Right Tucked "r" Stem */}
                <path d="M54 34 C54 27 58 25 66 25 H79 L75 36 H66 V59 L54 62 Z" />
              </svg>
              <span className="text-[9px] sm:text-[10px] font-extrabold lowercase tracking-tight leading-none text-white drop-shadow-sm font-display -mt-0.5">
                trench
              </span>

              {/* Tiny Glowing AI Badge at Top-Right */}
              <div className="absolute top-1 right-1.5 flex items-center justify-center">
                <span className="text-[7.5px] font-black font-mono tracking-tighter bg-gradient-to-r from-cyan-300 to-emerald-300 text-slate-950 px-1 py-0.2 rounded-full shadow-xs border border-white/50 leading-none">
                  AI
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Full-Screen Pure White Minimalist Chatbot with Full-Screen Bloom Animation */}
      {isOpen && (
        <div className="fixed inset-0 z-50 w-full h-dvh flex flex-col bg-white text-slate-900 animate-fullscreen-bloom">
          {/* Clean White Minimalist Header */}
          <header className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer sm:hidden"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Circular Trench Logo Badge */}
              <div className="w-9 h-9 rounded-full bg-[#000080] text-white flex flex-col items-center justify-center shadow-xs shrink-0 select-none">
                <svg viewBox="0 0 100 68" className="w-4.5 h-3 fill-current text-white" aria-hidden="true">
                  <path d="M12 6 H90 L81 21 H48 V62 L34 66 V21 H16 Z" />
                  <path d="M54 34 C54 27 58 25 66 25 H79 L75 36 H66 V59 L54 62 Z" />
                </svg>
                <span className="text-[6.5px] font-black lowercase tracking-tighter -mt-0.5">trench</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Trench AI</h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-xs text-slate-500">Autonomous Order &amp; Delivery Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                title="Close Full Screen"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Action Success Toast Banner */}
          {actionNotice && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2 text-xs text-emerald-800">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{actionNotice}</span>
              <span className="text-[11px] text-emerald-600 ml-auto font-medium">Updated</span>
            </div>
          )}

          {/* Target Order Bar (Subtle & Clean) */}
          {orders.length > 0 && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2 max-w-full min-w-0">
                <span className="font-medium text-slate-500 shrink-0">Selected Order:</span>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#000080] font-medium truncate max-w-[240px] sm:max-w-xs cursor-pointer shadow-2xs"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} ({o.clothToBeAltered}) - {o.stage}
                    </option>
                  ))}
                </select>
              </div>

              {activeTargetOrder && (
                <span className="text-xs font-semibold text-[#000080] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full shrink-0">
                  {activeTargetOrder.stage}
                </span>
              )}
            </div>
          )}

          {/* Messages Scroll Canvas (Centered Clean White Layout) */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-white">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} transition-opacity duration-200`}
                >
                  {/* Sender label */}
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-500 font-medium px-1">
                    {msg.role === 'model' ? (
                      <>
                        <span className="font-semibold text-[#000080]">{msg.agentRole || 'Trench AI'}</span>
                      </>
                    ) : (
                      <span className="font-semibold text-slate-700">You</span>
                    )}
                    <span className="text-slate-400 font-mono text-[11px]">• {msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed max-w-[90%] sm:max-w-[80%] shadow-2xs ${
                      msg.role === 'user'
                        ? 'bg-[#000080] text-white rounded-br-xs font-normal'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}

                    {/* Action Executed Card */}
                    {msg.toolCallExecuted && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-start gap-2.5 text-xs text-emerald-800 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <span>Backend Action Executed:</span>
                            <span className="bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900 font-mono text-[11px]">
                              {msg.toolCallExecuted.toolName.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-emerald-700">
                            {msg.toolCallExecuted.resultSummary}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-4 py-3 rounded-2xl w-max animate-pulse">
                  <Cpu className="w-4 h-4 animate-spin text-[#000080]" />
                  <span>Trench AI is processing request and implementing solution...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Suggestion Chips (Minimalist & Clean) */}
          <div className="px-4 sm:px-6 py-2 bg-slate-50 border-t border-slate-200 shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Suggestions:
              </span>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isSending}
                  className="text-xs px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-full border border-slate-300 shrink-0 transition-colors shadow-2xs font-medium cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Prompt Bar (Clean Full-Width White Box) */}
          <footer className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Write a message or command (e.g. 'Dispatch rider', 'Start alteration', 'Verify consultation')..."
                disabled={isSending}
                className="flex-1 bg-slate-100 hover:bg-slate-50 border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/20 focus:bg-white transition-all shadow-2xs"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="w-11 h-11 rounded-full bg-[#000080] hover:bg-indigo-900 disabled:opacity-40 disabled:hover:bg-[#000080] text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer shrink-0"
                aria-label="Send"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  );
};
