/**
 * Agent 2: Dispatch Agent
 * Responsibilities:
 * - Partner matching using real-time GPS proximity, vehicle type (EV preference), and workload
 * - Execution of 1st delivery leg (Customer -> Tailor)
 * - Execution of 2nd delivery leg (Tailor -> Customer)
 * - ETA estimation & offer generation
 */

import {
  AssignedDeliveryPartnerInfo,
  DeliveryStageType,
  DeliveryTask,
  PartnerLiveLocation,
  TailorOrder,
} from '../../types/appTypes.ts';

export interface DispatchEvaluation {
  orderId: string;
  orderNumber: string;
  stage: DeliveryStageType;
  selectedPartner: AssignedDeliveryPartnerInfo | null;
  candidatesCount: number;
  routeDistanceKm: number;
  estimatedEtaMinutes: number;
  reasoning: string;
  dispatchReady: boolean;
}

export class DispatchAgent {
  public evaluateDispatch(params: {
    order: TailorOrder;
    stage: DeliveryStageType; // 'first_delivery' | 'second_delivery'
    onlinePartners: PartnerLiveLocation[];
    existingTasks?: DeliveryTask[];
  }): DispatchEvaluation {
    const { order, stage, onlinePartners, existingTasks = [] } = params;

    // Filter available partners
    const active = onlinePartners.filter((p) => p.isOnline);

    if (active.length === 0) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        stage,
        selectedPartner: null,
        candidatesCount: 0,
        routeDistanceKm: 3.2,
        estimatedEtaMinutes: 20,
        reasoning: 'No active delivery partners currently online with active GPS. Re-dispatch queued.',
        dispatchReady: false,
      };
    }

    // Reference pickup coordinate
    const pickupLat = stage === 'first_delivery'
      ? (order.customerLocation?.lat ?? 12.9716)
      : (order.tailorLocation?.lat ?? 12.9815);
    const pickupLng = stage === 'first_delivery'
      ? (order.customerLocation?.lng ?? 77.5946)
      : (order.tailorLocation?.lng ?? 77.6045);

    // Score partners: distance + EV bonus + workload penalty
    const scored = active.map((partner) => {
      let distKm = 3.5;
      if (partner.lat !== null && partner.lng !== null) {
        const dLat = (partner.lat - pickupLat) * 111;
        const dLng = (partner.lng - pickupLng) * 111 * Math.cos(pickupLat * (Math.PI / 180));
        distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      }

      const activeTasksForPartner = existingTasks.filter(
        (t) =>
          (t.assignedPartnerPhone === partner.partnerPhone || t.assignedPartnerId === partner.partnerId) &&
          t.status !== 'delivered_to_tailor' &&
          t.status !== 'delivered_to_customer' &&
          t.status !== 'cloth_delivered'
      ).length;

      let score = 100 - (distKm * 8); // closer is better
      if (partner.vehicleType?.toLowerCase().includes('ev')) {
        score += 15; // EV eco priority
      }
      score -= (activeTasksForPartner * 25); // workload penalty

      return {
        partner,
        distKm: Number(distKm.toFixed(2)),
        score,
        activeTasks: activeTasksForPartner,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const partnerInfo: AssignedDeliveryPartnerInfo = {
      partnerId: best.partner.partnerId,
      partnerName: best.partner.partnerName,
      partnerPhone: best.partner.partnerPhone,
      vehicleType: best.partner.vehicleType || 'EV',
      vehicleNumber: best.partner.vehicleNumber || 'KA-01-TR-4029',
      assignedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const etaMins = Math.max(10, Math.round(best.distKm * 4 + 6));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      stage,
      selectedPartner: partnerInfo,
      candidatesCount: scored.length,
      routeDistanceKm: best.distKm,
      estimatedEtaMinutes: etaMins,
      reasoning: `Ranked #${1} candidate ${partnerInfo.partnerName} (${best.distKm} km away, ${partnerInfo.vehicleType}, score ${Math.round(best.score)}).`,
      dispatchReady: true,
    };
  }
}

export const dispatchAgent = new DispatchAgent();
