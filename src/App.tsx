// App.tsx
import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type MouseEvent, type TouchEvent, type SVGProps } from 'react';
import { MapPin, Wifi, BatteryCharging, Star, Heart, X, ExternalLink, ChevronLeft, List, Navigation, RotateCcw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import GoogleMap from './components/GoogleMap';

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

interface TopScreenProps {
  selectedStation: Station;
  setSelectedStation: Dispatch<SetStateAction<Station>>;
  likedCafes: Cafe[];
  unseenCount: number;
  onGoToSwipe: () => void;
  onGoToList: () => void;
  onReset: () => void;
}

interface SwipeScreenProps {
  unseenCafes: Cafe[];
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onBack: () => void;
  onReset: () => void;
}

interface ListScreenProps {
  likedCafes: Cafe[];
  onBack: () => void;
}

interface SwipeCardProps {
  cafe: Cafe;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
}

const AdBanner = ({ adSlot }: { adSlot: string }) => {
  useEffect(() => {
    // 本番環境でのみ AdSense スクリプトを読み込み・実行
    if (import.meta.env.PROD) {
      // スクリプトの重複ロードを防止
      if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6858311844342267';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
      
      // 広告の初期化
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense initialization error:', e);
      }
    }
  }, []);

  // ローカル環境用のプレースホルダー
  if (!import.meta.env.PROD) {
    return (
      <div className="w-full h-[60px] bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0 border-t border-gray-300">
        【ローカル環境】広告枠 (Slot: {adSlot})
      </div>
    );
  }

  // 本番環境用の広告表示（高さを60pxに固定してUX悪化を防止）
  return (
    <div className="w-full h-[60px] bg-white flex items-center justify-center shrink-0 border-t border-gray-100 overflow-hidden">
      <ins className="adsbygoogle"
           style={{ display: 'inline-block', width: '100%', height: '60px' }}
           data-ad-client="ca-pub-6858311844342267"
           data-ad-slot={adSlot}></ins>
    </div>
  );
};

const normalizeNumber = (value: unknown, fallback = 0) => {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : fallback;
};

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(String).filter(item => item.trim() !== '');
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }
  return [];
};

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

const parseCafeDocument = (doc: any): Cafe | null => {
  const data = doc.data() ?? {};
  const location = data.location ?? {};
  const mapPosition = data.mapPosition ?? data.map_position ?? {};
  const scores = data.scores ?? {};
  const features = data.features ?? {};
  const stationValue = String(data.station ?? 'all');
  const station: Station = stationValue === '渋谷' || stationValue === '新宿' ? stationValue : 'all';

  return {
    placeId: doc.id,
    name: String(data.name ?? ''),
    address: String(data.address ?? ''),
    station,
    location: {
      lat: normalizeNumber(location.lat, 0),
      lng: normalizeNumber(location.lng, 0),
    },
    mapPosition: {
      x: normalizeNumber(mapPosition.x, 0),
      y: normalizeNumber(mapPosition.y, 0),
    },
    rating: normalizeNumber(data.rating, 0),
    photoUrls: normalizeStringArray(data.photoUrls),
    scores: {
      workability: normalizeNumber(scores.workability, 0),
      stylishness: normalizeNumber(scores.stylishness, 0),
    },
    features: {
      hasOutlet: normalizeBoolean(features.hasOutlet, false),
      hasWifi: normalizeBoolean(features.hasWifi, false),
    },
    isChain: normalizeBoolean(data.isChain, false),
  };
};

const generateTabelogUrl = (name: string, address: string) => {
  const areaMatch = address.match(/(.+?[市区町村])/);
  const area = areaMatch ? areaMatch[1] : '';
  const keyword = encodeURIComponent(`${name} ${area}`.trim());
  return `https://tabelog.com/rst/rstsearch/?keyword=${keyword}`;
};

export default function App() {
  const [view, setView] = useState<'top' | 'swipe' | 'list'>('top');
  const [selectedStation, setSelectedStation] = useState<Station>('all');
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [dislikedIds, setDislikedIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchCafes = async () => {
      setLoading(true);
      setError(null);

      try {
        const snapshot = await getDocs(collection(db, 'cafes'));
        const loadedCafes: Cafe[] = snapshot.docs.map(doc => parseCafeDocument(doc)).filter((cafe): cafe is Cafe => cafe !== null);
        setCafes(loadedCafes);
      } catch (fetchError) {
        console.error('Failed to fetch cafes from Firestore', fetchError);
        setError('カフェデータの読み込みに失敗しました。再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    };

    fetchCafes();
  }, []);

  useEffect(() => {
    try {
      const savedLikes = JSON.parse(localStorage.getItem('cafe_search_likes') ?? '[]') as string[];
      const savedDislikes = JSON.parse(localStorage.getItem('cafe_search_dislikes') ?? '[]') as string[];
      setLikedIds(Array.isArray(savedLikes) ? savedLikes : []);
      setDislikedIds(Array.isArray(savedDislikes) ? savedDislikes : []);
    } catch (e) {
      console.error("Failed to load local storage", e);
    }
  }, []);

  const handleLike = (id: string) => {
    setLikedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('cafe_search_likes', JSON.stringify(next));
      return next;
    });
  };

  const handleDislike = (id: string) => {
    setDislikedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('cafe_search_dislikes', JSON.stringify(next));
      return next;
    });
  };

  const handleReset = () => {
    if (window.confirm('マッチング履歴とお気に入りをすべてリセットして最初からやり直しますか？')) {
      setLikedIds([]);
      setDislikedIds([]);
      localStorage.setItem('cafe_search_likes', JSON.stringify([]));
      localStorage.setItem('cafe_search_dislikes', JSON.stringify([]));
    }
  };

  const stationCafes = cafes.filter(c => selectedStation === 'all' || c.station === selectedStation);
  const evaluated = new Set<string>([...likedIds, ...dislikedIds]);
  const unseenCafes = stationCafes.filter(c => !evaluated.has(c.placeId));
  const likedCafes = stationCafes.filter(c => likedIds.includes(c.placeId));

  return (
    <div className="w-full h-[100dvh] bg-white flex flex-col relative overflow-hidden font-sans">
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-6 text-gray-600">
          Firestoreからカフェ情報を読み込んでいます...
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-700">
          <p className="mb-3 font-bold">データの読み込みに失敗しました。</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-900 text-white rounded-full"
          >
            再読み込み
          </button>
        </div>
      ) : (
        <>
          <div className={view === 'top' ? 'flex-1 flex flex-col relative overflow-hidden' : 'hidden'}>
            <TopScreen 
              selectedStation={selectedStation}
              setSelectedStation={setSelectedStation}
              likedCafes={likedCafes}
              unseenCount={unseenCafes.length}
              onGoToSwipe={() => setView('swipe')}
              onGoToList={() => setView('list')}
              onReset={handleReset}
            />
          </div>

          {view === 'swipe' && (
            <SwipeScreen 
              unseenCafes={unseenCafes}
              onLike={handleLike}
              onDislike={handleDislike}
              onBack={() => setView('top')}
              onReset={handleReset}
            />
          )}

          {view === 'list' && (
            <ListScreen 
              likedCafes={likedCafes}
              onBack={() => setView('top')}
            />
          )}
        </>
      )}
    </div>
  );
}

function TopScreen({ selectedStation, setSelectedStation, likedCafes, unseenCount, onGoToSwipe, onGoToList, onReset }: TopScreenProps) {
  const stations: { id: Station; label: string }[] = [
    { id: 'all', label: 'すべて' },
    { id: '渋谷', label: '渋谷' },
    { id: '新宿', label: '新宿' }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <header className="px-6 py-4 flex justify-between items-center bg-white shadow-sm z-20 shrink-0">
        <div className="flex items-center space-x-2 text-orange-600">
          <MapPin size={24} />
          <h1 className="font-bold text-xl tracking-tight">Cafe Map</h1>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={onReset}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="マッチング履歴をリセット"
          >
            <RotateCcw size={20} />
          </button>
          <button 
            onClick={onGoToList}
            className="relative p-2 rounded-full text-gray-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            title="お気に入り一覧"
          >
            <List size={24} />
            {likedCafes.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-orange-600 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>
      </header>

      <div className="bg-white px-4 py-3 border-b border-gray-100 z-10 shrink-0">
        <div className="flex space-x-2">
          {stations.map(st => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedStation === st.id 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <GoogleMap likedCafes={likedCafes} selectedStation={selectedStation} />
        </div>

        {likedCafes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur px-6 py-3 rounded-full text-sm font-medium text-gray-500 shadow-sm">
              カフェを探してピンを立てましょう
            </div>
          </div>
        )}

        <div className="absolute bottom-8 left-0 right-0 px-6 flex justify-center z-10">
          <button 
            onClick={onGoToSwipe}
            disabled={unseenCount === 0}
            className={`w-full max-w-sm rounded-full py-4 shadow-xl flex items-center justify-center font-bold text-lg transition-all ${
              unseenCount > 0 
                ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {unseenCount > 0 ? (
              <>
                <Heart size={20} className="mr-2" />
                新しいカフェを探す ({unseenCount})
              </>
            ) : (
              'このエリアは全て確認済み'
            )}
          </button>
        </div>
      </div>
      <AdBanner adSlot="4426766487" />
    </div>
  );
}

function SwipeScreen({ unseenCafes, onLike, onDislike, onBack, onReset }: SwipeScreenProps) {
  const currentCafe = unseenCafes[0];
  const isFinished = unseenCafes.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <header className="px-4 py-3 flex items-center z-20 shrink-0">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 hover:bg-gray-50"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="ml-3 font-bold text-gray-800">スワイプで探す</div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        {isFinished ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center pb-20">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Check className="text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">That's all!</h2>
            <p className="text-gray-500 mb-8">現在のエリアのカフェはすべて確認しました。</p>
            <div className="space-y-4 w-full max-w-sm">
              <button 
                onClick={onBack}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium shadow-lg active:scale-95 transition-transform"
              >
                マップに戻る
              </button>
              <button 
                onClick={onReset}
                className="w-full py-3 bg-white text-gray-600 border border-gray-200 rounded-xl font-medium shadow-sm active:scale-95 transition-transform"
              >
                履歴をリセットする
              </button>
            </div>
          </div>
        ) : (
          <SwipeCard 
            key={currentCafe.placeId} 
            cafe={currentCafe} 
            onLike={onLike} 
            onDislike={onDislike} 
          />
        )}
      </div>
      <AdBanner adSlot="6168007389" />
    </div>
  );
}

function ListScreen({ likedCafes, onBack }: ListScreenProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <header className="px-4 py-3 flex items-center bg-white shadow-sm z-20 shrink-0">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="ml-3 font-bold text-gray-800">
          お気に入り ({likedCafes.length}件)
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {likedCafes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-20">
            <Heart size={48} className="mb-4 text-gray-300" />
            <p>お気に入りのカフェがありません。</p>
            <p className="text-sm mt-2">マップからスワイプして探しましょう。</p>
          </div>
        ) : (
          likedCafes.map(cafe => (
            <div key={cafe.placeId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="h-32 relative">
                <img src={cafe.photoUrls[0]} alt={cafe.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-orange-600 flex items-center shadow-sm">
                  <Star size={12} className="mr-1 fill-current" /> {cafe.rating.toFixed(1)}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1">{cafe.name}</h3>
                <p className="text-xs text-gray-500 flex items-center mb-3">
                  <Navigation size={12} className="mr-1" /> {cafe.station}エリア / {cafe.address.split('区')[1]}
                </p>
                
                <div className="flex space-x-2 mb-4">
                  <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">作業 {cafe.scores.workability.toFixed(1)}</span>
                  <span className="text-xs font-medium px-2.5 py-1 bg-orange-50 text-orange-700 rounded-md">おしゃれ {cafe.scores.stylishness.toFixed(1)}</span>
                </div>

                <a 
                  href={generateTabelogUrl(cafe.name, cafe.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl flex items-center justify-center text-sm font-medium transition-colors"
                >
                  <span>食べログで詳細を見る</span>
                  <ExternalLink size={14} className="ml-2" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SwipeCard({ cafe, onLike, onDislike }: SwipeCardProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const startX = useRef(0);
  
  const SWIPE_THRESHOLD = 100;

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [cafe.placeId]);

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    startX.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    setDragOffset(clientX - startX.current);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (dragOffset > SWIPE_THRESHOLD) {
      onLike(cafe.placeId);
    } else if (dragOffset < -SWIPE_THRESHOLD) {
      onDislike(cafe.placeId);
    }
    setDragOffset(0);
  };

  const bindEvents = {
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => handleStart(e.touches[0].clientX),
    onTouchMove: (e: TouchEvent<HTMLDivElement>) => handleMove(e.touches[0].clientX),
    onTouchEnd: handleEnd,
    onMouseDown: (e: MouseEvent<HTMLDivElement>) => handleStart(e.clientX),
    onMouseMove: (e: MouseEvent<HTMLDivElement>) => handleMove(e.clientX),
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
  };

  const rotate = dragOffset * 0.05;
  const opacity = 1 - Math.abs(dragOffset) * 0.002;
  const isLiking = dragOffset > 20;
  const isDisliking = dragOffset < -20;

  return (
    <div className="absolute inset-0 flex flex-col p-4 pb-8">
      <div className="absolute inset-4 top-4 bg-white rounded-[2rem] shadow-sm border border-gray-200 scale-95 opacity-50 translate-y-4" />
      
      <div 
        {...bindEvents}
        className="relative flex-1 bg-white rounded-[2rem] shadow-xl overflow-hidden cursor-grab active:cursor-grabbing border border-gray-100"
        style={{
          transform: isDragging 
            ? `translateX(${dragOffset}px) rotate(${rotate}deg)` 
            : (isVisible ? 'translateX(0) scale(1)' : 'translateX(0) scale(0.95)'),
          opacity: isDragging ? opacity : (isVisible ? 1 : 0),
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out'
        }}
      >
        <div className="absolute inset-0 z-10 flex items-center justify-between px-8 pointer-events-none">
          <div className={`w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white transform transition-all ${isLiking ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            <Heart size={32} fill="currentColor" />
          </div>
          <div className={`w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white transform transition-all ${isDisliking ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            <X size={32} />
          </div>
        </div>

        <img 
          src={cafe.photoUrls[0]} 
          alt={cafe.name} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white pointer-events-none">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-2xl font-bold leading-tight drop-shadow-md">{cafe.name}</h2>
            <div className="flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-lg backdrop-blur-sm">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold">{cafe.rating.toFixed(1)}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-200 mb-4 flex items-center">
            <MapPin size={14} className="mr-1" />
            {cafe.station}周辺
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between text-xs mb-1 text-gray-200 font-medium">
                <span>💻 作業適性</span>
                <span>{cafe.scores.workability.toFixed(1)}</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-1.5">
                <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(cafe.scores.workability / 5) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 text-gray-200 font-medium">
                <span>✨ おしゃれ度</span>
                <span>{cafe.scores.stylishness.toFixed(1)}</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-1.5">
                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${(cafe.scores.stylishness / 5) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            {cafe.features.hasWifi && (
              <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium">
                <Wifi size={14} /> <span>Wi-Fi</span>
              </div>
            )}
            {cafe.features.hasOutlet && (
              <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium">
                <BatteryCharging size={14} /> <span>電源</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center space-x-8 mt-6 shrink-0">
        <button 
          onClick={() => {
            setDragOffset(-SWIPE_THRESHOLD - 50);
            setTimeout(() => onDislike(cafe.placeId), 200);
          }}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-red-500 hover:bg-red-50 transition-colors border border-gray-100"
        >
          <X size={32} />
        </button>
        <button 
          onClick={() => {
            setDragOffset(SWIPE_THRESHOLD + 50);
            setTimeout(() => onLike(cafe.placeId), 200);
          }}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-green-500 hover:bg-green-50 transition-colors border border-gray-100"
        >
          <Heart size={32} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}