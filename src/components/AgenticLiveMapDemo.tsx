import React, { useState, useEffect } from 'react';
import {
  Check,
  Navigation,
  Play,
  RotateCcw,
  Pause,
  Sparkles,
  MapPin,
  User,
  Scissors,
  ShieldCheck,
} from 'lucide-react';
import { TrenchLiveFleetGoogleMap, FleetTaskPin } from './TrenchGoogleMap';

interface AgenticLiveMapDemoProps {
  orderNumber?: string;
  customerName?: string;
  pickupAddress?: string;
  tailorShopName?: string;
  tailorAddress?: string;
  partnerName?: string;
  payoutINR?: number;
  baseLat?: number;
  baseLng?: number;
  onStepChange?: (stepIndex: number) => void;
}

export const AgenticLiveMapDemo: React.FC<AgenticLiveMapDemoProps> = ({
  orderNumber = 'Order Assigned',
  customerName = 'Customer',
  pickupAddress = 'Customer Doorstep Location',
  tailorShopName = 'Atelier Workshop',
  tailorAddress = 'Tailor Studio',
  partnerName = 'Delivery Partner',
  payoutINR = 120,
  baseLat = 12.9716,
  baseLng = 77.5946,
  onStepChange,
}) => {
  // Progress goes from 0 to 100
  // 0..42: Moving from Rider Start -> Customer Pickup
  // 42..52: Arriving at Pickup Location (Agentic AI verifies GPS & ticks "Arriving at pickup location")
  // 52..62: Picked up from Customer (Agentic AI ticks "Picked up from customer")
  // 62..95: Moving from Customer Pickup -> Tailor Workshop
  // 95..100: Reached Tailor Workshop (Agentic AI ticks "Delivered to tailor")
  const [progress, setProgress] = useState<number>(8);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const startCoords = {
    lat: Number((baseLat - 0.0055).toFixed(5)),
    lng: Number((baseLng - 0.0065).toFixed(5)),
  };
  const pickupCoords = {
    lat: Number((baseLat + 0.0035).toFixed(5)),
    lng: Number((baseLng - 0.0015).toFixed(5)),
    address: pickupAddress,
  };
  const tailorCoords = {
    lat: Number((baseLat + 0.0095).toFixed(5)),
    lng: Number((baseLng + 0.0075).toFixed(5)),
    address: tailorAddress,
  };

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 1.25;
      });
    }, 140);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Compute interpolated rider position along Start -> Pickup -> Tailor
  let riderLat = startCoords.lat;
  let riderLng = startCoords.lng;

  if (progress <= 45) {
    const t = Math.min(1, Math.max(0, progress / 45));
    riderLat = startCoords.lat + (pickupCoords.lat - startCoords.lat) * t;
    riderLng = startCoords.lng + (pickupCoords.lng - startCoords.lng) * t;
  } else if (progress <= 58) {
    riderLat = pickupCoords.lat;
    riderLng = pickupCoords.lng;
  } else {
    const t = Math.min(1, Math.max(0, (progress - 58) / 38));
    riderLat = pickupCoords.lat + (tailorCoords.lat - pickupCoords.lat) * t;
    riderLng = pickupCoords.lng + (tailorCoords.lng - pickupCoords.lng) * t;
  }

  const isArrivingPickupChecked = progress >= 42;
  const isPickedUpFromCustomerChecked = progress >= 54;
  const isDeliveredToTailorChecked = progress >= 96;

  useEffect(() => {
    if (!onStepChange) return;
    if (isDeliveredToTailorChecked) onStepChange(4);
    else if (isPickedUpFromCustomerChecked) onStepChange(3);
    else if (isArrivingPickupChecked) onStepChange(2);
    else onStepChange(1);
  }, [
    isArrivingPickupChecked,
    isPickedUpFromCustomerChecked,
    isDeliveredToTailorChecked,
    onStepChange,
  ]);

  const completedRoutePath =
    progress <= 58
      ? [startCoords, { lat: riderLat, lng: riderLng }]
      : [
          startCoords,
          { lat: pickupCoords.lat, lng: pickupCoords.lng },
          { lat: riderLat, lng: riderLng },
        ];

  const agentStatusLabel = isDeliveredToTailorChecked
    ? 'Rider reached Tailor · Auto-ticked "Delivered to tailor" ✓'
    : progress > 58
    ? 'Rider en route to Tailor · Tracking live GPS trajectory...'
    : isPickedUpFromCustomerChecked
    ? 'Parcel verified · Auto-ticked "Picked up from customer" ✓'
    : isArrivingPickupChecked
    ? 'Rider at Customer · Auto-ticked "Arriving at pickup location" ✓'
    : 'Rider moving to Customer Pickup · AI Geofence Active';

  const demoTaskPin: FleetTaskPin = {
    id: `demo-${orderNumber}`,
    orderNumber,
    customerName,
    title: 'Italian Linen Blazer & Trouser Cloth Trip',
    stage: 'first_delivery',
    status: isDeliveredToTailorChecked
      ? 'delivered_to_tailor'
      : isPickedUpFromCustomerChecked
      ? 'picked_up_from_customer'
      : 'assigned',
    payoutINR,
    pickupCoords,
    dropCoords: tailorCoords,
    tailorShopName,
  };

  const handleRestartDemo = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <section
      aria-label="Live Agentic AI Delivery Map Demo"
      className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl text-white"
    >
      {/* Top Agentic AI Header Bar */}
      <div className="p-4 bg-gradient-to-r from-[#000080] via-slate-900 to-emerald-950 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                <span>LIVE AGENTIC AI MAP DEMO</span>
              </span>
              <span className="text-xs font-mono font-bold text-sky-300">
                Order #{orderNumber} · {customerName} → {tailorShopName}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-1">
              {agentStatusLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-extrabold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-300" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestartDemo}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Agentic AI Map Demo</span>
          </button>
        </div>
      </div>

      {/* Live Checkboxes Auto-Ticked by Agentic AI */}
      <div className="p-4 bg-slate-950/90 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-sky-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Autonomous Agentic AI Geofence Checkboxes (Auto-ticked as Rider Icon Moves)
            </span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Route Progress: {Math.min(100, Math.round(progress))}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-emerald-500 transition-all duration-150"
            style={{ width: `${Math.min(100, Math.round(progress))}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              id: 'on_way',
              label: '1. Rider moving to pickup',
              sub: 'GPS Dispatch Active',
              checked: true,
            },
            {
              id: 'arriving_pickup',
              label: '2. Arriving at pickup location',
              sub: isArrivingPickupChecked
                ? 'Ticked by Agentic AI ✓'
                : 'Waiting for rider arrival...',
              checked: isArrivingPickupChecked,
            },
            {
              id: 'picked_up',
              label: '3. Picked up from customer',
              sub: isPickedUpFromCustomerChecked
                ? 'Ticked by Agentic AI ✓'
                : 'Waiting for pickup scan...',
              checked: isPickedUpFromCustomerChecked,
            },
            {
              id: 'delivered_tailor',
              label: '4. Delivered to tailor',
              sub: isDeliveredToTailorChecked
                ? 'Ticked by Agentic AI ✓'
                : 'Rider moving to tailor...',
              checked: isDeliveredToTailorChecked,
            },
          ].map((box) => (
            <div
              key={box.id}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                box.checked
                  ? 'bg-emerald-950/60 border-emerald-400/70 text-white shadow-sm'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">{box.label}</div>
                <div
                  className={`text-[10px] font-mono mt-0.5 ${
                    box.checked ? 'text-emerald-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  {box.sub}
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  box.checked
                    ? 'bg-emerald-500 text-slate-950 shadow-md scale-105'
                    : 'border-2 border-slate-600 bg-slate-900'
                }`}
              >
                {box.checked && <Check className="w-4 h-4 stroke-[3.5]" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Map with Animated Delivery Rider Scooter */}
      <div className="relative w-full h-88 sm:h-96 bg-[#161B22]">
        {Boolean(
          (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() &&
            import.meta.env.VITE_GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY'
        ) ? (
          <TrenchLiveFleetGoogleMap
            partnerName={partnerName}
            partnerLat={startCoords.lat}
            partnerLng={startCoords.lng}
            riderAnimatedPos={{ lat: riderLat, lng: riderLng }}
            completedRoutePath={completedRoutePath}
            agentStatusLabel={agentStatusLabel}
            selectedTask={demoTaskPin}
            allTasks={[demoTaskPin]}
            mapTypeId="roadmap"
          />
        ) : (
          <svg
            viewBox="0 0 800 360"
            className="w-full h-full block object-cover"
            role="img"
            aria-label="Live Agentic AI Route Simulation Map"
          >
            <rect width="800" height="360" fill="#0F172A" />
            <g stroke="#1E293B" strokeWidth="18" fill="none">
              <path d="M 0 110 L 800 110" />
              <path d="M 0 230 L 800 230" />
              <path d="M 220 0 L 220 360" />
              <path d="M 460 0 L 460 360" />
              <path d="M 660 0 L 660 360" />
            </g>
            <path
              d="M 120 260 L 400 130 L 670 85"
              fill="none"
              stroke="#334155"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d={
                progress <= 58
                  ? `M 120 260 L ${120 + (400 - 120) * Math.min(1, progress / 45)} ${
                      260 + (130 - 260) * Math.min(1, progress / 45)
                    }`
                  : `M 120 260 L 400 130 L ${
                      400 + (670 - 400) * Math.min(1, (progress - 58) / 38)
                    } ${130 + (85 - 130) * Math.min(1, (progress - 58) / 38)}`
              }
              fill="none"
              stroke="#10B981"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <g transform="translate(400, 130)">
              <circle r="16" fill="rgba(56, 189, 248, 0.25)" />
              <circle r="9" fill="#000080" stroke="#FFFFFF" strokeWidth="2.5" />
              <text x="0" y="-18" textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="bold">
                PICKUP: {customerName}
              </text>
            </g>
            <g transform="translate(670, 85)">
              <circle r="16" fill="rgba(16, 185, 129, 0.25)" />
              <circle r="9" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
              <text x="0" y="-18" textAnchor="middle" fill="#6EE7B7" fontSize="11" fontWeight="bold">
                TAILOR: {tailorShopName}
              </text>
            </g>
            <g
              transform={`translate(${
                progress <= 45
                  ? 120 + (400 - 120) * (progress / 45)
                  : progress <= 58
                  ? 400
                  : 400 + (670 - 400) * Math.min(1, (progress - 58) / 38)
              }, ${
                progress <= 45
                  ? 260 + (130 - 260) * (progress / 45)
                  : progress <= 58
                  ? 130
                  : 130 + (85 - 130) * Math.min(1, (progress - 58) / 38)
              })`}
            >
              <circle r="20" fill="rgba(56, 189, 248, 0.28)" />
              <circle r="11" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2.5" />
              <text x="0" y="26" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold">
                {partnerName}
              </text>
            </g>
          </svg>
        )}

        {/* Bottom Live Route Legend Overlay */}
        <div className="absolute bottom-3 inset-x-3 sm:inset-x-6 bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg bg-[#000080] text-white font-bold flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-sky-300" />
              <span>Pickup: {customerName}</span>
            </span>
            <span className="text-slate-400">→</span>
            <span className="px-2 py-1 rounded-lg bg-emerald-700 text-white font-bold flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-emerald-200" />
              <span>Tailor: {tailorShopName}</span>
            </span>
          </div>
          <div className="font-mono text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Rider GPS: {riderLat.toFixed(4)}° N, {riderLng.toFixed(4)}° E
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
