/**
 * Trench Dedicated RAG (Retrieval-Augmented Generation) Service
 * Ingests orders, partner profiles, atelier capabilities, tailoring tolerances,
 * and platform SOPs to provide factual, hallucination-free context to AI Agents.
 */

import {
  DeliveryPartnerProfile,
  DeliveryTask,
  LedgerTransaction,
  PartnerLiveLocation,
  PartnerNotification,
  TailorOrder,
  TailorProfile,
} from '../../types/appTypes.ts';

export interface RagDocument {
  id: string;
  source: 'order' | 'tailor_profile' | 'delivery_partner' | 'task' | 'platform_policy' | 'tailoring_sop';
  title: string;
  category: string;
  content: string;
  metadata: Record<string, any>;
  keywords: string[];
}

export interface RagQueryResult {
  document: RagDocument;
  score: number;
  snippet: string;
  relevanceReason: string;
}

// Trench Platform Knowledge Base & Tailoring SOPs
const PLATFORM_KNOWLEDGE: RagDocument[] = [
  {
    id: 'sop-measurements-tolerance',
    source: 'tailoring_sop',
    title: 'Standard Measurement Tolerances & Validation Rule',
    category: 'quality_standards',
    keywords: ['measurement', 'tolerance', 'chest', 'waist', 'inches', 'fit', 'alteration', 'suit', 'blazer', 'trousers'],
    metadata: { domain: 'tailoring_rules', minChestInches: 28, maxChestInches: 56 },
    content: `Trench Tailoring Quality SOP #101:
- Measurement Tolerance: Standard alteration margin is +/- 0.5 inches for casual garments and +/- 0.25 inches for formal suiting and blazers.
- Mandatory Fields: Any alteration involving upper-body garments (shirts, kurtas, jackets) MUST specify Chest, Shoulder, and Sleeve Length.
- Bottom garments (trousers, lehengas, jeans) MUST record Waist, Inseam, and Hem opening.
- If customer measurements deviate by > 2.5 inches from standard size chart, Order Agent must flag 'measurement_verification_required' before workbench cutting.`,
  },
  {
    id: 'sop-delivery-dispatch-sla',
    source: 'platform_policy',
    title: 'Dual-Leg Delivery Dispatch SLA & Geofence Policy',
    category: 'logistics_sla',
    keywords: ['dispatch', 'delivery', 'first leg', 'second leg', 'sla', 'pickup', 'eta', 'geofence', 'ev', 'rider'],
    metadata: { firstLegSlaMins: 30, secondLegSlaMins: 45, maxSearchRadiusKm: 15 },
    content: `Trench Delivery Dispatch SLA Protocol:
- Leg 1 (Customer -> Atelier): Target pickup within 25 minutes of order placement. Preferred assignment to nearest EV rider within 5.0 km radius.
- Leg 2 (Atelier -> Customer): Target dispatch within 15 minutes of tailor completion photograph upload and QC clearance.
- Geofence Milestones:
  1. 'Arriving at Pickup': Triggered when rider is within 300m of customer address.
  2. 'Picked Up from Customer': Triggered upon bag tamper-seal scan or customer OTP confirmation.
  3. 'Delivered to Tailor': Triggered when atelier confirms receipt of fabric bag.
  4. 'Delivered to Customer': Verified via 4-digit customer doorstep OTP.`,
  },
  {
    id: 'sop-tailor-workbench-lifecycle',
    source: 'tailoring_sop',
    title: 'Tailor Atelier Workbench Workflow & Safety Gates',
    category: 'atelier_standards',
    keywords: ['workbench', 'tailor', 'alteration', 'customer call', 'consultation', 'cutting', 'progress', 'photo', 'stitching'],
    metadata: { requiredConsultation: true, requiredPhotoEvidence: true },
    content: `Trench Atelier Operational Guidelines:
- Gate 1 (Customer Consultation): Before initiating alteration, tailor MUST contact customer via recorded phone consultation to verify fit preference (Slim, Regular, Relaxed) and special instructions.
- Gate 2 (In-Progress Update): Alterations exceeding ₹300 payout require at least one photo upload of work-in-progress on the workbench.
- Gate 3 (Completion Clearance): Tailor uploads finished garment photo. Tailor Workflow Agent validates finish against requested color grade and dimensions before unlocking second-leg delivery dispatch.`,
  },
  {
    id: 'sop-pricing-payout-structure',
    source: 'platform_policy',
    title: 'Transparent Pricing & Split Payout Formula',
    category: 'finance_policy',
    keywords: ['pricing', 'payout', 'tailor payout', 'delivery payout', 'inr', 'ledger', 'commission'],
    metadata: { platformMarginPct: 15 },
    content: `Trench Payout Matrix:
- Tailor Payout:
  * Minor Hemming/Tapering: ₹180 - ₹250
  * Formal Blazer/Coat Alteration: ₹350 - ₹550
  * Full Suit Tailoring/Restyling: ₹500 - ₹900
  * Ethnic Wear/Lehenga Sizing: ₹320 - ₹600
- Delivery Payout: Base ₹50 for first 2 km + ₹12/km thereafter + ₹25 urgent pickup bonus.
- Split Settlement: Tailor and Delivery partner ledgers are credited instantly upon OTP delivery confirmation.`,
  },
  {
    id: 'sop-exception-mitigation',
    source: 'platform_policy',
    title: 'Exception Handling & Automated Mitigation Hierarchy',
    category: 'exception_management',
    keywords: ['exception', 'delay', 'rider unavailable', 'stuck', 'missing measurement', 'unreachable', 'escalation'],
    metadata: { escalationLevels: 3 },
    content: `Trench Multi-Agent Exception Handling SOP:
- Severity 'warning':
  * Rider delayed > 15 mins: Dispatch Agent searches secondary standby partners within 8 km.
  * Customer unreachable for consultation: Communication Agent sends WhatsApp & SMS reminder with 1-click measurement confirmation link.
- Severity 'critical':
  * Fabric mismatch or damage reported: Exception Agent immediately freezes workbench, alerts human operations lead, and initiates customer insurance claim.
  * No rider within 15 km: Reassigns pickup slot and adjusts customer ETA transparently.`,
  },
];

export class TrenchRagService {
  private indexedDocuments: Map<string, RagDocument> = new Map();

  constructor() {
    this.reindexStaticDocuments();
  }

  private reindexStaticDocuments() {
    for (const doc of PLATFORM_KNOWLEDGE) {
      this.indexedDocuments.set(doc.id, doc);
    }
  }

  /**
   * Synchronizes dynamic runtime database entities into the RAG index
   */
  public ingestRuntimeState(data: {
    orders?: TailorOrder[];
    tasks?: DeliveryTask[];
    tailorProfiles?: Record<string, TailorProfile>;
    deliveryProfiles?: Record<string, DeliveryPartnerProfile>;
    livePartners?: PartnerLiveLocation[];
    notifications?: PartnerNotification[];
    ledger?: LedgerTransaction[];
  }) {
    this.reindexStaticDocuments();

    // 1. Ingest Orders
    if (data.orders) {
      for (const ord of data.orders) {
        const id = `rag-order-${ord.id}`;
        const measurementsText = ord.sizeChart
          ? `Chest: ${ord.sizeChart.chestInches || 'N/A'}", Waist: ${ord.sizeChart.waistInches || 'N/A'}", Shoulder: ${ord.sizeChart.shoulderInches || 'N/A'}", Sleeve: ${ord.sizeChart.sleeveLengthInches || 'N/A'}", Fit: ${ord.sizeChart.fitPreference || 'Standard'}`
          : 'No measurements specified';

        const content = [
          `Order Reference: ${ord.orderNumber} (ID: ${ord.id})`,
          `Status: ${ord.orderStatus || ord.stage} | Stage: ${ord.stage}`,
          `Customer: ${ord.customerName} | Phone: ${ord.customerPhone} | Address: ${ord.customerAddress}`,
          `Garment to Alter: ${ord.clothToBeAltered} - ${ord.clothDescription || 'Standard alteration'}`,
          `Measurements Spec: ${measurementsText}`,
          `Color & Fabric: Shade ${ord.colorGrade?.shadeName || 'Navy'}, Finish: ${ord.colorGrade?.fabricFinish || 'Cotton'}`,
          `Special Instructions: ${ord.noteToTailor || 'None'}`,
          `Atelier Workshop: ${ord.tailorShopName || 'Atelier'} at ${ord.tailorShopAddress || 'Workshop'}`,
          `Financials: Tailor Payout ₹${ord.tailorPayoutINR}, Delivery Payout ₹${ord.deliveryPayoutINR}`,
          `First Leg Status: ${ord.firstDeliveryStatus || 'N/A'}, Second Leg Status: ${ord.secondDeliveryStatus || 'N/A'}`,
          `Consultation Completed: ${ord.customerContacted ? 'Yes (Verified)' : 'Pending'}`,
        ].join('\n');

        const keywords = [
          ord.orderNumber.toLowerCase(),
          ord.id.toLowerCase(),
          ord.customerName.toLowerCase(),
          (ord.clothToBeAltered || '').toLowerCase(),
          (ord.stage || '').toLowerCase(),
          (ord.tailorShopName || '').toLowerCase(),
          'order',
          'alteration',
        ];

        this.indexedDocuments.set(id, {
          id,
          source: 'order',
          title: `Order ${ord.orderNumber}: ${ord.clothToBeAltered} for ${ord.customerName}`,
          category: 'orders',
          content,
          metadata: {
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            stage: ord.stage,
            customerName: ord.customerName,
            tailorShopName: ord.tailorShopName,
            tailorPayoutINR: ord.tailorPayoutINR,
            deliveryPayoutINR: ord.deliveryPayoutINR,
          },
          keywords,
        });
      }
    }

    // 2. Ingest Delivery Tasks
    if (data.tasks) {
      for (const t of data.tasks) {
        const id = `rag-task-${t.id}`;
        const content = [
          `Delivery Task: ${t.title} (${t.orderNumber})`,
          `Category: ${t.category} | Status: ${t.status} | Stage: ${t.deliveryStage || 'first_delivery'}`,
          `Customer: ${t.customerName} | Phone: ${t.customerPhone}`,
          `Pickup Address: ${t.pickupAddress}`,
          `Drop Address: ${t.dropAddress}`,
          `Garment Summary: ${t.garmentSummary}`,
          `Distance: ${t.distanceKm} km | ETA: ${t.etaMinutes} mins | Payout: ₹${t.payoutINR}`,
          `Assigned Partner: ${t.assignedPartnerName || 'Unassigned'} (${t.assignedPartnerPhone || 'N/A'})`,
        ].join('\n');

        this.indexedDocuments.set(id, {
          id,
          source: 'task',
          title: `Delivery Task ${t.orderNumber}: ${t.title}`,
          category: 'logistics',
          content,
          metadata: {
            taskId: t.id,
            orderNumber: t.orderNumber,
            status: t.status,
            distanceKm: t.distanceKm,
            payoutINR: t.payoutINR,
          },
          keywords: [
            t.orderNumber.toLowerCase(),
            t.id.toLowerCase(),
            t.customerName.toLowerCase(),
            t.status.toLowerCase(),
            'delivery',
            'task',
            'rider',
          ],
        });
      }
    }

    // 3. Ingest Live Delivery Partners
    if (data.livePartners) {
      for (const p of data.livePartners) {
        const id = `rag-partner-${p.partnerId}`;
        const content = [
          `Delivery Partner: ${p.partnerName} (${p.partnerPhone})`,
          `Vehicle: ${p.vehicleType || 'EV'} (${p.vehicleNumber || 'Unregistered'})`,
          `Online Status: ${p.isOnline ? 'ONLINE (Ready for dispatch)' : 'OFFLINE'}`,
          `Coordinates: Lat ${p.lat ?? 'N/A'}, Lng ${p.lng ?? 'N/A'}`,
          `Service Radius: ${p.serviceRadiusKm} km`,
          `Last Ping: ${p.updatedAt}`,
        ].join('\n');

        this.indexedDocuments.set(id, {
          id,
          source: 'delivery_partner',
          title: `Delivery Partner Profile: ${p.partnerName}`,
          category: 'fleet',
          content,
          metadata: {
            partnerId: p.partnerId,
            partnerPhone: p.partnerPhone,
            isOnline: p.isOnline,
            vehicleType: p.vehicleType,
          },
          keywords: [
            p.partnerId.toLowerCase(),
            p.partnerPhone.toLowerCase(),
            p.partnerName.toLowerCase(),
            p.vehicleType?.toLowerCase() || 'ev',
            p.isOnline ? 'online' : 'offline',
            'partner',
            'fleet',
          ],
        });
      }
    }
  }

  /**
   * Hybrid RAG Retrieval: Token overlap + semantic weight + entity boost
   */
  public query(queryText: string, options?: {
    orderId?: string;
    category?: string;
    source?: RagDocument['source'];
    topK?: number;
  }): RagQueryResult[] {
    const rawTokens = (queryText || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const topK = options?.topK || 5;
    const scoredResults: RagQueryResult[] = [];

    for (const doc of this.indexedDocuments.values()) {
      // Source & category filters
      if (options?.source && doc.source !== options.source) continue;
      if (options?.category && doc.category !== options.category) continue;
      if (options?.orderId && doc.metadata?.orderId && doc.metadata.orderId !== options.orderId) {
        // If query specifically asks for order, keep priority on matched order
      }

      let score = 0;
      const docContentLower = doc.content.toLowerCase();
      const docTitleLower = doc.title.toLowerCase();

      // Explicit order number match bonus
      if (options?.orderId && doc.metadata?.orderId === options.orderId) {
        score += 50;
      }

      for (const token of rawTokens) {
        // Keyword hit
        if (doc.keywords.some((kw) => kw.includes(token))) {
          score += 6;
        }
        // Title hit
        if (docTitleLower.includes(token)) {
          score += 10;
        }
        // Content hit
        if (docContentLower.includes(token)) {
          score += 3;
        }
      }

      if (score > 0) {
        // Build concise snippet around highest match
        const snippet = doc.content.slice(0, 320) + (doc.content.length > 320 ? '...' : '');
        scoredResults.push({
          document: doc,
          score,
          snippet,
          relevanceReason: `Score: ${score} (Matched tokens: ${rawTokens.filter((t) => docContentLower.includes(t) || docTitleLower.includes(t)).join(', ')})`,
        });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, topK);
  }

  /**
   * Generates factual RAG Context string to inject directly into Agent/LLM prompts
   */
  public buildPromptContext(queryText: string, targetOrderId?: string): string {
    const results = this.query(queryText, { orderId: targetOrderId, topK: 4 });
    if (results.length === 0) {
      return 'No specific database records matched the query. Rely strictly on verified platform policies.';
    }

    const sections = results.map((r, idx) => {
      return `[FACTUAL CONTEXT #${idx + 1} | Source: ${r.document.source.toUpperCase()} | ID: ${r.document.id}]\n${r.document.content}\n`;
    });

    return sections.join('\n----------------------------------------\n');
  }

  /**
   * Diagnostic index stats
   */
  public getStats() {
    const countsBySource: Record<string, number> = {};
    for (const doc of this.indexedDocuments.values()) {
      countsBySource[doc.source] = (countsBySource[doc.source] || 0) + 1;
    }
    return {
      totalDocuments: this.indexedDocuments.size,
      countsBySource,
    };
  }
}

// Global Singleton for Server Lifecycle
export const trenchRagService = new TrenchRagService();
