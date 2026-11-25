/**
 * Agent 5: Communication Agent
 * Responsibilities:
 * - Generates clear, context-aware notification payloads for SMS, WhatsApp, and in-app alerts
 * - Masks customer phone numbers for partner privacy (+91 98*** **210)
 * - Keeps Customer, Tailor, and Delivery partners in lockstep throughout the 3 workflows
 */

import { DeliveryTask, PartnerNotification, TailorOrder } from '../../types/appTypes.ts';

export interface CommunicationPayload {
  recipientRole: 'customer' | 'tailor' | 'delivery';
  recipientId: string;
  maskedPhone?: string;
  channel: 'in_app' | 'sms' | 'whatsapp';
  headline: string;
  messageText: string;
  actionPrompt?: string;
}

export class CommunicationAgent {
  public maskPhoneNumber(phone: string): string {
    if (!phone) return '+91 98*** *****';
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length <= 4) return phone;
    const prefix = digits.slice(0, 2);
    const suffix = digits.slice(-3);
    return `+91 ${prefix}*** **${suffix}`;
  }

  public generateNotification(event: {
    type: 'order_assigned' | 'first_leg_picked_up' | 'arrived_at_tailor' | 'tailor_consultation_needed' | 'work_completed' | 'second_leg_out_for_delivery' | 'delivered_successfully';
    order: TailorOrder;
    task?: DeliveryTask;
  }): CommunicationPayload[] {
    const { type, order, task } = event;
    const notifications: CommunicationPayload[] = [];
    const maskedPhone = this.maskPhoneNumber(order.customerPhone);

    switch (type) {
      case 'order_assigned':
        notifications.push({
          recipientRole: 'delivery',
          recipientId: task?.assignedPartnerPhone || 'delivery_fleet',
          maskedPhone,
          channel: 'in_app',
          headline: `New Pickup: ${order.orderNumber}`,
          messageText: `Pickup ${order.clothToBeAltered} from ${order.customerName}. Estimated earnings: ₹${order.deliveryPayoutINR}.`,
          actionPrompt: 'Tap to navigate to customer doorstep',
        });
        notifications.push({
          recipientRole: 'customer',
          recipientId: order.customerPhone,
          channel: 'sms',
          headline: 'Trench Delivery Partner Assigned',
          messageText: `Hi ${order.customerName}, your delivery partner is en route to collect your ${order.clothToBeAltered}. ETA ~15 mins.`,
        });
        break;

      case 'arrived_at_tailor':
        notifications.push({
          recipientRole: 'tailor',
          recipientId: order.tailorShopName,
          maskedPhone,
          channel: 'in_app',
          headline: `Parcel Received: ${order.orderNumber}`,
          messageText: `Fabric received from delivery partner. Please call ${order.customerName} (${maskedPhone}) to verify alteration specifications.`,
          actionPrompt: 'Call Customer to Confirm Sizing',
        });
        break;

      case 'tailor_consultation_needed':
        notifications.push({
          recipientRole: 'customer',
          recipientId: order.customerPhone,
          channel: 'whatsapp',
          headline: 'Consultation with Master Tailor',
          messageText: `Your atelier tailor (${order.tailorShopName}) is ready to begin work on your ${order.clothToBeAltered}. Expect a quick 2-minute call to ensure a custom fit.`,
        });
        break;

      case 'work_completed':
        notifications.push({
          recipientRole: 'delivery',
          recipientId: 'delivery_fleet',
          channel: 'in_app',
          headline: `Ready for Return: ${order.orderNumber}`,
          messageText: `Alteration finished at ${order.tailorShopName}. Dispatch ready for doorstep return delivery.`,
          actionPrompt: 'Accept Return Delivery Offer',
        });
        break;

      case 'second_leg_out_for_delivery':
        notifications.push({
          recipientRole: 'customer',
          recipientId: order.customerPhone,
          channel: 'whatsapp',
          headline: 'Your Altered Garment is Out for Delivery!',
          messageText: `Your ${order.clothToBeAltered} has passed QC and is on its way to your doorstep. Share your 4-digit OTP with the delivery partner upon arrival.`,
        });
        break;

      case 'delivered_successfully':
        notifications.push({
          recipientRole: 'customer',
          recipientId: order.customerPhone,
          channel: 'sms',
          headline: 'Delivered & Completed',
          messageText: `Thank you for choosing Trench! Your ${order.clothToBeAltered} has been delivered. Payout settled to partner atelier.`,
        });
        break;
    }

    return notifications;
  }
}

export const communicationAgent = new CommunicationAgent();
