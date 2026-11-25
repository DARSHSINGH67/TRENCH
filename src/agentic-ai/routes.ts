import express from 'express';
import {
  AgentAuditLogEntry,
  AgentPendingApproval,
  DeliveryTask,
  LedgerTransaction,
  PartnerLiveLocation,
  PartnerNotification,
  TailorOrder,
} from '../types/appTypes.ts';
import { centralOrchestrator } from './services/centralOrchestrator.ts';
import { trenchRagService } from './services/ragService.ts';
import { geminiChatService, ChatMessage } from './services/geminiChatService.ts';
import { upsertTailorOrder, upsertDeliveryTask } from '../db/queries.ts';

interface AgentRoutesContext {
  supabase: any;
  getOnlinePartners: () => PartnerLiveLocation[];
}

export function registerAgenticAiRoutes(
  app: express.Express,
  context: AgentRoutesContext
) {
  // Demo Clerk Ticket fallback route
  app.post('/api/auth/clerk-demo-ticket', (req, res) => {
    res.json({
      success: true,
      email: 'partner@trench.in',
      phone: '+91 98765 43210',
      role: 'delivery',
      message: 'Demo session authenticated',
    });
  });

  // 1. Central Agent Orchestrator Endpoint
  app.post('/api/agent/orchestrate', async (req, res) => {
    try {
      const {
        orders = [],
        tasks = [],
        notifications = [],
        ledger = [],
        triggerEvent = 'System Check',
        targetOrderId,
        existingAuditLog = [],
        existingApprovals = [],
      } = req.body || {};

      const onlinePartners = context.getOnlinePartners ? context.getOnlinePartners() : [];

      const output = centralOrchestrator.orchestrate({
        orders,
        tasks,
        notifications,
        ledger,
        onlinePartners,
        triggerEvent,
        targetOrderId,
        existingAuditLog,
        existingApprovals,
      });

      res.json({
        success: true,
        orders: output.orders,
        tasks: output.tasks,
        notifications: output.notifications,
        ledger: output.ledger,
        agentState: output.agentState,
        auditTrail: output.auditTrail,
      });
    } catch (err: any) {
      console.error('[Agentic AI Route] Orchestration error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Agent orchestration error',
      });
    }
  });

  // 2. Multi-Turn Gemini AI Chatbot Endpoint
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        orders = [],
        tasks = [],
        targetOrderId,
      } = req.body || {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Missing user message' });
      }

      const onlinePartners = context.getOnlinePartners ? context.getOnlinePartners() : [];

      const result = await geminiChatService.handleChat({
        userMessage: message,
        history: history as ChatMessage[],
        orders: orders as TailorOrder[],
        tasks: tasks as DeliveryTask[],
        onlinePartners,
        targetOrderId,
      });

      // If an order was updated by an action, persist it to DB
      if (result.updatedOrders && result.executedAction?.orderId) {
        const updated = result.updatedOrders.find((o) => o.id === result.executedAction?.orderId);
        if (updated) {
          try {
            await upsertTailorOrder(updated);
          } catch (dbErr) {
            console.warn('DB upsert during chat action warning:', dbErr);
          }
        }
      }

      res.json({
        success: true,
        reply: result.reply,
        executedAction: result.executedAction,
        updatedOrders: result.updatedOrders,
        ragMatchesCount: result.ragMatchesCount,
        agentName: result.agentName,
        hasGeminiApiKey: geminiChatService.hasApiKey(),
      });
    } catch (err: any) {
      console.error('[Agentic AI Route] Chat error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Chat error',
      });
    }
  });

  // 3. Dedicated RAG Query Endpoint
  app.post('/api/agent/rag/query', (req, res) => {
    try {
      const { query, orderId, category, source, topK = 5 } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query parameter' });
      }

      const results = trenchRagService.query(query, {
        orderId,
        category,
        source,
        topK: Number(topK) || 5,
      });

      res.json({
        success: true,
        query,
        count: results.length,
        results,
        stats: trenchRagService.getStats(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'RAG query error' });
    }
  });

  // 4. Autonomous Order Step Advance Endpoint
  app.post('/api/agent/advance-step', async (req, res) => {
    try {
      const { order, action } = req.body || {};
      if (!order || !order.id || !action) {
        return res.status(400).json({ error: 'Missing order or action parameter' });
      }

      const result = centralOrchestrator.advanceOrderWorkflow(order, action);
      try {
        await upsertTailorOrder(result.updatedOrder);
      } catch (dbErr) {
        console.warn('DB upsert during advance-step warning:', dbErr);
      }

      res.json({
        success: true,
        order: result.updatedOrder,
        actionSummary: result.actionSummary,
        responsibleAgent: result.responsibleAgent,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Workflow advancement error' });
    }
  });

  // 5. Diagnostic route with 6 Agents & RAG status
  app.get('/api/agent/status', (req, res) => {
    const onlinePartners = context.getOnlinePartners ? context.getOnlinePartners() : [];
    res.json({
      status: 'active',
      orchestrator: 'Central AI Orchestrator',
      agents: [
        { name: 'Order Agent', role: 'Feasibility, Sizing Tolerances & Pricing' },
        { name: 'Dispatch Agent', role: 'GPS Proximity, EV Preference & 2-Leg Dispatch' },
        { name: 'Tailor Workflow Agent', role: 'Workbench Gates, Consultation & QC' },
        { name: 'Delivery Monitoring Agent', role: 'Milestones, Delay Detection & OTP' },
        { name: 'Communication Agent', role: 'Contextual Multi-Channel Alerts & Phone Masking' },
        { name: 'Exception Agent', role: 'Anomaly Detection, Approvals & Human Gates' },
      ],
      ragEngine: {
        status: 'active',
        stats: trenchRagService.getStats(),
      },
      hasGeminiApiKey: geminiChatService.hasApiKey(),
      onlinePartnersCount: onlinePartners.filter((p) => p.isOnline).length,
    });
  });
}
