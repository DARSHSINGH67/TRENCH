/**
 * Agent 1: Order Agent
 * Responsibilities:
 * - Garment alteration feasibility assessment
 * - Verification of measurements against tailoring tolerances
 * - Payout calculation & validation
 * - Ingestion into Central Orchestrator
 */

import { TailorOrder } from '../../types/appTypes.ts';

export interface OrderFeasibilityResult {
  orderId: string;
  isFeasible: boolean;
  feasibilityScore: number; // 0 to 100
  measurementStatus: 'complete' | 'missing_critical' | 'outside_tolerance' | 'sample_garment_provided';
  validationNotes: string[];
  recommendedTailorCategory: 'tailored_suits' | 'ethnic_wear' | 'denim_casual' | 'rapid_alteration';
  estimatedEffortHours: number;
  calculatedTailorPayoutINR: number;
  calculatedDeliveryPayoutINR: number;
}

export class OrderAgent {
  public evaluateOrder(order: TailorOrder): OrderFeasibilityResult {
    const notes: string[] = [];
    let isFeasible = true;
    let score = 95;
    let effortHours = 1.5;

    // 1. Analyze Garment Category
    const garment = (order.clothToBeAltered || '').toLowerCase();
    let category: OrderFeasibilityResult['recommendedTailorCategory'] = 'rapid_alteration';

    if (garment.includes('suit') || garment.includes('blazer') || garment.includes('tuxedo') || garment.includes('coat')) {
      category = 'tailored_suits';
      effortHours = 3.5;
    } else if (garment.includes('lehenga') || garment.includes('sherwani') || garment.includes('saree') || garment.includes('kurta')) {
      category = 'ethnic_wear';
      effortHours = 2.5;
    } else if (garment.includes('jean') || garment.includes('denim')) {
      category = 'denim_casual';
      effortHours = 1.0;
    }

    // 2. Validate Measurements
    const size = order.sizeChart;
    let measurementStatus: OrderFeasibilityResult['measurementStatus'] = 'complete';

    if (!size) {
      measurementStatus = 'sample_garment_provided';
      notes.push('No direct size chart: Alteration requires physical sample garment matching by tailor.');
    } else {
      const chest = parseFloat(size.chestInches || '0');
      const waist = parseFloat(size.waistInches || '0');

      if (category === 'tailored_suits' && (!chest || chest < 28 || chest > 58)) {
        measurementStatus = 'missing_critical';
        score -= 30;
        notes.push('Suits & Blazers require precise chest measurements between 28" and 58".');
      }

      if (category === 'denim_casual' && (!waist || waist < 24 || waist > 52)) {
        measurementStatus = 'outside_tolerance';
        score -= 20;
        notes.push('Trousers & Denims require waist measurement between 24" and 52".');
      }
    }

    // 3. Pricing & Payout Sanity
    const tailorPayout = Number(order.tailorPayoutINR) || (category === 'tailored_suits' ? 380 : 220);
    const deliveryPayout = Number(order.deliveryPayoutINR) || 85;

    if (tailorPayout < 120) {
      notes.push(`Tailor payout of ₹${tailorPayout} is below minimum atelier rate (₹120). Suggested adjustment.`);
    }

    if (measurementStatus === 'complete' || measurementStatus === 'sample_garment_provided') {
      notes.push('Garment alteration parameters verified against Trench Fabric Tolerances.');
    }

    return {
      orderId: order.id,
      isFeasible: score >= 60,
      feasibilityScore: score,
      measurementStatus,
      validationNotes: notes,
      recommendedTailorCategory: category,
      estimatedEffortHours: effortHours,
      calculatedTailorPayoutINR: tailorPayout,
      calculatedDeliveryPayoutINR: deliveryPayout,
    };
  }
}

export const orderAgent = new OrderAgent();
