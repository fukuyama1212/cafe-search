import { useState, useEffect } from 'react';
import { X, Star, MapPin, Wifi, BatteryCharging, ExternalLink } from 'lucide-react';

type Station = 'all' | '渋谷' | '新宿';

interface CafeScores {
  workability: number;
  stylishness: number;
}

interface CafeFeatures {
  hasOutlet: boolean;
  hasWifi: boolean;
}

interface Cafe {
  placeId: string;
  name: string;
  address: string;
  station: Station;
  location: { lat: number; lng: number };
  mapPosition: { x: number; y: number };
  rating: number;
  photoUrls: string[];
  scores: CafeScores;
  features: CafeFeatures;
  isChain: boolean;
}

interface CafeDetailBottomSheetProps {
  isOpen: boolean;
  cafe: Cafe | null;
  onClose: () => void;
  adSlot: string;
}

const generateTabelogUrl = (name: string, address: string) => {
  const areaMatch = address.match(/(.+?[市区町村])/);
  const area = areaMatch ? areaMatch[1] : '';
  const keyword = encodeURIComponent(`${name} ${area}`.trim());
  return `https://tabelog.com/rst/rstsearch/?keyword=${keyword}`;
};

const generateGoogleMapsUrl = (name: string, address: string) => {
  const query = encodeURIComponent(`${name} ${address}`.trim());
  return `https://www.google.com/maps/search/?query=${query}`;
};

const AdBanner = ({ adSlot }: { adSlot: string }) => {
  useEffect(() => {
    if (import.meta.env.PROD) {
      if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6858311844342267';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense initialization error:', e);
      }
    }
  }, []);

  if (!import.meta.env.PROD) {
    return (
      <div className="w-full h-[60px] bg-zinc-900 flex items-center justify-center text-zinc-500 text-xs font-mono shrink-0 border-t border-zinc-800">
        【ADSENSE】Slot: {adSlot}
      </div>
    );
  }

  return (
    <div className="w-full h-[60px] bg-zinc-950 flex items-center justify-center shrink-0 border-t border-zinc-800/80 overflow-hidden">
      <ins className="adsbygoogle"
           style={{ display: 'inline-block', width: '100%', height: '60px' }}
           data-ad-client="ca-pub-6858311844342267"
           data-ad-slot={adSlot}></ins>
    </div>
  );
};

export default function CafeDetailBottomSheet({ isOpen, cafe, onClose, adSlot }: CafeDetailBottomSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Prevent scroll on body
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!cafe || !isOpen) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-40 transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Bottom sheet */}
      <div 
        className={`absolute bottom-0 left-0 right-0 max-h-[80vh] bg-zinc-950 rounded-t-3xl border-t border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ${
          isAnimating ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header with close button */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-800/50 shrink-0">
          <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">CAFE DETAILS</div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image with gradient */}
          <div className="relative w-full h-48 shrink-0">
            <img 
              src={cafe.photoUrls[0]} 
              alt={cafe.name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-300 flex items-center shadow-md">
              <Star size={12} className="mr-1 fill-teal-300 text-teal-300" /> {cafe.rating.toFixed(1)}
            </div>
          </div>

          {/* Content section */}
          <div className="p-5 space-y-4">
            {/* Name and address */}
            <div>
              <h2 className="text-xl font-bold text-white mb-2">{cafe.name}</h2>
              <p className="text-xs text-zinc-400 flex items-start mb-2">
                <MapPin size={12} className="mr-2 text-teal-300 mt-0.5 shrink-0" />
                <span>{cafe.address}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {cafe.station}エリア
              </p>
            </div>

            {/* Scores */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1 text-zinc-300 font-medium">
                  <span>💻 作業適性</span>
                  <span className="text-cyan-400 font-bold">{cafe.scores.workability.toFixed(1)}/5.0</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-cyan-500 h-2 rounded-full" 
                    style={{ width: `${(cafe.scores.workability / 5) * 100}%` }} 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1 text-zinc-300 font-medium">
                  <span>✨ おしゃれ度</span>
                  <span className="text-teal-300 font-bold">{cafe.scores.stylishness.toFixed(1)}/5.0</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-teal-400 to-cyan-400 h-2 rounded-full" 
                    style={{ width: `${(cafe.scores.stylishness / 5) * 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            {(cafe.features.hasWifi || cafe.features.hasOutlet) && (
              <div className="flex flex-wrap gap-2">
                {cafe.features.hasWifi && (
                  <div className="flex items-center space-x-1.5 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-full text-[11px] font-medium text-zinc-300">
                    <Wifi size={12} className="text-teal-300" />
                    <span>Wi-Fi</span>
                  </div>
                )}
                {cafe.features.hasOutlet && (
                  <div className="flex items-center space-x-1.5 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-full text-[11px] font-medium text-zinc-300">
                    <BatteryCharging size={12} className="text-teal-300" />
                    <span>電源</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ad Banner */}
          <AdBanner adSlot={adSlot} />
        </div>

        {/* Action buttons (fixed at bottom) */}
        <div className="px-4 py-4 space-y-3 border-t border-zinc-800/50 shrink-0 bg-zinc-950">
          <a 
            href={generateGoogleMapsUrl(cafe.name, cafe.address)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:brightness-110 text-zinc-950 rounded-xl flex items-center justify-center text-xs font-bold tracking-wider transition-all active:scale-95"
          >
            <MapPin size={14} className="mr-2" />
            Google Mapsで開く
          </a>
          <a 
            href={generateTabelogUrl(cafe.name, cafe.address)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 rounded-xl flex items-center justify-center text-xs font-bold transition-colors"
          >
            <span>食べログで詳細をみる</span>
            <ExternalLink size={12} className="ml-1.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
