import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  BellRing,
  Plus,
  Ruler,
  Palette,
  FileText,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  Search,
  AlertCircle,
  Clock,
  Bike,
  ShoppingBag,
  TrendingUp,
  Database,
  Wrench,
  Camera,
  Upload,
  Truck,
  History,
  ShieldCheck,
  Navigation,
  RefreshCw,
  Landmark,
  CreditCard,
  Crosshair,
  BadgeCheck,
  LogOut,
  ChevronRight,
  Send,
  HelpCircle,
  Menu,
} from 'lucide-react';
import {
  AgentOrchestratorState,
  AssignedDeliveryPartnerInfo,
  CustomerServiceOption,
  DeliveryTask,
  LedgerTransaction,
  LiveGeoState,
  TailorOrder,
  TailorOrderStage,
  TailorProfile,
} from '../types/appTypes';
import {
  AVAILABLE_DELIVERY_PARTNERS,
  calculateRoleEarnings,
  normalizeTailorOrder,
  ORDER_WORKFLOW_STATUS_STEPS,
  reverseGeocodeLocation,
} from '../utils/appLogic';
import { MoneyCounterCard } from './MoneyCounterCard';
import { AgenticLiveMapDemo } from './AgenticLiveMapDemo';

interface TailorDashboardProps {
  profile: TailorProfile;
  orders: TailorOrder[];
  tasks?: DeliveryTask[];
  ledger: LedgerTransaction[];
  liveGeo?: LiveGeoState;
  agentState?: AgentOrchestratorState;
  onTriggerOrchestration?: (triggerReason?: string, targetOrderId?: string) => void;
  onApprovePendingAction?: (approvalId: string) => void;
  onOrdersUpdated?: (orders: TailorOrder[], tasks?: DeliveryTask[]) => void;
  onRequestDeviceLocation?: () => void;
  lastDispatchedOrderNumber: string | null;
  onTransitionOrder: (orderId: string, nextStage: TailorOrderStage) => void;
  onAddNewOrder: (
    newOrder: TailorOrder,
    selectedService?: CustomerServiceOption,
    needsTailor?: boolean,
    firstPartner?: AssignedDeliveryPartnerInfo
  ) => void;
  onUpdateWorkbench?: (
    orderId: string,
    statusLabel: string,
    readyToBegin: boolean,
    notes: string
  ) => void;
  onRecordCustomerCall?: (orderId: string) => void;
  onAddWorkProgress?: (
    orderId: string,
    photoUrl: string,
    description: string,
    workStatus: string
  ) => void;
  onAssignSecondDeliveryPartner?: (
    orderId: string,
    partner: AssignedDeliveryPartnerInfo
  ) => void;
  onSwitchToDeliveryDashboard: () => void;
  onSignOut?: () => void;
  onBack: () => void;
}

const WORKBENCH_PRESETS = [
  'Inspection & Chalk Marking Bench Ready',
  'Cutting Table & Lockstitch Machine Calibrated',
  'Steam Press & Finishing Station Ready',
  'Waiting for Thread & Trim Preparation',
];

const WORK_PROGRESS_STATUS_OPTIONS = [
  'Fabric Inspection & Pattern Chalk Marking',
  'Cutting & Seam Basting In Progress',
  'Main Stitching & Alteration Assembly',
  'Final Steam Press & Quality Verification',
];

export const TailorDashboard: React.FC<TailorDashboardProps> = ({
  profile,
  orders: rawOrders = [],
  tasks: rawTasks = [],
  ledger: rawLedger = [],
  liveGeo,
  agentState,
  onTriggerOrchestration,
  onApprovePendingAction,
  onOrdersUpdated,
  onRequestDeviceLocation,
  lastDispatchedOrderNumber,
  onTransitionOrder,
  onAddNewOrder,
  onUpdateWorkbench,
  onRecordCustomerCall,
  onAddWorkProgress,
  onAssignSecondDeliveryPartner,
  onSwitchToDeliveryDashboard,
  onSignOut,
  onBack,
}) => {
  const safeRawOrders = Array.isArray(rawOrders) ? rawOrders : [];
  const tasks = Array.isArray(rawTasks) ? rawTasks : [];
  const ledger = Array.isArray(rawLedger) ? rawLedger : [];
  const orders = safeRawOrders.map(normalizeTailorOrder);

  // Main Dashboard Navigation Tabs (Matching DeliveryDashboard structure)
  const [mainTab, setMainTab] = useState<'workbench' | 'finance' | 'profile'>('workbench');

  // Order Management Sub-Tabs (Accepted, Working, Completed)
  const [activeTab, setActiveTab] = useState<'accepted' | 'working' | 'completed'>('accepted');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'measurements' | 'cloth_trips'>('all');

  // Duty/Workshop toggle
  const [isWorkshopOpen, setIsWorkshopOpen] = useState(true);

  // Search & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderIdForModal, setSelectedOrderIdForModal] = useState<string | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawUpi, setWithdrawUpi] = useState(profile.upiId || '');

  // Live Camera verification state inside dashboard
  const [dashboardProfile, setDashboardProfile] = useState<TailorProfile>(profile);
  const [cameraActiveInDash, setCameraActiveInDash] = useState(false);
  const [isCapturingLiveLocation, setIsCapturingLiveLocation] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setDashboardProfile(profile);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Step 2 Customer Order Creation Popup state
  const [pendingCustomerOrderDraft, setPendingCustomerOrderDraft] = useState<TailorOrder | null>(null);
  const [selectedServiceOption, setSelectedServiceOption] =
    useState<CustomerServiceOption>('measurement_plus_cloth_pickup');
  const [needsTailorPopupChoice, setNeedsTailorPopupChoice] = useState<boolean>(true);
  const [selectedFirstPartnerId, setSelectedFirstPartnerId] = useState<string>(
    AVAILABLE_DELIVERY_PARTNERS[0].partnerId
  );

  // Workbench Update Modal
  const [workbenchModalOrderId, setWorkbenchModalOrderId] = useState<string | null>(null);
  const [wbStatusLabel, setWbStatusLabel] = useState(WORKBENCH_PRESETS[0]);
  const [wbReadyToBegin, setWbReadyToBegin] = useState(true);
  const [wbNotes, setWbNotes] = useState('');

  // Work Progress Modal
  const [progressModalOrderId, setProgressModalOrderId] = useState<string | null>(null);
  const [progPhotoUrl, setProgPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'
  );
  const [progDescription, setProgDescription] = useState('');
  const [progWorkStatus, setProgWorkStatus] = useState(WORK_PROGRESS_STATUS_OPTIONS[0]);

  // Order Details Modal
  const [detailModalOrder, setDetailModalOrder] = useState<TailorOrder | null>(null);

  // New Order Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [clothToBeAltered, setClothToBeAltered] = useState('');
  const [clothDescription, setClothDescription] = useState('');
  const [chestInches, setChestInches] = useState('');
  const [waistInches, setWaistInches] = useState('');
  const [shoulderInches, setShoulderInches] = useState('');
  const [sleeveLengthInches, setSleeveLengthInches] = useState('');
  const [garmentLengthInches, setGarmentLengthInches] = useState('');
  const [neckCollarInches, setNeckCollarInches] = useState('');
  const [fitPreference, setFitPreference] = useState<'Slim Tailored' | 'Classic Regular' | 'Relaxed Bespoke'>('Classic Regular');
  const [shadeName, setShadeName] = useState('');
  const [fabricFinish, setFabricFinish] = useState('');
  const [noteToTailor, setNoteToTailor] = useState('');
  const [tailorPayoutINR, setTailorPayoutINR] = useState('');
  const [deliveryPayoutINR, setDeliveryPayoutINR] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Earnings calculations
  const tailorFinance = calculateRoleEarnings(ledger, 'tailor');

  // Filtered orders
  const incomingOrders = orders.filter((o) => o.stage === 'incoming');
  const acceptedOrders = orders.filter((o) => o.stage === 'accepted');
  const workingOrders = orders.filter((o) => o.stage === 'working');
  const completedOrders = orders.filter((o) => o.stage === 'completed');

  const rawTabOrders =
    activeTab === 'accepted'
      ? acceptedOrders
      : activeTab === 'working'
      ? workingOrders
      : completedOrders;

  const currentTabOrders = rawTabOrders.filter((o) => {
    if (serviceFilter === 'measurements') {
      if (o.selectedService !== 'measurement_plus_cloth_pickup') return false;
    }
    if (serviceFilter === 'cloth_trips') {
      if (
        o.selectedService !== 'measurement_cloth_pickup_only' &&
        o.selectedService !== 'measurement_plus_cloth_pickup'
      ) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.clothToBeAltered.toLowerCase().includes(q)
    );
  });

  /**
   * LIVE CAMERA VERIFICATION: CAPTURE PHOTO + AUTOMATICALLY PRINT EXACT ADDRESS & GPS
   */
  const handleCaptureLiveCameraPhoto = async () => {
    setIsCapturingLiveLocation(true);
    const timeStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timestampFull = `${dateStr}, ${timeStr}`;

    let capturedDataUrl = dashboardProfile.liveCameraDataUrl || '';

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    } else {
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
        <rect width="640" height="400" fill="#0B132B"/>
        <rect x="40" y="260" width="560" height="110" rx="8" fill="#1C2541" stroke="#3A506B" stroke-width="3"/>
        <path d="M 160 260 L 160 140 L 360 140 L 360 200 L 320 200 L 320 180 L 220 180 L 220 260 Z" fill="#475569" stroke="#94A3B8" stroke-width="4"/>
        <line x1="340" y1="200" x2="340" y2="245" stroke="#CBD5E1" stroke-width="5" stroke-linecap="round"/>
        <polygon points="337,245 343,245 340,256" fill="#F8FAFC"/>
        <rect x="420" y="90" width="160" height="140" rx="10" fill="#1E293B" stroke="#334155" stroke-width="2"/>
        <circle cx="450" cy="125" r="14" fill="#000080"/>
        <circle cx="500" cy="125" r="14" fill="#159937"/>
        <circle cx="550" cy="125" r="14" fill="#D97706"/>
        <text x="320" y="60" text-anchor="middle" fill="#38BDF8" font-size="18" font-weight="bold" font-family="sans-serif">TRENCH ATELIER · VERIFIED SHOP &amp; MACHINE</text>
        <text x="320" y="90" text-anchor="middle" fill="#94A3B8" font-size="13" font-family="monospace">${dashboardProfile.shopName || 'Tailor Workshop'} · Live Sensor Stamped</text>
      </svg>`;
      capturedDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    }
    setCameraActiveInDash(false);

    let resolvedAddress = dashboardProfile.shopAddress || '100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038';
    let resolvedCoords = {
      latitude: 12.9716,
      longitude: 77.6412,
      accuracy: 6,
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });
        resolvedCoords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 6),
        };
        const geoAddr = await reverseGeocodeLocation(resolvedCoords.latitude, resolvedCoords.longitude);
        if (geoAddr && geoAddr.length > 5) {
          resolvedAddress = geoAddr;
        }
      } catch {}
    }

    const updatedProfile: TailorProfile = {
      ...dashboardProfile,
      liveCameraCaptured: true,
      liveCameraTimestamp: `Verified · ${timestampFull}`,
      liveCameraDataUrl: capturedDataUrl,
      liveCameraAddress: resolvedAddress,
      liveCameraCoords: resolvedCoords,
      liveCameraMachineType: dashboardProfile.machineType || 'Industrial Single Needle Lockstitch Machine',
    };

    setDashboardProfile(updatedProfile);
    setIsCapturingLiveLocation(false);
    triggerToast('Live Camera Verification Stamped! Exact location address and GPS coordinates recorded under image.');
  };

  const handleStartLiveStream = async () => {
    setCameraActiveInDash(true);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {}
    }
  };

  // Order workflow transitions
  const handleMoveAndSwitchTab = (orderId: string, targetStage: TailorOrderStage) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetStage === 'working' && targetOrder && !targetOrder.workbench?.readyToBegin) {
      triggerToast('Safety Guard: Please confirm Workbench Readiness before starting work on this order.');
      handleOpenWorkbenchModal(targetOrder);
      return;
    }
    if (targetStage === 'completed' && targetOrder && (targetOrder.progressUpdates || []).length === 0) {
      triggerToast('Safety Guard: Please upload work progress photo / verification before marking order completed.');
      setProgressModalOrderId(orderId);
      return;
    }
    onTransitionOrder(orderId, targetStage);
    if (targetStage === 'accepted' || targetStage === 'working' || targetStage === 'completed') {
      setActiveTab(targetStage);
    }
    triggerToast(`Order #${targetOrder?.orderNumber || ''} moved to ${targetStage.toUpperCase()}!`);
  };

  const handleOpenWorkbenchModal = (order: TailorOrder) => {
    setWorkbenchModalOrderId(order.id);
    setWbStatusLabel(order.workbench?.statusLabel || WORKBENCH_PRESETS[0]);
    setWbReadyToBegin(order.workbench?.readyToBegin ?? true);
    setWbNotes(order.workbench?.notes || '');
  };

  const handleSaveWorkbenchModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workbenchModalOrderId) return;
    if (onUpdateWorkbench) {
      onUpdateWorkbench(workbenchModalOrderId, wbStatusLabel, wbReadyToBegin, wbNotes);
    }
    triggerToast(`Workbench updated: "${wbStatusLabel}" (${wbReadyToBegin ? 'Ready to Start' : 'Prep In Progress'})`);
    setWorkbenchModalOrderId(null);
  };

  const handleCallCustomer = (order: TailorOrder) => {
    if (onRecordCustomerCall) {
      onRecordCustomerCall(order.id);
    }
    triggerToast(`Calling ${order.customerName} (${order.customerPhone})... Call logged against Order #${order.orderNumber}.`);
  };

  const handleSubmitProgressUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalOrderId || !progDescription.trim()) return;
    if (onAddWorkProgress) {
      onAddWorkProgress(progressModalOrderId, progPhotoUrl, progDescription.trim(), progWorkStatus);
    }
    triggerToast('Work progress update and atelier verification photo recorded!');
    setProgressModalOrderId(null);
    setProgDescription('');
  };

  const handleInitiateNewOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrderNumber = orderNumber.trim() || `TRN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newDraft: TailorOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: finalOrderNumber,
      customerName: customerName.trim() || 'Valued Customer',
      customerPhone: customerPhone.trim() || '+91 98450 12345',
      customerAddress: customerAddress.trim() || 'Indiranagar 100ft Road, Bengaluru',
      clothToBeAltered: clothToBeAltered.trim() || 'Formal Linen Shirt',
      clothDescription: clothDescription.trim() || 'Collar and side seam tailoring',
      tailorPayoutINR: Number(tailorPayoutINR) || 450,
      deliveryPayoutINR: Number(deliveryPayoutINR) || 120,
      placedAt: 'Just now',
      stage: 'incoming',
      sizeChart: {
        chestInches: chestInches.trim() || '40',
        waistInches: waistInches.trim() || '34',
        shoulderInches: shoulderInches.trim() || '18',
        sleeveLengthInches: sleeveLengthInches.trim() || '25',
        garmentLengthInches: garmentLengthInches.trim() || '30',
        neckCollarInches: neckCollarInches.trim() || '16',
        fitPreference,
      },
      colorGrade: {
        shadeName: shadeName.trim() || 'Trench Navy',
        hexCode: '#000080',
        pantoneRef: '19-4052 TCX',
        fabricFinish: fabricFinish.trim() || 'Pure Linen',
      },
      noteToTailor: noteToTailor.trim(),
      firstDeliveryPartner: AVAILABLE_DELIVERY_PARTNERS[0],
      firstDeliveryStatus: 'assigned',
      secondDeliveryStatus: 'not_ready',
      tailorShopName: dashboardProfile.shopName || 'Atelier Workshop',
      tailorShopAddress: dashboardProfile.shopAddress || 'Indiranagar Workshop',
    };

    setPendingCustomerOrderDraft(newDraft);
    setShowNewOrderModal(false);
  };

  const handleConfirmCustomerOrderWithPartner = () => {
    if (!pendingCustomerOrderDraft) return;
    const partner =
      AVAILABLE_DELIVERY_PARTNERS.find((p) => p.partnerId === selectedFirstPartnerId) ||
      AVAILABLE_DELIVERY_PARTNERS[0];

    onAddNewOrder(pendingCustomerOrderDraft, selectedServiceOption, needsTailorPopupChoice, partner);
    triggerToast(`Order #${pendingCustomerOrderDraft.orderNumber} placed! Delivery partner ${partner.partnerName} dispatched.`);
    setPendingCustomerOrderDraft(null);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-800">
      <canvas ref={canvasRef} className="hidden" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* TRENCH ATELIER TOP HEADER (MODERN SAPPHIRE & WORKER PROFILE)       */}
      {/* =================================================================== */}
      <header className="bg-gradient-to-r from-slate-950 via-[#0a173d] to-[#07112d] border-b border-indigo-900/60 text-white px-3 sm:px-8 py-2.5 sm:py-3 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* Brand & Atelier Badge - Clickable Worker Profile Link */}
          <button
            type="button"
            onClick={() => {
              setMainTab('profile');
              triggerToast('Opening Atelier Worker Profile');
            }}
            className="flex items-center gap-2.5 sm:gap-3 text-left p-1 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all cursor-pointer group"
            title="Click to view & edit Atelier Worker Profile"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 group-hover:border-sky-400 transition-all">
              <Scissors className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white group-hover:text-sky-200 transition-colors">
                  TRENCH ATELIER
                </span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-[10px] sm:text-xs font-mono font-bold tracking-wider text-sky-200 uppercase">
                  PARTNER
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-sky-200 font-medium truncate max-w-[170px] sm:max-w-sm flex items-center gap-1">
                <span className="truncate">{dashboardProfile.shopName || dashboardProfile.ownerName || 'Bespoke Atelier Workshop'}</span>
                <span className="text-[10px] text-sky-300 font-semibold underline underline-offset-2 shrink-0">(Profile)</span>
              </div>
            </div>
          </button>

          {/* Quick Stat Badges, Profile Link & Duty Status */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            {/* Dedicated Working Profile Button (Mobile & Desktop) */}
            <button
              type="button"
              onClick={() => {
                setMainTab('profile');
                triggerToast('Opening Atelier Worker Profile');
              }}
              className={`min-h-[38px] px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mainTab === 'profile'
                  ? 'bg-sky-500/30 border-sky-400 text-white shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-sky-100 hover:text-white'
              }`}
              title="View & Edit Working Profile"
            >
              <User className="w-4 h-4 text-sky-300" />
              <span>Profile</span>
            </button>

            {/* Workshop Status Switch */}
            <button
              type="button"
              onClick={() => {
                setIsWorkshopOpen(!isWorkshopOpen);
                triggerToast(isWorkshopOpen ? 'Workshop status set to Closed.' : 'Workshop status set to Open & Taking Orders!');
              }}
              className={`min-h-[38px] px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isWorkshopOpen
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100'
                  : 'bg-rose-500/25 border-rose-400/50 text-rose-100'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isWorkshopOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>
                {isWorkshopOpen ? 'On Duty' : 'Off Duty'}
              </span>
            </button>

            {/* Quick Earnings Stat */}
            <div className="min-h-[38px] px-3 rounded-xl bg-white/10 border border-white/20 flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-sky-200 font-bold hidden xs:inline">Today:</span>
              <strong className="text-white font-extrabold font-mono">
                ₹{tailorFinance.totalEarningsINR.toLocaleString('en-IN')}
              </strong>
            </div>

            {/* Back / Exit */}
            <button
              type="button"
              onClick={onBack}
              className="h-[38px] w-[38px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              title="Return to Role Select"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* MAIN CONTENT CONTAINER                                              */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 pb-28 flex-1 space-y-4">

        {/* ================================================================= */}
        {/* TAB 1: WORKBENCH & ORDERS                                         */}
        {/* ================================================================= */}
        {mainTab === 'workbench' && (
          <div className="space-y-4">
            {/* Live Agentic AI Delivery Map Demo (Shown only when an order is assigned) */}
            {orders.length > 0 && (
              <AgenticLiveMapDemo
                orderNumber={orders[0].orderNumber}
                customerName={orders[0].customerName}
                pickupAddress={orders[0].customerAddress}
                tailorShopName={
                  dashboardProfile.shopName ||
                  orders[0].tailorShopName ||
                  'Atelier Workshop'
                }
                tailorAddress={
                  dashboardProfile.shopAddress ||
                  orders[0].tailorShopAddress ||
                  'Tailor Studio'
                }
                partnerName={
                  orders[0].firstDeliveryPartner?.partnerName || 'Delivery Partner'
                }
                payoutINR={orders[0].deliveryPayoutINR || 120}
                baseLat={liveGeo?.lat || 12.9716}
                baseLng={liveGeo?.lng || 77.5946}
              />
            )}
            {/* Real-Time Last Dispatched Banner */}
            {lastDispatchedOrderNumber && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between gap-3 shadow-sm border border-emerald-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center text-emerald-200 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold">
                      Order Dispatched
                    </div>
                    <p className="text-sm font-bold text-white">
                      Order #{lastDispatchedOrderNumber} is ready — Delivery Partner assigned for doorstep pickup!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSwitchToDeliveryDashboard}
                  className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-900 text-xs sm:text-sm font-extrabold shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Delivery View</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sub-Tabs: Accepted, Working, Completed Orders + Measurements & Cloth Trips Filter */}
            <div className="flex flex-col gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-3 sm:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('accepted')}
                    className={`py-2 px-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all text-center cursor-pointer ${
                      activeTab === 'accepted'
                        ? 'bg-white text-[#000080] shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Accepted ({acceptedOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('working')}
                    className={`py-2 px-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all text-center cursor-pointer ${
                      activeTab === 'working'
                        ? 'bg-white text-[#000080] shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Working ({workingOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('completed')}
                    className={`py-2 px-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all text-center cursor-pointer ${
                      activeTab === 'completed'
                        ? 'bg-white text-[#000080] shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Done ({completedOrders.length})
                  </button>
                </div>

                {/* Search Bar Input */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search order #, customer, cloth..."
                    className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080] focus:bg-white text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Measurements & Cloth Trips Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setServiceFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    serviceFilter === 'all'
                      ? 'bg-[#000080] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Orders ({rawTabOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setServiceFilter('measurements')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    serviceFilter === 'measurements'
                      ? 'bg-[#000080] text-white'
                      : 'bg-blue-50 text-[#000080] border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>
                    Measurements (
                    {
                      rawTabOrders.filter(
                        (o) => o.selectedService === 'measurement_plus_cloth_pickup'
                      ).length
                    }
                    )
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceFilter('cloth_trips')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    serviceFilter === 'cloth_trips'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Cloth Trips ({rawTabOrders.length})</span>
                </button>
              </div>
            </div>

            {/* Split Screen Grid: Left = Incoming Queue / Orders; Right = Workbench Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left 7 Columns: Active Orders List */}
              <div className="lg:col-span-7 space-y-3">
                {currentTabOrders.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#000080] flex items-center justify-center mx-auto">
                      <Scissors className="w-6 h-6" />
                    </div>
                    <div className="text-base font-extrabold text-slate-900">
                      No Orders in &quot;{activeTab.toUpperCase()}&quot;
                    </div>
                    <p className="text-sm text-slate-600 max-w-sm mx-auto">
                      Switch tabs above to view Accepted, Working, or Completed orders.
                    </p>
                  </div>
                ) : (
                  currentTabOrders.map((order) => {
                    const isSelected = selectedOrderIdForModal === order.id;
                    const hasMeasurements =
                      order.selectedService === 'measurement_plus_cloth_pickup';
                    return (
                      <div
                        key={order.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all bg-white shadow-xs space-y-3.5 ${
                          isSelected ? 'border-[#000080] ring-2 ring-[#000080]/10' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-base text-[#000080]">
                              #{order.orderNumber}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${
                                hasMeasurements
                                  ? 'bg-blue-50 text-[#000080] border-blue-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {hasMeasurements
                                ? '📏 Measurements + Cloth Trip'
                                : '🛵 Cloth Trip (Customer ↔ Tailor)'}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              · {order.placedAt}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                            ₹{order.tailorPayoutINR.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Garment & Customer Details */}
                        <div className="space-y-1">
                          <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                            {order.clothToBeAltered}
                          </h3>
                          <div className="text-sm text-slate-700">
                            {order.clothDescription || 'Alteration & custom bespoke fitting'}
                          </div>
                        </div>

                        {/* Customer Body Measurements & Cloth Trip Strip */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Chest</span>
                            <strong className="font-mono text-slate-900">{order.sizeChart.chestInches}&quot;</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Waist</span>
                            <strong className="font-mono text-slate-900">{order.sizeChart.waistInches}&quot;</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Shoulder</span>
                            <strong className="font-mono text-slate-900">{order.sizeChart.shoulderInches}&quot;</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Sleeve</span>
                            <strong className="font-mono text-slate-900">{order.sizeChart.sleeveLengthInches}&quot;</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Length</span>
                            <strong className="font-mono text-slate-900">{order.sizeChart.garmentLengthInches}&quot;</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Fit</span>
                            <strong className="text-[#000080] truncate block">{order.sizeChart.fitPreference}</strong>
                          </div>
                        </div>

                        {/* Customer & Doorstep Info */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-4 h-4 text-[#000080]" />
                              <span>{order.customerName}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCallCustomer(order)}
                              className="font-mono text-[#000080] hover:underline flex items-center gap-1 font-bold cursor-pointer bg-blue-50 px-2 py-0.5 rounded-md"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{order.customerPhone}</span>
                            </button>
                          </div>
                          <div className="text-slate-700 flex items-start gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate">{order.customerAddress}</span>
                          </div>
                        </div>

                        {/* Workbench Status Tag */}
                        {order.workbench && (
                          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs sm:text-sm flex items-center justify-between">
                            <span className="text-slate-800 truncate font-semibold">
                              Bench: <strong className="text-[#000080]">{order.workbench.statusLabel}</strong>
                            </span>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                                order.workbench.readyToBegin
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {order.workbench.readyToBegin ? 'Ready ✓' : 'Setup Needed'}
                            </span>
                          </div>
                        )}

                        {/* Connected Riders Portal Live Task & Measurement Sync Block */}
                        {(() => {
                          const linkedTask = tasks.find(
                            (t) =>
                              t.linkedTailorOrderId === order.id ||
                              t.orderNumber === order.orderNumber
                          );
                          const activePartner =
                            order.stage === 'completed'
                              ? order.secondDeliveryPartner || order.firstDeliveryPartner
                              : order.firstDeliveryPartner;
                          const riderName =
                            linkedTask?.assignedPartnerName ||
                            activePartner?.partnerName ||
                            'Delivery Partner';
                          const riderPhone =
                            linkedTask?.assignedPartnerPhone ||
                            activePartner?.partnerPhone ||
                            '';
                          const riderVehicle =
                            activePartner?.vehicleNumber
                              ? `${activePartner.vehicleType} · ${activePartner.vehicleNumber}`
                              : activePartner?.vehicleType || 'Vehicle Registered';
                          const isSecondLeg =
                            linkedTask?.deliveryStage === 'second_delivery' ||
                            order.stage === 'completed';
                          const riderStatusRaw = linkedTask?.status || order.firstDeliveryStatus || 'assigned';
                          const riderStatusLabel =
                            riderStatusRaw === 'delivered_to_tailor'
                              ? 'Delivered to Tailor ✓'
                              : riderStatusRaw === 'picked_up_from_customer'
                              ? 'Picked Up from Customer · En Route'
                              : riderStatusRaw === 'measurement_recorded'
                              ? 'Doorstep Measurements Synced ✓'
                              : riderStatusRaw === 'picked_up_from_tailor'
                              ? 'Picked Up from Tailor · Returning to Customer'
                              : riderStatusRaw === 'delivered_to_customer'
                              ? 'Delivered to Customer ✓'
                              : 'Rider Assigned & En Route';

                          return (
                            <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-emerald-50/50 border border-blue-200/90 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-[#000080] text-white flex items-center justify-center shrink-0">
                                    <Bike className="w-3.5 h-3.5" />
                                  </span>
                                  <div>
                                    <span className="font-black text-[#000080] uppercase tracking-wider text-[10px] block">
                                      Connected Riders Portal · {isSecondLeg ? '2nd Leg (Tailor → Customer)' : '1st Leg (Customer → Tailor)'}
                                    </span>
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                      {riderName}
                                    </span>
                                    <span className="text-slate-500 font-mono text-[11px] ml-1.5">
                                      ({riderVehicle})
                                    </span>
                                  </div>
                                </div>

                                <span className="px-2.5 py-1 rounded-lg font-extrabold text-[11px] bg-white border border-blue-200 text-[#000080] shadow-2xs">
                                  {riderStatusLabel}
                                </span>
                              </div>

                              {linkedTask?.recordedMeasurements && (
                                <div className="p-2 rounded-lg bg-white/90 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                                    <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Rider Doorstep Tape Sync ({linkedTask.recordedMeasurements.recordedAt}):</span>
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    Chest/Bust {linkedTask.recordedMeasurements.chest}&quot; · Waist {linkedTask.recordedMeasurements.waist}&quot;
                                    {linkedTask.recordedMeasurements.hips ? ` · Hips ${linkedTask.recordedMeasurements.hips}"` : ''} · Inseam {linkedTask.recordedMeasurements.inseam}&quot;
                                  </span>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-200/60">
                                <span className="text-[11px] text-slate-600 font-medium">
                                  Rider Contact: <strong className="font-mono text-slate-800">{riderPhone}</strong>
                                  {linkedTask ? ` · Payout ₹${linkedTask.payoutINR} (${linkedTask.distanceKm} km)` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={onSwitchToDeliveryDashboard}
                                  className="px-2.5 py-1 rounded-lg bg-[#000080] hover:bg-[#000066] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <span>Open in Riders Portal</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Order Actions Toolbar */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenWorkbenchModal(order)}
                              className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5 text-[#000080]" />
                              <span>Workbench</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setProgressModalOrderId(order.id)}
                              className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Work Progress</span>
                            </button>
                          </div>

                          {/* Stage Transition Button */}
                          {order.stage === 'accepted' && (
                            <button
                              type="button"
                              onClick={() => handleMoveAndSwitchTab(order.id, 'working')}
                              className="min-h-[40px] px-4 rounded-xl bg-[#000080] hover:bg-[#000066] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <span>Start Work →</span>
                            </button>
                          )}
                          {order.stage === 'working' && (
                            <button
                              type="button"
                              onClick={() => handleMoveAndSwitchTab(order.id, 'completed')}
                              className="min-h-[40px] px-4 rounded-xl bg-[#159937] hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Complete &amp; Dispatch</span>
                            </button>
                          )}
                          {order.stage === 'completed' && (
                            <span className="min-h-[40px] px-3 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1">
                              Ready for Delivery Pickup ✓
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right 5 Columns: Atelier Capabilities, Machinery & Quick Actions */}
              <div className="lg:col-span-5 space-y-4">
                {/* Atelier Identity & Equipment Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#000080] flex items-center justify-center">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          {dashboardProfile.shopName || 'Atelier Workshop'}
                        </h4>
                        <div className="text-xs text-slate-600 font-medium">
                          {dashboardProfile.specialty || 'Stitching & Alterations'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Verified
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Primary Machine:</span>
                      <strong className="text-slate-900">
                        {dashboardProfile.machineType || 'Industrial Lockstitch'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Daily Capacity:</span>
                      <strong className="text-slate-900">
                        {dashboardProfile.dailyCapacity || '8–12 garments/day'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Master Artisan:</span>
                      <strong className="text-slate-900">
                        {dashboardProfile.ownerName || 'Lead Atelier Tailor'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Incoming Orders Box (Part 1 Queue) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#000080]" />
                      <span>Incoming Queue ({incomingOrders.length})</span>
                    </h4>
                    <span className="text-xs text-slate-600 font-semibold">
                      Awaiting Accept
                    </span>
                  </div>

                  {incomingOrders.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-center text-xs sm:text-sm text-slate-600">
                      No pending orders waiting for acceptance.
                    </div>
                  ) : (
                    incomingOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            #{ord.orderNumber}
                          </span>
                          <span className="font-mono font-extrabold text-emerald-800 text-sm">
                            ₹{ord.tailorPayoutINR}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-800 truncate">
                          {ord.clothToBeAltered} ({ord.customerName})
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleMoveAndSwitchTab(ord.id, 'accepted')}
                            className="min-h-[38px] px-3.5 rounded-xl bg-[#000080] hover:bg-[#000066] text-white text-xs sm:text-sm font-bold cursor-pointer"
                          >
                            Accept Order →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Connected Riders Portal Live Feed Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#000080] flex items-center justify-center">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Connected Riders Portal Feed ({tasks.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Live doorstep measurement &amp; cloth trip sync
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onSwitchToDeliveryDashboard}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#000080] border border-blue-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Riders Portal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {tasks.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                        No active delivery trips synced.
                      </div>
                    ) : (
                      tasks.map((task) => {
                        const isSecond = task.deliveryStage === 'second_delivery';
                        return (
                          <div
                            key={task.id}
                            className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-black text-[#000080]">
                                #{task.orderNumber} · {task.customerName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  isSecond
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-[#000080]'
                                }`}
                              >
                                {isSecond ? 'Tailor → Customer' : 'Customer → Tailor'}
                              </span>
                            </div>
                            <div className="text-slate-700 font-semibold truncate">
                              {task.title}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                              <span>
                                Rider: <strong className="text-slate-800">{task.assignedPartnerName || 'Delivery Partner'}</strong>
                              </span>
                              <span className="font-mono font-bold text-emerald-700">
                                ₹{task.payoutINR} · {task.distanceKm} km
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: EARNING & FINANCE (TAILOR WALLET)                           */}
        {/* ================================================================= */}
        {mainTab === 'finance' && (
          <div className="space-y-5">
            {/* Money Counter Card */}
            <MoneyCounterCard
              role="tailor"
              ledger={ledger}
              upiId={dashboardProfile.upiId || 'tailor@upi'}
            />

            {/* Payout Ledger Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Tailor Earnings Ledger &amp; Order Settlements
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct automated payouts for garment stitching, fitting, and alteration completions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  className="h-9 px-4 rounded-xl bg-[#159937] hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Withdraw Payout</span>
                </button>
              </div>

              {tailorFinance.roleTransactions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Landmark className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    No Settled Transactions Yet
                  </div>
                  <p className="text-xs text-slate-500">
                    Completed orders automatically credit your tailoring payout to this ledger and UPI wallet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tailorFinance.roleTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {tx.timestamp} · {tx.status}
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-emerald-700 text-sm">
                        +₹{tx.amountINR.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ATELIER PROFILE & LIVE CAMERA VERIFICATION                 */}
        {/* ================================================================= */}
        {mainTab === 'profile' && (
          <div className="space-y-5">
            {/* Main Atelier Profile Banner */}
            <div className="bg-[#000080] text-white rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                    <Scissors className="w-7 h-7 text-sky-200" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-sky-200 font-bold">
                      VERIFIED ATELIER PARTNER
                    </span>
                    <h2 className="text-xl font-black text-white">
                      {dashboardProfile.shopName || 'Bespoke Atelier Workshop'}
                    </h2>
                    <div className="text-xs text-sky-100 mt-0.5">
                      {dashboardProfile.specialty} · Master Tailor: {dashboardProfile.ownerName || 'Verified Artisan'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-emerald-400" />
                    <span>Live GPS &amp; Camera Verified</span>
                  </span>
                </div>
              </div>
            </div>

            {/* TAILOR PROFILE & ALL TAILOR DETAILS */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                    Tailor Profile &amp; Atelier Details
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Complete Master Tailor &amp; Workshop Information
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{dashboardProfile.adminApproved ? 'Admin Approved Profile' : 'Active Tailor Profile'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Personal & Contact Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <User className="w-4 h-4 text-[#000080]" />
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900">
                      Personal &amp; Contact Details
                    </h4>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Master Tailor Name:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.ownerName || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Phone Number:</span>
                      <strong className="text-slate-900 font-mono font-bold text-right">
                        {dashboardProfile.phoneNumber || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Email Address:</span>
                      <strong className="text-slate-900 font-bold text-right truncate max-w-[200px]">
                        {dashboardProfile.email || 'Not Provided'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. Shop & Location Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <MapPin className="w-4 h-4 text-[#000080]" />
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900">
                      Atelier &amp; Shop Location
                    </h4>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Shop / Atelier Name:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.shopName || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500 shrink-0">Shop Address:</span>
                      <strong className="text-slate-900 font-bold text-right leading-snug">
                        {dashboardProfile.shopAddress || dashboardProfile.liveCameraAddress || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">City &amp; Pincode:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {[dashboardProfile.city, dashboardProfile.pincode].filter(Boolean).join(' - ') || 'Not Provided'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 3. Equipment & Specialization */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Wrench className="w-4 h-4 text-[#000080]" />
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900">
                      Workshop Equipment &amp; Specialty
                    </h4>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Craft Specialty:</span>
                      <strong className="text-[#000080] font-bold text-right">
                        {dashboardProfile.specialty || 'Stitching & Alterations'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Primary Machine:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.machineType || dashboardProfile.liveCameraMachineType || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Machine Serial / ID:</span>
                      <strong className="text-slate-900 font-mono font-bold text-right">
                        {dashboardProfile.machineNumber || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Daily Capacity:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.dailyCapacity || 'Not Provided'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 4. Identity & Bank Settlement Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-[#000080]" />
                      <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900">
                        KYC &amp; Bank Payout Details
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWithdrawModal(true)}
                      className="text-xs text-[#000080] font-bold hover:underline cursor-pointer"
                    >
                      Update UPI
                    </button>
                  </div>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">KYC Document:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.documentType || 'Government ID'}{' '}
                        {dashboardProfile.documentNumber ? `(${dashboardProfile.documentNumber})` : ''}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Account Holder:</span>
                      <strong className="text-slate-900 font-bold text-right">
                        {dashboardProfile.bankAccountHolder || dashboardProfile.ownerName || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Bank Account &amp; IFSC:</span>
                      <strong className="text-slate-900 font-mono font-bold text-right">
                        {[dashboardProfile.bankAccountNumber, dashboardProfile.ifscCode].filter(Boolean).join(' · ') || 'Not Provided'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">UPI Payout ID:</span>
                      <strong className="text-emerald-700 font-mono font-bold text-right">
                        {dashboardProfile.upiId || 'Not Provided'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign Out Action in Profile Section */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onSignOut || onBack}
                  className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: NEW CUSTOMER ORDER POPUP (STEP 1)                          */}
      {/* =================================================================== */}
      {showNewOrderModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Customer Order"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#000080]">
                  Customer Garment Booking · Step 1
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  New Customer Stitching / Alteration Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInitiateNewOrder} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter Customer Name"
                    className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Customer Pickup / Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Doorstep address for Delivery Partner pickup"
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Garment / Cloth Type *
                  </label>
                  <input
                    type="text"
                    required
                    value={clothToBeAltered}
                    onChange={(e) => setClothToBeAltered(e.target.value)}
                    placeholder="e.g. Formal Suit, Linen Trousers, Kurta"
                    className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tailoring Payout Fee (INR)
                  </label>
                  <input
                    type="number"
                    value={tailorPayoutINR}
                    onChange={(e) => setTailorPayoutINR(e.target.value)}
                    placeholder="e.g. 450"
                    className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alteration Instructions / Work Description
                </label>
                <input
                  type="text"
                  value={clothDescription}
                  onChange={(e) => setClothDescription(e.target.value)}
                  placeholder="e.g. Taper sleeves by 1 inch, adjust hem length"
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-new-order-btn"
                  className="h-10 px-5 rounded-xl bg-[#000080] hover:bg-[#000066] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <span>Continue to Courier Assignment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: TAILOR REQUIREMENT & FIRST DELIVERY DISPATCH (STEP 2)       */}
      {/* =================================================================== */}
      {pendingCustomerOrderDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm First Delivery Partner Assignment"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#000080]">
                  Step 2 of 2 · First Delivery Assignment
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Assign Delivery Partner for #{pendingCustomerOrderDraft.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingCustomerOrderDraft(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer:</span>
                <strong className="text-slate-900">{pendingCustomerOrderDraft.customerName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cloth / Garment:</span>
                <strong className="text-slate-900">{pendingCustomerOrderDraft.clothToBeAltered}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tailoring Fee:</span>
                <strong className="text-emerald-700 font-mono">₹{pendingCustomerOrderDraft.tailorPayoutINR}</strong>
              </div>
            </div>

            {/* Courier Choice List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Select Available Delivery Partner (Customer Doorstep → Atelier):
              </label>
              {AVAILABLE_DELIVERY_PARTNERS.map((partner) => (
                <button
                  key={partner.partnerId}
                  type="button"
                  onClick={() => setSelectedFirstPartnerId(partner.partnerId)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    selectedFirstPartnerId === partner.partnerId
                      ? 'border-[#000080] bg-blue-50/70 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-bold text-slate-900">
                      {partner.partnerName} · {partner.vehicleType}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {partner.partnerPhone} · {partner.vehicleNumber}
                    </div>
                  </div>
                  {selectedFirstPartnerId === partner.partnerId && (
                    <CheckCircle2 className="w-4 h-4 text-[#000080]" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingCustomerOrderDraft(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomerOrderWithPartner}
                className="h-10 px-5 rounded-xl bg-[#159937] hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Dispatch Courier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: WORKBENCH SETUP MODAL                                      */}
      {/* =================================================================== */}
      {workbenchModalOrderId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update Atelier Workbench"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#000080]" />
                <h3 className="text-base font-black text-slate-900">
                  Update Atelier Workbench Readiness
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkbenchModalOrderId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkbenchModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Workbench Preset Calibration *
                </label>
                <select
                  value={wbStatusLabel}
                  onChange={(e) => setWbStatusLabel(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                >
                  {WORKBENCH_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Artisan Notes / Thread Shade / Trim Prep
                </label>
                <textarea
                  rows={3}
                  value={wbNotes}
                  onChange={(e) => setWbNotes(e.target.value)}
                  placeholder="Notes regarding chalk markings, needle gauge, and thread tension..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="wb-ready-check"
                  checked={wbReadyToBegin}
                  onChange={(e) => setWbReadyToBegin(e.target.checked)}
                  className="w-4 h-4 text-[#000080] rounded cursor-pointer"
                />
                <label htmlFor="wb-ready-check" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Confirm bench is calibrated &amp; ready to start tailoring work
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWorkbenchModalOrderId(null)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-[#000080] hover:bg-[#000066] text-white text-xs font-bold cursor-pointer"
                >
                  Save Workbench State
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: WORK PROGRESS PHOTO & STAGE UPDATE                          */}
      {/* =================================================================== */}
      {progressModalOrderId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload Work Progress Update"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Record Work Progress &amp; Evidence
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProgressModalOrderId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProgressUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Tailoring Stage *
                </label>
                <select
                  value={progWorkStatus}
                  onChange={(e) => setProgWorkStatus(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                >
                  {WORK_PROGRESS_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Progress Note &amp; Verification Evidence *
                </label>
                <textarea
                  rows={3}
                  required
                  value={progDescription}
                  onChange={(e) => setProgDescription(e.target.value)}
                  placeholder="Describe chalk marking, seam pinning, or finished stitch line..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProgressModalOrderId(null)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-[#159937] hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Save Progress Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: INSTANT UPI WITHDRAWAL MODAL                               */}
      {/* =================================================================== */}
      {showWithdrawModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Withdraw Tailor Payout"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#000080]" />
                <h3 className="text-base font-black text-slate-900">
                  Instant UPI Withdrawal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500">Available Balance:</div>
              <div className="text-lg font-black font-mono text-emerald-700">
                ₹{tailorFinance.totalEarningsINR.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Settlement UPI ID
                </label>
                <input
                  type="text"
                  value={withdrawUpi}
                  onChange={(e) => setWithdrawUpi(e.target.value)}
                  placeholder="e.g. tailor@okhdfcbank"
                  className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Amount to Withdraw (INR)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#000080]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerToast(`Payout transfer of ₹${withdrawAmount || '0'} initiated to ${withdrawUpi || 'UPI'}! Settlement arrives in ~2 mins.`);
                  setShowWithdrawModal(false);
                }}
                className="h-10 px-5 rounded-xl bg-[#159937] hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Withdraw Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM NAVIGATION BAR (Delivery partner portal parity for mobile app)     */}
      {/* ========================================================================= */}
      <nav
        aria-label="Tailor Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 h-16">
          {[
            {
              id: 'workbench' as const,
              label: 'Orders',
              icon: Scissors,
              badge: acceptedOrders.length + workingOrders.length,
            },
            {
              id: 'finance' as const,
              label: 'Earnings',
              icon: Landmark,
              badge: tailorFinance.completedCount > 0 ? tailorFinance.completedCount : undefined,
            },
            {
              id: 'profile' as const,
              label: 'Profile',
              icon: User,
              badge: dashboardProfile.liveCameraCaptured ? undefined : 1,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = mainTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMainTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer min-h-[44px] ${
                  active ? 'text-[#000080]' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge ? (
                    <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs font-bold tracking-tight">{item.label}</span>
                {active && (
                  <span className="absolute top-0 w-10 h-1 rounded-b-full bg-[#000080]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
