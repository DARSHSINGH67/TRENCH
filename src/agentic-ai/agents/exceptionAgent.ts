/**
 * Agent 6: Exception Agent
 * Responsibilities:
 * - Detects anomalies across all 3 workflows (Order specs, Logistics delays, Workbench stalls)
 * - Proposes autonomous resolutions or escalates to human operator
 * - Generates human review gates when safety thresholds are crossed
 */

import {
  AgentExceptionAlert,
  AgentPendingApproval,
  DeliveryTask,
  PartnerLiveLocation,
  TailorOrder,
} from '../../types/appTypes.ts';

export class ExceptionAgent {
  public scanForExceptions(params: {
    orders: TailorOrder[];
    tasks: DeliveryTask[];
    onlinePartners: PartnerLiveLocation[];
  }): {
    exceptions: AgentExceptionAlert[];
    pendingApprovals: AgentPendingApproval[];
  } {
    const { orders, tasks, onlinePartners } = params;
    const exceptions: AgentExceptionAlert[] = [];
    const pendingApprovals: AgentPendingApproval[] = [];
    const activePartnersCount = onlinePartners.filter((p) => p.isOnline).length;
    const nowIso = new Date().toISOString();

    // 1. Fleet Availability Exception
    const ordersNeedingDispatch = orders.filter(
      (o) => (o.stage === 'incoming' || o.pickupDispatched) && o.stage !== 'completed'
    );
    if (activePartnersCount === 0 && ordersNeedingDispatch.length > 0) {
      exceptions.push({
        id: `exc-fleet-${Date.now()}`,
        orderId: ordersNeedingDispatch[0].id,
        orderNumber: ordersNeedingDispatch[0].orderNumber,
        agent: 'Exception Agent',
        severity: 'warning',
        issueType: 'assignment_failed',
        message: `No active delivery partners online to handle ${ordersNeedingDispatch.length} pending pickup dispatch requests.`,
        resolutionHint: 'Delivery partners should toggle "Go Online" in their partner portal.',
        resolved: false,
        createdAt: nowIso,
      });
    }

    // 2. Order Level Inspection
    for (const ord of orders) {
      // Missing measurements check
      if (
        ord.stage === 'incoming' &&
        (!ord.sizeChart || (!ord.sizeChart.chestInches && !ord.sizeChart.waistInches))
      ) {
        exceptions.push({
          id: `exc-spec-${ord.id}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          agent: 'Exception Agent',
          severity: 'warning',
          issueType: 'missing_measurements',
          message: `Garment specifications for ${ord.orderNumber} lack recorded chest/waist measurements.`,
          resolutionHint: 'Delivery partner must take measurements during doorstep pickup, or tailor must measure on arrival.',
          resolved: false,
          createdAt: nowIso,
        });
      }

      // Workbench stall / consultation missing
      if (ord.stage === 'working' && !ord.customerContacted) {
        exceptions.push({
          id: `exc-consult-${ord.id}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          agent: 'Exception Agent',
          severity: 'warning',
          issueType: 'unconfirmed_customer_contact',
          message: `Tailor has not logged customer phone consultation for ${ord.orderNumber}.`,
          resolutionHint: 'Tailor should call customer to verify sleeve & waist fitting before cutting.',
          resolved: false,
          createdAt: nowIso,
        });

        pendingApprovals.push({
          id: `appr-consult-${ord.id}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          agent: 'Tailor Workflow Agent',
          title: 'Confirm Customer Sizing Consultation',
          reason: 'Customer measurement verification consultation required prior to fabric alteration cutting.',
          proposedActionType: 'confirm_workbench_ready',
          proposedPayload: { orderId: ord.id, customerContacted: true },
          requiredRole: 'tailor',
          createdAt: nowIso,
          status: 'pending',
        });
      }

      // Ready for second leg delivery gate
      if (ord.stage === 'completed' && (!ord.secondDeliveryStatus || ord.secondDeliveryStatus === 'not_ready')) {
        pendingApprovals.push({
          id: `appr-second-leg-${ord.id}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          agent: 'Tailor Workflow Agent',
          title: 'Approve Return Delivery Dispatch',
          reason: 'Alteration completed at atelier. Authorize second leg doorstep delivery dispatch.',
          proposedActionType: 'approve_second_delivery_dispatch',
          proposedPayload: { orderId: ord.id, deliveryStage: 'second_delivery' },
          requiredRole: 'tailor',
          createdAt: nowIso,
          status: 'pending',
        });
      }
    }

    // 3. Task Level Inspection (Delayed deliveries)
    for (const t of tasks) {
      const isOngoing =
        t.status !== 'delivered_to_tailor' &&
        t.status !== 'delivered_to_customer' &&
        t.status !== 'cloth_delivered';

      if (isOngoing && t.etaMinutes > 40) {
        exceptions.push({
          id: `exc-delay-${t.id}`,
          orderId: t.linkedTailorOrderId || t.id,
          orderNumber: t.orderNumber,
          agent: 'Exception Agent',
          severity: 'warning',
          issueType: 'delivery_delay',
          message: `Delivery task ${t.orderNumber} is experiencing elevated transit time (${t.etaMinutes} mins).`,
          resolutionHint: 'Dispatch Agent monitoring route traffic; standby partner notified if ETA exceeds 50 mins.',
          resolved: false,
          createdAt: nowIso,
        });
      }
    }

    return { exceptions, pendingApprovals };
  }
}

export const exceptionAgent = new ExceptionAgent();
