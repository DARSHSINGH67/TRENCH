import { eq, desc } from 'drizzle-orm';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { getDb } from './index.ts';
import {
  deliveryProfiles,
  tailorProfiles,
  tailorOrders,
  deliveryTasks,
  notifications,
  ledgerTransactions,
  deliveryOffers,
  partnerLocations,
  users,
} from './schema.ts';
import {
  DeliveryPartnerProfile,
  TailorProfile,
  TailorOrder,
  DeliveryTask,
  PartnerNotification,
  LedgerTransaction,
  IncomingDeliveryOffer,
  PartnerLiveLocation,
} from '../types/appTypes.ts';

const DEFAULT_SUPABASE_URL = 'https://nedcyrdglahskrifquxh.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_Q0Rjmwx_6sE6_x0Zs3mEqw_jJMXlfYQ';

function getServerSupabase(): SupabaseClient | null {
  try {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const match = rawUrl?.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
    const url = match ? match[0] : DEFAULT_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_KEY;
    if (!url || !key) return null;
    return createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

// In-memory fallback stores used when Cloud SQL is not configured
const memoryUsers = new Map<string, { id: number; uid: string; email: string; phone: string; role: string; createdAt: Date }>();
const memoryDeliveryProfiles = new Map<string, DeliveryPartnerProfile>();
const memoryTailorProfiles = new Map<string, TailorProfile>();
const memoryTailorOrders = new Map<string, TailorOrder>();
const memoryDeliveryTasks = new Map<string, DeliveryTask>();
const memoryNotifications = new Map<string, PartnerNotification>();
const memoryLedgerTransactions = new Map<string, LedgerTransaction>();
const memoryPartnerLocations = new Map<string, PartnerLiveLocation>();
const memoryDeliveryOffers = new Map<string, IncomingDeliveryOffer>();

const syntheticOrderNumbers = new Set([
  'TRN-8821', 'TRN-8824', 'TRN-8819', 'TRN-8830', 'TRN-8815', 'TRN-8818', 'TRN-8812', 'TRN-8805', 'TRN-8794',
  'TRN-6528', 'TRN-4674', 'TRN-2714', 'TRN-4290', 'TRN-5108', 'TRN-7392', 'TRN-8410', 'TRN-1001',
]);

function mapSupabaseOrderRow(r: any): TailorOrder {
  let sizeChart = {
    chestInches: '38',
    waistInches: '32',
    shoulderInches: '18',
    sleeveLengthInches: '25',
    garmentLengthInches: '30',
    neckCollarInches: '15.5',
    fitPreference: 'Slim Tailored' as const,
  };
  let colorGrade: any = {
    shadeName: 'Classic Navy Blue',
    hexCode: '#000080',
    pantoneRef: 'PANTONE 19-3832 TCX',
    fabricFinish: 'Matte Cotton Twill',
  };
  let workflowMeta: any = {};
  try {
    if (typeof r.size_chart_json === 'string') sizeChart = JSON.parse(r.size_chart_json);
    else if (r.size_chart_json) sizeChart = r.size_chart_json;
  } catch {}
  try {
    const rawColor =
      typeof r.color_grade_json === 'string'
        ? JSON.parse(r.color_grade_json)
        : r.color_grade_json;
    if (rawColor && rawColor._workflow) {
      workflowMeta = rawColor._workflow;
      const { _workflow, ...restColor } = rawColor;
      colorGrade = restColor;
    } else if (rawColor) {
      colorGrade = rawColor;
    }
  } catch {}

  return {
    id: r.order_id,
    orderNumber: r.order_number,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerAddress: r.customer_address,
    clothToBeAltered: r.cloth_to_be_altered,
    clothDescription: r.cloth_description || '',
    sizeChart,
    colorGrade,
    noteToTailor: r.note_to_tailor || '',
    stage: (r.stage as any) || 'incoming',
    tailorPayoutINR: Number(r.tailor_payout_inr) || 220,
    deliveryPayoutINR: Number(r.delivery_payout_inr) || 85,
    tailorShopName: r.tailor_shop_name,
    tailorShopAddress: r.tailor_shop_address,
    placedAt: r.placed_at,
    completedAt: r.completed_at || undefined,
    pickupDispatched: Boolean(r.pickup_dispatched),
    ...workflowMeta,
  };
}

function mapSupabaseTaskRow(r: any): DeliveryTask {
  let mapCoords = { x: 50, y: 50 };
  let taskWorkflowMeta: any = {};
  let recordedMeasurements = undefined;
  try {
    const rawCoords =
      typeof r.map_coords_json === 'string'
        ? JSON.parse(r.map_coords_json)
        : r.map_coords_json;
    if (rawCoords && rawCoords._taskWorkflow) {
      taskWorkflowMeta = rawCoords._taskWorkflow;
      mapCoords = { x: rawCoords.x ?? 50, y: rawCoords.y ?? 50 };
    } else if (rawCoords) {
      mapCoords = rawCoords;
    }
  } catch {}
  try {
    if (typeof r.recorded_measurements_json === 'string') {
      recordedMeasurements = JSON.parse(r.recorded_measurements_json);
    } else if (r.recorded_measurements_json) {
      recordedMeasurements = r.recorded_measurements_json;
    }
  } catch {}

  return {
    id: r.task_id,
    orderNumber: r.order_number,
    category: r.category as any,
    title: r.title,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    pickupAddress: r.pickup_address,
    dropAddress: r.drop_address,
    garmentSummary: r.garment_summary,
    payoutINR: Number(r.payout_inr) || 85,
    distanceKm: parseFloat(r.distance_km || '2.5') || 2.5,
    etaMinutes: Number(r.eta_minutes) || 15,
    status: r.status as any,
    linkedTailorOrderId: r.linked_tailor_order_id || undefined,
    isUrgentTailorPickup: Boolean(r.is_urgent_tailor_pickup),
    mapCoords,
    recordedMeasurements,
    ...taskWorkflowMeta,
  };
}

// User helper
export async function getOrCreateUser(
  uid: string,
  email?: string,
  phone?: string,
  role: string = 'delivery'
) {
  const db = getDb();
  if (db) {
    try {
      const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (existing.length > 0) {
        return existing[0];
      }
      const [inserted] = await db
        .insert(users)
        .values({
          uid,
          email: email || '',
          phone: phone || '',
          role,
        })
        .returning();
      return inserted;
    } catch (error) {
      console.warn('Cloud SQL getOrCreateUser fallback:', (error as any)?.message || error);
    }
  }

  const cached = memoryUsers.get(uid);
  if (cached) return cached;

  const fallbackUser = {
    id: memoryUsers.size + 1,
    uid,
    email: email || '',
    phone: phone || '',
    role,
    createdAt: new Date(),
  };
  memoryUsers.set(uid, fallbackUser);
  return fallbackUser;
}

// Delivery Profile
export async function getDeliveryProfile(phone: string): Promise<DeliveryPartnerProfile | null> {
  const db = getDb();
  if (db) {
    try {
      const records = await db
        .select()
        .from(deliveryProfiles)
        .where(eq(deliveryProfiles.phone, phone))
        .limit(1);

      if (records.length === 0) return null;
      const r = records[0];

      return {
        documentType: (r.documentType as any) || 'Aadhaar Card',
        documentNumber: r.documentNumber || '',
        documentUploaded: r.documentUploaded || false,
        documentFileName: r.documentFileName || '',
        documentPreviewUrl: r.documentPreviewUrl || '',
        aadhaarStatus: (r.aadhaarStatus as any) || 'Pending',
        panNumber: r.panNumber || '',
        panUploaded: r.panUploaded || false,
        panFileName: r.panFileName || '',
        panPreviewUrl: r.panPreviewUrl || '',
        panStatus: (r.panStatus as any) || 'Pending',
        drivingLicenseUploaded: r.drivingLicenseUploaded || false,
        drivingLicenseFileName: r.drivingLicenseFileName || '',
        drivingLicensePreviewUrl: r.drivingLicensePreviewUrl || '',
        vehicleNumber: r.vehicleNumber || '',
        vehicleType: (r.vehicleType as any) || 'EV',
        fullName: r.fullName || '',
        phoneNumber: r.phone,
        gmailAddress: r.gmailAddress || '',
        residentialAddress: r.residentialAddress || '',
        pincode: r.pincode || '',
        partnerPhotoUrl: r.partnerPhotoUrl || '',
        partnerPhotoPreviewUrl: r.partnerPhotoPreviewUrl || '',
        upiId: r.upiId || '',
        bankAccountNumber: r.bankAccountNumber || '',
        verified: r.verified || false,
        adminApproved: r.adminApproved || false,
        tutorialCompleted: r.tutorialCompleted || false,
      };
    } catch (error) {
      console.warn('Cloud SQL getDeliveryProfile fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('delivery_profiles')
        .select('*')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        return {
          documentType: (data.document_type as any) || 'Aadhaar Card',
          documentNumber: data.document_number || '',
          documentUploaded: Boolean(data.document_uploaded),
          documentFileName: data.document_file_name || '',
          documentPreviewUrl: data.document_preview_url || '',
          aadhaarStatus: (data.aadhaar_status as any) || 'Pending',
          panNumber: data.pan_number || '',
          panUploaded: Boolean(data.pan_uploaded),
          panFileName: data.pan_file_name || '',
          panPreviewUrl: data.pan_preview_url || '',
          panStatus: (data.pan_status as any) || 'Pending',
          drivingLicenseUploaded: Boolean(data.driving_license_uploaded),
          drivingLicenseFileName: data.driving_license_file_name || '',
          drivingLicensePreviewUrl: data.driving_license_preview_url || '',
          vehicleNumber: data.vehicle_number || '',
          vehicleType: (data.vehicle_type as any) || 'EV',
          fullName: data.full_name || '',
          phoneNumber: data.phone,
          gmailAddress: data.gmail_address || '',
          residentialAddress: data.residential_address || '',
          pincode: data.pincode || '',
          partnerPhotoUrl: data.partner_photo_url || '',
          partnerPhotoPreviewUrl: data.partner_photo_preview_url || '',
          upiId: data.upi_id || '',
          bankAccountNumber: data.bank_account_number || '',
          verified: Boolean(data.verified),
          adminApproved: Boolean(data.admin_approved),
          tutorialCompleted: Boolean(data.tutorial_completed),
        };
      }
    } catch {}
  }

  return memoryDeliveryProfiles.get(phone) || null;
}

export async function upsertDeliveryProfile(p: DeliveryPartnerProfile) {
  const key = p.phoneNumber || p.gmailAddress || 'current_user';
  memoryDeliveryProfiles.set(key, p);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(deliveryProfiles)
        .where(eq(deliveryProfiles.phone, key))
        .limit(1);

      const values = {
        phone: key,
        fullName: p.fullName || '',
        documentType: p.documentType || 'Aadhaar Card',
        documentNumber: p.documentNumber || '',
        documentUploaded: p.documentUploaded || false,
        documentFileName: p.documentFileName || '',
        documentPreviewUrl: p.documentPreviewUrl || '',
        aadhaarStatus: p.aadhaarStatus || 'Pending',
        panNumber: p.panNumber || '',
        panUploaded: p.panUploaded || false,
        panFileName: p.panFileName || '',
        panPreviewUrl: p.panPreviewUrl || '',
        panStatus: p.panStatus || 'Pending',
        drivingLicenseUploaded: p.drivingLicenseUploaded || false,
        drivingLicenseFileName: p.drivingLicenseFileName || '',
        drivingLicensePreviewUrl: p.drivingLicensePreviewUrl || '',
        vehicleNumber: p.vehicleNumber || '',
        vehicleType: p.vehicleType || 'EV',
        gmailAddress: p.gmailAddress || '',
        residentialAddress: p.residentialAddress || '',
        pincode: p.pincode || '',
        partnerPhotoUrl: p.partnerPhotoUrl || '',
        partnerPhotoPreviewUrl: p.partnerPhotoPreviewUrl || '',
        upiId: p.upiId || '',
        bankAccountNumber: p.bankAccountNumber || '',
        verified: p.verified || false,
        adminApproved: p.adminApproved || false,
        tutorialCompleted: p.tutorialCompleted || false,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db
          .update(deliveryProfiles)
          .set(values)
          .where(eq(deliveryProfiles.phone, key));
      } else {
        await db.insert(deliveryProfiles).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertDeliveryProfile fallback:', (error as any)?.message || error);
    }
  }
  return p;
}

// Tailor Profile
export async function getTailorProfile(phone: string): Promise<TailorProfile | null> {
  const db = getDb();
  if (db) {
    try {
      const records = await db
        .select()
        .from(tailorProfiles)
        .where(eq(tailorProfiles.phone, phone))
        .limit(1);

      if (records.length === 0) return null;
      const r = records[0];

      return {
        documentType: r.documentType || '',
        documentNumber: r.documentNumber || '',
        documentUploaded: r.documentUploaded || false,
        documentFileName: r.documentFileName || '',
        documentPreviewUrl: r.documentPreviewUrl || '',
        shopName: r.shopName || '',
        specialty: (r.specialty as any) || 'Stitching',
        liveCameraCaptured: r.liveCameraCaptured || false,
        liveCameraTimestamp: r.liveCameraTimestamp || '',
        liveCameraDataUrl: r.liveCameraDataUrl || '',
        verified: r.verified || false,
        adminApproved: r.adminApproved || false,
      };
    } catch (error) {
      console.warn('Cloud SQL getTailorProfile fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tailor_profiles')
        .select('*')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        return {
          documentType: data.document_type || '',
          documentNumber: data.document_number || '',
          documentUploaded: Boolean(data.document_uploaded),
          documentFileName: data.document_file_name || '',
          documentPreviewUrl: data.document_preview_url || '',
          shopName: data.shop_name || '',
          specialty: (data.specialty as any) || 'Stitching',
          liveCameraCaptured: Boolean(data.live_camera_captured),
          liveCameraTimestamp: data.live_camera_timestamp || '',
          liveCameraDataUrl: data.live_camera_data_url || '',
          verified: Boolean(data.verified),
          adminApproved: Boolean(data.admin_approved),
        };
      }
    } catch {}
  }

  return memoryTailorProfiles.get(phone) || null;
}

export async function upsertTailorProfile(phone: string, p: TailorProfile) {
  memoryTailorProfiles.set(phone, p);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(tailorProfiles)
        .where(eq(tailorProfiles.phone, phone))
        .limit(1);

      const values = {
        phone,
        shopName: p.shopName || '',
        specialty: p.specialty || 'Stitching',
        documentType: p.documentType || '',
        documentNumber: p.documentNumber || '',
        documentUploaded: p.documentUploaded || false,
        documentFileName: p.documentFileName || '',
        documentPreviewUrl: p.documentPreviewUrl || '',
        liveCameraCaptured: p.liveCameraCaptured || false,
        liveCameraTimestamp: p.liveCameraTimestamp || '',
        liveCameraDataUrl: p.liveCameraDataUrl || '',
        verified: p.verified || false,
        adminApproved: p.adminApproved || false,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(tailorProfiles).set(values).where(eq(tailorProfiles.phone, phone));
      } else {
        await db.insert(tailorProfiles).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertTailorProfile fallback:', (error as any)?.message || error);
    }
  }
  return p;
}

// Tailor Orders
export async function getTailorOrders(): Promise<TailorOrder[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(tailorOrders).orderBy(desc(tailorOrders.createdAt));
      return rows.map((r) => {
        let sizeChart = {
          chestInches: '38',
          waistInches: '32',
          shoulderInches: '18',
          sleeveLengthInches: '25',
          garmentLengthInches: '30',
          neckCollarInches: '15.5',
          fitPreference: 'Slim Tailored' as const,
        };
        let colorGrade: any = {
          shadeName: 'Classic Navy Blue',
          hexCode: '#000080',
          pantoneRef: 'PANTONE 19-3832 TCX',
          fabricFinish: 'Matte Cotton Twill',
        };
        let workflowMeta: any = {};
        try {
          if (r.sizeChartJson) sizeChart = JSON.parse(r.sizeChartJson);
        } catch {}
        try {
          if (r.colorGradeJson) {
            const parsed = JSON.parse(r.colorGradeJson);
            if (parsed && parsed._workflow) {
              workflowMeta = parsed._workflow;
              const { _workflow, ...restColor } = parsed;
              colorGrade = restColor;
            } else if (parsed) {
              colorGrade = parsed;
            }
          }
        } catch {}

        return {
          id: r.orderId,
          orderNumber: r.orderNumber,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          customerAddress: r.customerAddress,
          clothToBeAltered: r.clothToBeAltered,
          clothDescription: r.clothDescription || '',
          sizeChart,
          colorGrade,
          noteToTailor: r.noteToTailor || '',
          stage: r.stage as any,
          tailorPayoutINR: r.tailorPayoutINR,
          deliveryPayoutINR: r.deliveryPayoutINR,
          tailorShopName: r.tailorShopName,
          tailorShopAddress: r.tailorShopAddress,
          placedAt: r.placedAt,
          completedAt: r.completedAt || undefined,
          pickupDispatched: r.pickupDispatched || false,
          ...workflowMeta,
        };
      });
    } catch (error) {
      console.warn('Cloud SQL getTailorOrders fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tailor_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map(mapSupabaseOrderRow);
      }
    } catch {}
  }

  return Array.from(memoryTailorOrders.values());
}

export async function upsertTailorOrder(order: TailorOrder) {
  memoryTailorOrders.set(order.id, order);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(tailorOrders)
        .where(eq(tailorOrders.orderId, order.id))
        .limit(1);

      const workflowMeta = {
        selectedService: order.selectedService,
        needsTailor: order.needsTailor,
        orderStatus: order.orderStatus,
        firstDeliveryStatus: order.firstDeliveryStatus,
        secondDeliveryStatus: order.secondDeliveryStatus,
        firstDeliveryPartner: order.firstDeliveryPartner,
        secondDeliveryPartner: order.secondDeliveryPartner,
        customerLocation: order.customerLocation,
        tailorLocation: order.tailorLocation,
        workbench: order.workbench,
        customerContacted: order.customerContacted,
        customerCalledAt: order.customerCalledAt,
        workStartedAt: order.workStartedAt,
        progressUpdates: order.progressUpdates,
        timeline: order.timeline,
      };

      const values = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        clothToBeAltered: order.clothToBeAltered,
        clothDescription: order.clothDescription || '',
        sizeChartJson: JSON.stringify(order.sizeChart),
        colorGradeJson: JSON.stringify({
          ...order.colorGrade,
          _workflow: workflowMeta,
        }),
        noteToTailor: order.noteToTailor || '',
        stage: order.stage,
        tailorPayoutINR: order.tailorPayoutINR,
        deliveryPayoutINR: order.deliveryPayoutINR,
        tailorShopName: order.tailorShopName,
        tailorShopAddress: order.tailorShopAddress,
        placedAt: order.placedAt,
        completedAt: order.completedAt || null,
        pickupDispatched: order.pickupDispatched || false,
      };

      if (existing.length > 0) {
        await db.update(tailorOrders).set(values).where(eq(tailorOrders.orderId, order.id));
      } else {
        await db.insert(tailorOrders).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertTailorOrder fallback:', (error as any)?.message || error);
    }
  }
  return order;
}

// Delivery Tasks
export async function getDeliveryTasks(): Promise<DeliveryTask[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(deliveryTasks).orderBy(desc(deliveryTasks.createdAt));
      return rows.map((r) => {
        let mapCoords = { x: 50, y: 50 };
        let taskWorkflowMeta: any = {};
        let recordedMeasurements = undefined;
        try {
          if (r.mapCoordsJson) {
            const parsed = JSON.parse(r.mapCoordsJson);
            if (parsed && parsed._taskWorkflow) {
              taskWorkflowMeta = parsed._taskWorkflow;
              mapCoords = { x: parsed.x ?? 50, y: parsed.y ?? 50 };
            } else if (parsed) {
              mapCoords = parsed;
            }
          }
        } catch {}
        try {
          if (r.recordedMeasurementsJson) {
            recordedMeasurements = JSON.parse(r.recordedMeasurementsJson);
          }
        } catch {}

        return {
          id: r.taskId,
          orderNumber: r.orderNumber,
          category: r.category as any,
          title: r.title,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          pickupAddress: r.pickupAddress,
          dropAddress: r.dropAddress,
          garmentSummary: r.garmentSummary,
          payoutINR: r.payoutINR,
          distanceKm: parseFloat(r.distanceKm || '2.5') || 2.5,
          etaMinutes: r.etaMinutes || 15,
          status: r.status as any,
          linkedTailorOrderId: r.linkedTailorOrderId || undefined,
          isUrgentTailorPickup: r.isUrgentTailorPickup || false,
          mapCoords,
          recordedMeasurements,
          ...taskWorkflowMeta,
        };
      });
    } catch (error) {
      console.warn('Cloud SQL getDeliveryTasks fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map(mapSupabaseTaskRow);
      }
    } catch {}
  }

  return Array.from(memoryDeliveryTasks.values());
}

export async function upsertDeliveryTask(task: DeliveryTask) {
  memoryDeliveryTasks.set(task.id, task);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(deliveryTasks)
        .where(eq(deliveryTasks.taskId, task.id))
        .limit(1);

      const taskWorkflowMeta = {
        deliveryStage: task.deliveryStage,
        selectedService: task.selectedService,
        tailorShopName: task.tailorShopName,
        tailorShopAddress: task.tailorShopAddress,
        assignedPartnerId: task.assignedPartnerId,
        assignedPartnerName: task.assignedPartnerName,
        assignedPartnerPhone: task.assignedPartnerPhone,
        assignedAt: task.assignedAt,
        pickedUpAt: task.pickedUpAt,
        deliveredAt: task.deliveredAt,
        pickupLocationCoords: task.pickupLocationCoords,
        dropLocationCoords: task.dropLocationCoords,
        deliveryHistory: task.deliveryHistory,
      };

      const values = {
        taskId: task.id,
        orderNumber: task.orderNumber,
        category: task.category,
        title: task.title,
        customerName: task.customerName,
        customerPhone: task.customerPhone,
        pickupAddress: task.pickupAddress,
        dropAddress: task.dropAddress,
        garmentSummary: task.garmentSummary,
        payoutINR: task.payoutINR,
        distanceKm: String(task.distanceKm),
        etaMinutes: task.etaMinutes,
        status: task.status,
        linkedTailorOrderId: task.linkedTailorOrderId || null,
        isUrgentTailorPickup: task.isUrgentTailorPickup || false,
        mapCoordsJson: JSON.stringify({
          ...task.mapCoords,
          _taskWorkflow: taskWorkflowMeta,
        }),
        recordedMeasurementsJson: task.recordedMeasurements
          ? JSON.stringify(task.recordedMeasurements)
          : null,
      };

      if (existing.length > 0) {
        await db.update(deliveryTasks).set(values).where(eq(deliveryTasks.taskId, task.id));
      } else {
        await db.insert(deliveryTasks).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertDeliveryTask fallback:', (error as any)?.message || error);
    }
  }
  return task;
}

// Notifications
export async function getNotifications(): Promise<PartnerNotification[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
      return rows.map((r) => ({
        id: r.notifId,
        orderNumber: r.orderNumber,
        linkedOrderId: r.linkedOrderId,
        tailorShopName: r.tailorShopName,
        tailorAddress: r.tailorAddress,
        customerName: r.customerName,
        clothToBeAltered: r.clothToBeAltered,
        message: r.message,
        timestamp: r.timestamp,
        acknowledged: r.acknowledged || false,
        payoutINR: r.payoutINR,
      }));
    } catch (error) {
      console.warn('Cloud SQL getNotifications fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          id: r.notif_id,
          orderNumber: r.order_number,
          linkedOrderId: r.linked_order_id,
          tailorShopName: r.tailor_shop_name,
          tailorAddress: r.tailor_address,
          customerName: r.customer_name,
          clothToBeAltered: r.cloth_to_be_altered,
          message: r.message,
          timestamp: r.timestamp,
          acknowledged: Boolean(r.acknowledged),
          payoutINR: Number(r.payout_inr) || 85,
        }));
      }
    } catch {}
  }

  return Array.from(memoryNotifications.values());
}

export async function upsertNotification(n: PartnerNotification) {
  memoryNotifications.set(n.id, n);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(notifications)
        .where(eq(notifications.notifId, n.id))
        .limit(1);

      const values = {
        notifId: n.id,
        orderNumber: n.orderNumber,
        linkedOrderId: n.linkedOrderId,
        tailorShopName: n.tailorShopName,
        tailorAddress: n.tailorAddress,
        customerName: n.customerName,
        clothToBeAltered: n.clothToBeAltered,
        message: n.message,
        timestamp: n.timestamp,
        acknowledged: n.acknowledged || false,
        payoutINR: n.payoutINR,
      };

      if (existing.length > 0) {
        await db.update(notifications).set(values).where(eq(notifications.notifId, n.id));
      } else {
        await db.insert(notifications).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertNotification fallback:', (error as any)?.message || error);
    }
  }
  return n;
}

// Ledger Transactions
export async function getLedgerTransactions(): Promise<LedgerTransaction[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(ledgerTransactions).orderBy(desc(ledgerTransactions.createdAt));
      return rows.map((r) => ({
        id: r.txId,
        role: r.role as any,
        orderNumber: r.orderNumber,
        description: r.description,
        categoryLabel: r.categoryLabel,
        amountINR: r.amountINR,
        timestamp: r.timestamp,
        status: r.status as any,
      }));
    } catch (error) {
      console.warn('Cloud SQL getLedgerTransactions fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ledger_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          id: r.tx_id,
          role: r.role as any,
          orderNumber: r.order_number,
          description: r.description,
          categoryLabel: r.category_label,
          amountINR: Number(r.amount_inr) || 0,
          timestamp: r.timestamp,
          status: r.status as any,
        }));
      }
    } catch {}
  }

  return Array.from(memoryLedgerTransactions.values());
}

export async function addLedgerTransaction(tx: LedgerTransaction) {
  memoryLedgerTransactions.set(tx.id, tx);

  const db = getDb();
  if (db) {
    try {
      await db.insert(ledgerTransactions).values({
        txId: tx.id,
        role: tx.role,
        orderNumber: tx.orderNumber,
        description: tx.description,
        categoryLabel: tx.categoryLabel,
        amountINR: tx.amountINR,
        timestamp: tx.timestamp,
        status: tx.status,
      });
    } catch (error) {
      console.warn('Cloud SQL addLedgerTransaction fallback:', (error as any)?.message || error);
    }
  }
  return tx;
}

// Purge synthetic sample records if present
export async function seedAllDataIfEmpty() {
  for (const [k, o] of memoryTailorOrders.entries()) {
    if (syntheticOrderNumbers.has(o.orderNumber)) memoryTailorOrders.delete(k);
  }
  for (const [k, t] of memoryDeliveryTasks.entries()) {
    if (syntheticOrderNumbers.has(t.orderNumber)) memoryDeliveryTasks.delete(k);
  }
  for (const [k, n] of memoryNotifications.entries()) {
    if (syntheticOrderNumbers.has(n.orderNumber)) memoryNotifications.delete(k);
  }
  for (const [k, l] of memoryLedgerTransactions.entries()) {
    if (syntheticOrderNumbers.has(l.orderNumber)) memoryLedgerTransactions.delete(k);
  }

  const db = getDb();
  if (!db) return;

  try {
    const syntheticOrderIds = [
      'ord-101', 'ord-102', 'ord-103', 'ord-104',
      'ord-trn-6528', 'ord-trn-4674', 'ord-trn-2714', 'ord-trn-4290', 'ord-trn-5108', 'ord-trn-7392', 'ord-trn-8410', 'ord-trn-1001',
    ];
    const syntheticTaskIds = [
      'task-101', 'task-102', 'task-103',
      'task-trn-6528', 'task-trn-4674', 'task-trn-2714', 'task-trn-4290', 'task-trn-5108', 'task-trn-7392', 'task-trn-8410', 'task-trn-1001',
    ];
    const syntheticNotifIds = [
      'notif-101', 'notif-102',
      'notif-trn-6528', 'notif-trn-4674', 'notif-trn-2714', 'notif-trn-4290',
    ];
    const syntheticTxIds = [
      'tx-init-1', 'tx-init-2', 'tx-del-sample-1', 'tx-del-sample-2', 'tx-del-sample-3', 'tx-del-sample-4', 'tx-del-sample-5',
      'tx-del-trn-6528', 'tx-del-trn-4674', 'tx-del-trn-2714', 'tx-del-trn-4290', 'tx-del-trn-5108', 'tx-del-trn-7392',
      'tx-tailor-trn-4674', 'tx-tailor-trn-5108', 'tx-tailor-trn-6528', 'tx-tailor-trn-2714',
    ];

    for (const num of syntheticOrderNumbers) {
      await db.delete(tailorOrders).where(eq(tailorOrders.orderNumber, num)).catch(() => {});
      await db.delete(deliveryTasks).where(eq(deliveryTasks.orderNumber, num)).catch(() => {});
      await db.delete(notifications).where(eq(notifications.orderNumber, num)).catch(() => {});
      await db.delete(ledgerTransactions).where(eq(ledgerTransactions.orderNumber, num)).catch(() => {});
    }

    for (const id of syntheticOrderIds) {
      await db.delete(tailorOrders).where(eq(tailorOrders.orderId, id)).catch(() => {});
    }
    for (const id of syntheticTaskIds) {
      await db.delete(deliveryTasks).where(eq(deliveryTasks.taskId, id)).catch(() => {});
    }
    for (const id of syntheticNotifIds) {
      await db.delete(notifications).where(eq(notifications.notifId, id)).catch(() => {});
    }
    for (const id of syntheticTxIds) {
      await db.delete(ledgerTransactions).where(eq(ledgerTransactions.txId, id)).catch(() => {});
    }
  } catch (error) {
    console.warn('Purge synthetic data warning (non-fatal):', (error as any)?.message || error);
  }
}

export async function upsertPartnerLocationDb(loc: PartnerLiveLocation) {
  memoryPartnerLocations.set(loc.partnerId, loc);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(partnerLocations)
        .where(eq(partnerLocations.partnerId, loc.partnerId))
        .limit(1);

      const values = {
        partnerId: loc.partnerId,
        partnerPhone: loc.partnerPhone,
        partnerName: loc.partnerName || 'Delivery Partner',
        vehicleType: loc.vehicleType || 'EV',
        vehicleNumber: loc.vehicleNumber || '',
        isOnline: loc.isOnline,
        lat: loc.lat !== null && loc.lat !== undefined ? String(loc.lat) : null,
        lng: loc.lng !== null && loc.lng !== undefined ? String(loc.lng) : null,
        serviceRadiusKm: loc.serviceRadiusKm || 15,
        updatedAt: new Date(loc.updatedAt || Date.now()),
      };

      if (existing.length > 0) {
        await db
          .update(partnerLocations)
          .set(values)
          .where(eq(partnerLocations.partnerId, loc.partnerId));
      } else {
        await db.insert(partnerLocations).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertPartnerLocationDb fallback:', (error as any)?.message || error);
    }
  }
  return loc;
}

export async function getAllPartnerLocationsDb(): Promise<PartnerLiveLocation[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(partnerLocations)
        .orderBy(desc(partnerLocations.updatedAt));
      return rows.map((r) => ({
        partnerId: r.partnerId,
        partnerPhone: r.partnerPhone,
        partnerName: r.partnerName,
        vehicleType: r.vehicleType || 'EV',
        vehicleNumber: r.vehicleNumber || '',
        isOnline: Boolean(r.isOnline),
        lat: r.lat !== null ? parseFloat(r.lat) : null,
        lng: r.lng !== null ? parseFloat(r.lng) : null,
        serviceRadiusKm: r.serviceRadiusKm || 15,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date().toISOString(),
      }));
    } catch (error) {
      console.warn('Cloud SQL getAllPartnerLocationsDb fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('partner_locations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          partnerId: r.partner_id,
          partnerPhone: r.partner_phone,
          partnerName: r.partner_name,
          vehicleType: r.vehicle_type || 'EV',
          vehicleNumber: r.vehicle_number || '',
          isOnline: Boolean(r.is_online),
          lat: r.lat !== null && r.lat !== undefined ? Number(r.lat) : null,
          lng: r.lng !== null && r.lng !== undefined ? Number(r.lng) : null,
          serviceRadiusKm: Number(r.service_radius_km) || 15,
          updatedAt: r.updated_at || new Date().toISOString(),
        }));
      }
    } catch {}
  }

  return Array.from(memoryPartnerLocations.values());
}

export async function upsertDeliveryOfferDb(offer: IncomingDeliveryOffer) {
  memoryDeliveryOffers.set(offer.offerId, offer);

  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(deliveryOffers)
        .where(eq(deliveryOffers.offerId, offer.offerId))
        .limit(1);

      const values = {
        offerId: offer.offerId,
        orderId: offer.orderId,
        orderNumber: offer.orderNumber,
        taskId: offer.taskId || null,
        partnerId: offer.partnerId,
        partnerPhone: offer.partnerPhone,
        customerName: offer.customerName,
        customerPhone: offer.customerPhone || '',
        restaurantName: offer.restaurantName,
        orderAmountINR: offer.orderAmountINR,
        estimatedEarningsINR: offer.estimatedEarningsINR,
        pickupAddress: offer.pickupAddress,
        deliveryAddress: offer.deliveryAddress,
        pickupLat: offer.pickupCoords ? String(offer.pickupCoords.lat) : null,
        pickupLng: offer.pickupCoords ? String(offer.pickupCoords.lng) : null,
        deliveryLat: offer.deliveryCoords ? String(offer.deliveryCoords.lat) : null,
        deliveryLng: offer.deliveryCoords ? String(offer.deliveryCoords.lng) : null,
        distanceKm: String(offer.distanceKm),
        etaMinutes: offer.etaMinutes,
        garmentSummary: offer.garmentSummary || '',
        deliveryStage: offer.deliveryStage || 'first_delivery',
        status: offer.status,
        expiresAt: new Date(offer.expiresAt),
        respondedAt: offer.respondedAt ? new Date(offer.respondedAt) : null,
      };

      if (existing.length > 0) {
        await db
          .update(deliveryOffers)
          .set(values)
          .where(eq(deliveryOffers.offerId, offer.offerId));
      } else {
        await db.insert(deliveryOffers).values(values);
      }
    } catch (error) {
      console.warn('Cloud SQL upsertDeliveryOfferDb fallback:', (error as any)?.message || error);
    }
  }
  return offer;
}

export async function getDeliveryOffersDb(): Promise<IncomingDeliveryOffer[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(deliveryOffers)
        .orderBy(desc(deliveryOffers.createdAt));
      return rows.map((r) => ({
        offerId: r.offerId,
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        taskId: r.taskId || undefined,
        partnerId: r.partnerId,
        partnerPhone: r.partnerPhone,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerPhoneAuthorized: r.status === 'accepted',
        restaurantName: r.restaurantName,
        orderAmountINR: r.orderAmountINR,
        estimatedEarningsINR: r.estimatedEarningsINR,
        pickupAddress: r.pickupAddress,
        deliveryAddress: r.deliveryAddress,
        pickupCoords:
          r.pickupLat && r.pickupLng
            ? { lat: parseFloat(r.pickupLat), lng: parseFloat(r.pickupLng) }
            : null,
        deliveryCoords:
          r.deliveryLat && r.deliveryLng
            ? { lat: parseFloat(r.deliveryLat), lng: parseFloat(r.deliveryLng) }
            : null,
        distanceKm: parseFloat(r.distanceKm || '0') || 0,
        etaMinutes: r.etaMinutes || 15,
        garmentSummary: r.garmentSummary || '',
        deliveryStage: (r.deliveryStage as any) || 'first_delivery',
        status: r.status as any,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
      }));
    } catch (error) {
      console.warn('Cloud SQL getDeliveryOffersDb fallback:', (error as any)?.message || error);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('delivery_offers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          offerId: r.offer_id,
          orderId: r.order_id,
          orderNumber: r.order_number,
          taskId: r.task_id || undefined,
          partnerId: r.partner_id,
          partnerPhone: r.partner_phone,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          customerPhoneAuthorized: r.status === 'accepted',
          restaurantName: r.restaurant_name,
          orderAmountINR: Number(r.order_amount_inr) || 0,
          estimatedEarningsINR: Number(r.estimated_earnings_inr) || 0,
          pickupAddress: r.pickup_address,
          deliveryAddress: r.delivery_address,
          pickupCoords:
            r.pickup_lat !== null && r.pickup_lng !== null && r.pickup_lat !== undefined && r.pickup_lng !== undefined
              ? { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) }
              : null,
          deliveryCoords:
            r.delivery_lat !== null && r.delivery_lng !== null && r.delivery_lat !== undefined && r.delivery_lng !== undefined
              ? { lat: Number(r.delivery_lat), lng: Number(r.delivery_lng) }
              : null,
          distanceKm: parseFloat(r.distance_km || '0') || 0,
          etaMinutes: Number(r.eta_minutes) || 15,
          garmentSummary: r.garment_summary || '',
          deliveryStage: (r.delivery_stage as any) || 'first_delivery',
          status: r.status as any,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
          respondedAt: r.responded_at || null,
        }));
      }
    } catch {}
  }

  return Array.from(memoryDeliveryOffers.values());
}
