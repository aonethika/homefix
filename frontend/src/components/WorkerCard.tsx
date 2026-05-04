'use client';
import { SERVICE_EMOJIS, SERVICE_LABELS } from '@/utils/formatTime';

interface Props {
  worker: {
    id: string;
    serviceType: string;
    isAvailable: boolean;
    rating: number;
    totalJobs: number;
    distance?: number;
    user: { name: string; phone?: string };
    bio?: string;
  };
}

export default function WorkerCard({ worker }: Props) {
  return (
    <div className="bg-[#1f1f23] border border-[#2a2a30] rounded-lg p-3 flex gap-2">
      
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#2a2a30] flex items-center justify-center text-lg">
        {SERVICE_EMOJIS[worker.serviceType] || '🔧'}
      </div>

      <div className="flex-1 min-w-0">
        
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-[13px] text-white truncate">
            {worker.user.name}
          </p>

          <span
            className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
              worker.isAvailable
                ? 'bg-[#418e4d]/10 text-[#6ee7b7] border border-[#418e4d]/20'
                : 'bg-[#2a2a30] text-[#57534e] border border-[#3a3a40]'
            }`}
          >
            {worker.isAvailable ? 'Available' : 'Busy'}
          </span>
        </div>

        <p className="text-[11px] text-[#a8a29e] mt-0.5 truncate">
          {SERVICE_LABELS[worker.serviceType]}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-[#a8a29e]">
          <span>⭐ {worker.rating.toFixed(1)}</span>
          <span>{worker.totalJobs} jobs</span>

          {worker.distance != null && (
            <span>📍 {worker.distance.toFixed(1)} km</span>
          )}
        </div>
      </div>
    </div>
  );
}