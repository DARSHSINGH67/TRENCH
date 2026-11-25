/**
 * Agent 4: Delivery Monitoring Agent
 * Responsibilities:
 * - Real-time tracking of rider geofence milestones
 * - Automated progression: (Rider assigned -> Arriving at pickup -> Picked up -> In transit -> Delivered)
 * - Delay detection against SLA
 * - Doorstep OTP verification trigger
 */

import { DeliveryTask, TailorOrder } from '../../types/appTypes.ts';

export type GeofenceMilestone =
  | 'approaching_pickup'
  | 'arrived_at_pickup'
  | 'package_picked_up'
  | 'approaching_destination'
  | 'arrived_at_destination'
  | 'delivered_and_settled';

export interface DeliveryMonitoringResult {
  taskId: string;
  orderNumber: string;
  milestone: GeofenceMilestone;
  delayDetected: boolean;
  delayMinutes: number;
  otpRequired: boolean;
  milestoneChecklist: {
    arrivingAtPickup: boolean;
    pickedUpFromSource: boolean;
    reachedDestination: boolean;
    deliveredSuccessfully: boolean;
  };
  liveSummary: string;
  nextCheckpoint: string;
}

export class DeliveryMonitoringAgent {
  public monitorTask(task: DeliveryTask, linkedOrder?: TailorOrder): DeliveryMonitoringResult {
    let milestone: GeofenceMilestone = 'approaching_pickup';
    const checklist = {
      arrivingAtPickup: false,
      pickedUpFromSource: false,
      reachedDestination: false,
      deliveredSuccessfully: false,
    };

    let otpRequired = false;
    let delay = false;
    let delayMins = 0;

    // Check SLA
    if (task.etaMinutes > 35) {
      delay = true;
      delayMins = task.etaMinutes - 30;
    }

    const isDelivered =
      task.status === 'delivered_to_tailor' ||
      task.status === 'delivered_to_customer' ||
      task.status === 'cloth_delivered';

    const isPickedUp =
      task.status === 'picked_up_from_customer' ||
      task.status === 'picked_up_from_tailor' ||
      task.status === 'cloth_picked_up' ||
      task.status === 'measurement_recorded';

    if (task.status === 'assigned') {
      milestone = 'approaching_pickup';
      checklist.arrivingAtPickup = true;
    } else if (isPickedUp) {
      milestone = 'package_picked_up';
      checklist.arrivingAtPickup = true;
      checklist.pickedUpFromSource = true;
      if (task.deliveryStage === 'second_delivery' || task.status === 'picked_up_from_tailor') {
        otpRequired = true; // Customer doorstep delivery requires OTP
      }
    } else if (isDelivered) {
      milestone = 'delivered_and_settled';
      checklist.arrivingAtPickup = true;
      checklist.pickedUpFromSource = true;
      checklist.reachedDestination = true;
      checklist.deliveredSuccessfully = true;
    }

    const summary = isDelivered
      ? `Task ${task.orderNumber} successfully completed and settled.`
      : `Rider ${task.assignedPartnerName || 'Partner'} is at milestone: ${milestone.replace(/_/g, ' ')}. ETA: ${task.etaMinutes} mins.`;

    const nextCheckpoint = isDelivered
      ? 'Payment settled into partner wallet.'
      : !checklist.pickedUpFromSource
      ? 'Scan package bag barcode / confirm pickup.'
      : 'Deliver to destination and verify recipient OTP.';

    return {
      taskId: task.id,
      orderNumber: task.orderNumber,
      milestone,
      delayDetected: delay,
      delayMinutes: delayMins,
      otpRequired,
      milestoneChecklist: checklist,
      liveSummary: summary,
      nextCheckpoint,
    };
  }
}

export const deliveryMonitoringAgent = new DeliveryMonitoringAgent();
