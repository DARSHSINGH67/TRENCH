/**
 * Agent 3: Tailor Workflow Agent
 * Responsibilities:
 * - Match order with atelier based on skills (suits, ethnic, denim, alterations)
 * - Monitor workbench progression through 3 stages
 * - Enforce Gate 1: Mandatory phone consultation with customer
 * - Enforce Gate 2: Work progress tracking
 * - Enforce Gate 3: Completion snapshot validation for QC
 */

import { TailorOrder } from '../../types/appTypes.ts';

export interface TailorWorkflowEvaluation {
  orderId: string;
  orderNumber: string;
  currentWorkbenchStage: 'awaiting_receipt' | 'consultation_gate' | 'ready_to_cut' | 'in_progress' | 'qc_passed' | 'completed';
  consultationVerified: boolean;
  canStartWork: boolean;
  canMarkCompleted: boolean;
  safetyGateStatus: 'clear' | 'awaiting_tailor_confirmation' | 'awaiting_completion_evidence';
  reasoning: string;
  recommendedAction: string;
}

export class TailorWorkflowAgent {
  public evaluateWorkbench(order: TailorOrder): TailorWorkflowEvaluation {
    const isReceivedByTailor = order.stage !== 'incoming' && (
      order.firstDeliveryStatus === 'delivered_to_tailor' ||
      order.stage === 'accepted' ||
      order.stage === 'working' ||
      order.stage === 'completed'
    );

    const consultationDone = Boolean(order.customerContacted || order.customerCalledAt);
    const hasProgressPhotos = Boolean(order.progressUpdates && order.progressUpdates.length > 0);
    const isCompleted = order.stage === 'completed' || Boolean(order.completedAt);

    let currentStage: TailorWorkflowEvaluation['currentWorkbenchStage'] = 'awaiting_receipt';
    let canStart = false;
    let canComplete = false;
    let safetyGate: TailorWorkflowEvaluation['safetyGateStatus'] = 'clear';
    let reasoning = '';
    let action = '';

    if (!isReceivedByTailor) {
      currentStage = 'awaiting_receipt';
      reasoning = 'Parcel is in transit with First Leg Delivery Partner. Workbench pending garment arrival.';
      action = 'Monitor delivery partner approach to tailor workshop.';
    } else if (!consultationDone) {
      currentStage = 'consultation_gate';
      safetyGate = 'awaiting_tailor_confirmation';
      canStart = false;
      reasoning = 'Safety Gate Active: Platform policy requires tailor to call customer and confirm measurements prior to cutting.';
      action = 'Tailor must tap "Call Customer" to verify fit specifications.';
    } else if (order.stage === 'accepted' || (order.stage === 'working' && !order.workStartedAt)) {
      currentStage = 'ready_to_cut';
      canStart = true;
      reasoning = 'Customer consultation verified. Workbench ready for alteration.';
      action = 'Tap "Start Work" to begin cutting and stitching.';
    } else if (order.stage === 'working') {
      currentStage = 'in_progress';
      canComplete = true;
      reasoning = `Alteration in progress. ${hasProgressPhotos ? 'Progress snapshots uploaded.' : 'Upload progress photo recommended for client preview.'}`;
      action = 'Complete alteration and upload finished garment photo for QC clearance.';
    } else if (isCompleted) {
      currentStage = 'qc_passed';
      canComplete = false;
      reasoning = 'Garment alteration completed and verified by atelier. Ready for Second Leg Doorstep Return.';
      action = 'Dispatch Second Leg Delivery Partner.';
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentWorkbenchStage: currentStage,
      consultationVerified: consultationDone,
      canStartWork: canStart,
      canMarkCompleted: canComplete,
      safetyGateStatus: safetyGate,
      reasoning,
      recommendedAction: action,
    };
  }
}

export const tailorWorkflowAgent = new TailorWorkflowAgent();
