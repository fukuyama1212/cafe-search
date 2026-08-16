import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type MouseEvent, type TouchEvent, type SVGProps } from 'react';
import { MapPin, Wifi, BatteryCharging, Star, Heart, X, ChevronLeft, List, Navigation, RotateCcw, Sparkles, Compass, Info } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import GoogleMap from './components/GoogleMap';
import CafeDetailBottomSheet from './components/CafeDetailBottomSheet';

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
  onShowDetail?: (cafe: Cafe) => void;
}

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

export default function App() {
  const [view, setView] = useState<'top' | 'swipe' | 'list'>('top');
  const [selectedStation, setSelectedStation] = useState<Station>('all');
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [dislikedIds, setDislikedIds] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem('cafe_search_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('cafe_search_onboarded', 'true');
    setShowOnboarding(false);
  };

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

  // ★ リセット時にオンボーディングを再表示するように修正
  const handleReset = () => {
    if (window.confirm('マッチング履歴とお気に入りをすべてリセットして最初からやり直しますか？')) {
      // 履歴ステートとローカルストレージの初期化
      setLikedIds([]);
      setDislikedIds([]);
      localStorage.setItem('cafe_search_likes', JSON.stringify([]));
      localStorage.setItem('cafe_search_dislikes', JSON.stringify([]));
      
      // オンボーディングフラグを削除して再表示
      localStorage.removeItem('cafe_search_onboarded');
      setShowOnboarding(true);
      
      // 裏側のビューをトップ画面に戻しておく
      setView('top');
    }
  };

  const stationCafes = cafes.filter(c => selectedStation === 'all' || c.station === selectedStation);
  const evaluated = new Set<string>([...likedIds, ...dislikedIds]);
  const unseenCafes = stationCafes.filter(c => !evaluated.has(c.placeId));
  const likedCafes = stationCafes.filter(c => likedIds.includes(c.placeId));

  return (
    <div className="w-full h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden font-sans select-none">
      {/* 初回限定 オンボーディング画面（ダイレクト表示＆青緑ラグジュアリー） */}
      {showOnboarding && (
        <OnboardingScreen 
          onClose={handleCloseOnboarding} 
          onStartSwipe={() => {
            handleCloseOnboarding();
            setView('swipe');
          }}
        />
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-400 space-y-4">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-widest text-zinc-300">MY CAFE MAP LOADING...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-300">
          <p className="mb-2 font-bold text-teal-400">エラーが発生しました</p>
          <p className="text-xs text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-full border border-zinc-700 transition-all"
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

/** 初回限定 オンボーディング画面（背景ダイレクト表示＆高視認性） */
function OnboardingScreen({ onClose, onStartSwipe }: { onClose: () => void; onStartSwipe: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950">
      {/* カフェの雰囲気を際立たせる写真 */}
      <img 
        src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop" 
        alt="Atmospheric Work Cafe" 
        className="absolute inset-0 w-full h-full object-cover opacity-75"
      />
      {/* 画像の上でテキストの視認性を確保する柔らかなグラデーション */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/40" />

      {/* 閉じるボタン */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-20 w-10 h-10 bg-zinc-950/60 backdrop-blur-md rounded-full text-zinc-300 flex items-center justify-center border border-zinc-700/50 hover:text-white transition-colors"
      >
        <X size={18} />
      </button>

      {/* 黒いカードエリアを廃止し、画像上にダイレクト配置 */}
      <div className="relative z-10 text-white flex flex-col items-center text-center max-w-sm w-full">
        <h1 className="text-3xl font-light tracking-wide mb-3 leading-snug text-white drop-shadow-xl">
          自分だけの作業用<br />
          <span className="font-extrabold bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
            カフェマップを作ろう
          </span>
        </h1>

        <p className="text-xs text-zinc-200 mb-10 leading-relaxed font-normal drop-shadow-md">
          気になったカフェを選ぶだけ。<br />
          お気に入りカフェが、マップに集まります。
        </p>

        <div className="space-y-3 w-full max-w-xs">
          <button 
            onClick={onStartSwipe}
            className="w-full py-4 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:brightness-110 active:scale-[0.98] text-zinc-950 rounded-full font-bold text-xs tracking-wider shadow-xl shadow-teal-500/25 transition-all"
          >
            さっそく探す
          </button>

          <button 
            onClick={onClose}
            className="w-full py-2.5 text-xs text-zinc-300 hover:text-white transition-colors text-center font-medium drop-shadow-md"
          >
            まずはマップをみる
          </button>
        </div>
      </div>
    </div>
  );
}

/** トップ画面（青緑アクセント仕様） */
function TopScreen({ selectedStation, setSelectedStation, likedCafes, unseenCount, onGoToSwipe, onGoToList, onReset }: TopScreenProps) {
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleCafeClick = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
  };

  const stations: { id: Station; label: string }[] = [
    { id: 'all', label: 'ALL' },
    { id: '渋谷', label: '渋谷' },
    { id: '新宿', label: '新宿' }
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      <header className="px-5 py-4 flex justify-between items-center bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 z-20 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 via-emerald-400 to-cyan-400 flex items-center justify-center text-zinc-950 shadow-md shadow-teal-500/15">
            <Compass size={18} />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wider text-white uppercase">My Cafe Map</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onReset}
            className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title="リセット"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={onGoToList}
            className="relative p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-teal-300 transition-colors"
            title="お気に入り"
          >
            <List size={20} />
            {likedCafes.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-400 rounded-full ring-2 ring-zinc-900"></span>
            )}
          </button>
        </div>
      </header>

      {/* エリアフィルター */}
      <div className="bg-zinc-950/80 backdrop-blur-md px-4 py-2.5 border-b border-zinc-800/60 z-10 shrink-0">
        <div className="flex space-x-2">
          {stations.map(st => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all ${
                selectedStation === st.id 
                  ? 'bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 text-zinc-950 shadow-md shadow-teal-500/15' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800/80'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 地図エリア */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 filter contrast-[0.95] brightness-[0.85]">
          <GoogleMap likedCafes={likedCafes} selectedStation={selectedStation} onCafeClick={handleCafeClick} />
        </div>

        {likedCafes.length === 0 && (
          <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-full text-xs font-medium text-zinc-300 shadow-xl flex items-center space-x-2">
              <Sparkles size={13} className="text-teal-300" />
              <span>スワイプでお気に入りカフェをピン留め</span>
            </div>
          </div>
        )}

        {/* 下部 アクションボタン */}
        <div className="absolute bottom-6 left-0 right-0 px-5 flex justify-center z-10">
          <button 
            onClick={onGoToSwipe}
            disabled={unseenCount === 0}
            className={`w-full max-w-sm rounded-full py-4 shadow-2xl flex items-center justify-center font-bold text-xs tracking-wider transition-all ${
              unseenCount > 0 
                ? 'bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:brightness-110 text-zinc-950 shadow-teal-500/20 active:scale-[0.98]' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            {unseenCount > 0 ? (
              <>
                <Heart size={16} className="mr-2 fill-current" />
                <span>新しいカフェを探す ({unseenCount})</span>
              </>
            ) : (
              'すべてのカフェを確認済み'
            )}
          </button>
        </div>
      </div>
      <AdBanner adSlot="4426766487" />
      
      <CafeDetailBottomSheet 
        isOpen={showDetailModal}
        cafe={selectedCafe}
        onClose={handleCloseModal}
        adSlot="9876543210"
      />
    </div>
  );
}

/** スワイプ画面 */
function SwipeScreen({ unseenCafes, onLike, onDislike, onBack, onReset }: SwipeScreenProps) {
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const currentCafe = unseenCafes[0];
  const isFinished = unseenCafes.length === 0;

  const handleShowDetail = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      <header className="px-4 py-3 flex items-center justify-between z-20 shrink-0 border-b border-zinc-800/50">
        <button 
          onClick={onBack}
          className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-300 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">SWIPE & MATCH</div>
        <div className="w-9" />
      </header>

      <div className="flex-1 relative overflow-hidden">
        {isFinished ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center pb-20">
            <div className="w-16 h-16 bg-teal-400/10 border border-teal-400/30 rounded-2xl flex items-center justify-center mb-5 text-teal-300">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">ALL CHECKED</h2>
            <p className="text-xs text-zinc-400 mb-8">現在のエリアのカフェはすべて確認しました。</p>
            <div className="space-y-3 w-full max-w-xs">
              <button 
                onClick={onBack}
                className="w-full py-3 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 text-zinc-950 rounded-full text-xs font-bold tracking-wider active:scale-95 transition-transform"
              >
                マップに戻る
              </button>
              <button 
                onClick={onReset}
                className="w-full py-3 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-full text-xs font-medium active:scale-95 transition-transform hover:text-white"
              >
                履歴をリセット
              </button>
            </div>
          </div>
        ) : (
          <SwipeCard 
            key={currentCafe.placeId} 
            cafe={currentCafe} 
            onLike={onLike} 
            onDislike={onDislike}
            onShowDetail={handleShowDetail}
          />
        )}
      </div>
      <AdBanner adSlot="6168007389" />
      
      <CafeDetailBottomSheet 
        isOpen={showDetailModal}
        cafe={selectedCafe}
        onClose={handleCloseModal}
        adSlot="9876543210"
      />
    </div>
  );
}

/** リスト画面 */
function ListScreen({ likedCafes, onBack }: ListScreenProps) {
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleCafeClick = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      <header className="px-4 py-3 flex items-center bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 z-20 shrink-0">
        <button 
          onClick={onBack}
          className="w-9 h-9 bg-zinc-800/80 border border-zinc-700/60 rounded-full flex items-center justify-center text-zinc-300 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="ml-3 font-bold text-xs tracking-wider text-white uppercase">
          MY SAVED CAFES ({likedCafes.length})
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {likedCafes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 pb-20">
            <Heart size={40} className="mb-3 text-zinc-700" />
            <p className="text-xs font-medium text-zinc-400">お気に入り登録したカフェがありません</p>
            <p className="text-[11px] text-zinc-600 mt-1">スワイプ画面で気に入ったカフェを保存しましょう</p>
          </div>
        ) : (
          likedCafes.map(cafe => (
            <div 
              key={cafe.placeId} 
              onClick={() => handleCafeClick(cafe)}
              className="bg-zinc-900/90 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col shadow-lg cursor-pointer hover:border-teal-500/50 transition-colors"
            >
              <div className="h-36 relative">
                <img src={cafe.photoUrls[0]} alt={cafe.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-300 flex items-center shadow-md">
                  <Star size={12} className="mr-1 fill-teal-300 text-teal-300" /> {cafe.rating.toFixed(1)}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-base text-white mb-1">{cafe.name}</h3>
                <p className="text-xs text-zinc-400 flex items-center mb-3">
                  <Navigation size={12} className="mr-1 text-teal-300" /> {cafe.station}エリア / {cafe.address.split('区')[1] || cafe.address}
                </p>
                
                <div className="flex space-x-2 mb-4">
                  <span className="text-[11px] font-semibold px-2.5 py-1 bg-zinc-800 text-cyan-400 rounded-md border border-zinc-700/50">作業 {cafe.scores.workability.toFixed(1)}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 bg-zinc-800 text-teal-300 rounded-md border border-zinc-700/50">おしゃれ {cafe.scores.stylishness.toFixed(1)}</span>
                </div>

                <p className="text-[11px] text-zinc-500 text-center py-2">
                  タップして詳細を表示
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <AdBanner adSlot="6579372244" />

      <CafeDetailBottomSheet 
        isOpen={showDetailModal}
        cafe={selectedCafe}
        onClose={handleCloseModal}
        adSlot="9876543210"
      />
    </div>
  );
}

/** スワイプカード */
function SwipeCard({ cafe, onLike, onDislike, onShowDetail }: SwipeCardProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const startX = useRef(0);
  
  const SWIPE_THRESHOLD = 90;

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

  const rotate = dragOffset * 0.04;
  const opacity = 1 - Math.abs(dragOffset) * 0.002;
  const isLiking = dragOffset > 20;
  const isDisliking = dragOffset < -20;

  return (
    <div className="absolute inset-0 flex flex-col p-4 pb-6">
      <div 
        {...bindEvents}
        className="relative flex-1 bg-zinc-900 rounded-[2rem] shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing border border-zinc-800 select-none"
        style={{
          transform: isDragging 
            ? `translateX(${dragOffset}px) rotate(${rotate}deg)` 
            : (isVisible ? 'translateX(0) scale(1)' : 'translateX(0) scale(0.95)'),
          opacity: isDragging ? opacity : (isVisible ? 1 : 0),
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out'
        }}
      >
        <div className="absolute inset-0 z-20 flex items-center justify-between px-8 pointer-events-none">
          <div className={`w-16 h-16 rounded-full bg-emerald-500/90 backdrop-blur-md flex items-center justify-center text-white transform transition-all border border-emerald-400 ${isLiking ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            <Heart size={32} fill="currentColor" />
          </div>
          <div className={`w-16 h-16 rounded-full bg-rose-500/90 backdrop-blur-md flex items-center justify-center text-white transform transition-all border border-rose-400 ${isDisliking ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            <X size={32} />
          </div>
        </div>

        {onShowDetail && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowDetail(cafe);
            }}
            className="absolute top-4 right-4 z-30 w-9 h-9 bg-zinc-950/80 backdrop-blur-md rounded-full flex items-center justify-center text-teal-300 hover:bg-teal-500/20 hover:text-teal-200 transition-all border border-teal-500/30 pointer-events-auto shadow-lg"
            title="詳細を表示"
          >
            <Info size={18} />
          </button>
        )}

        <img 
          src={cafe.photoUrls[0]} 
          alt={cafe.name} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
          <div className="flex justify-between items-end mb-1">
            <h2 className="text-xl font-bold leading-snug text-white drop-shadow-md">{cafe.name}</h2>
            <div className="flex items-center space-x-1 bg-zinc-950/80 border border-zinc-800 px-2 py-1 rounded-lg backdrop-blur-md shrink-0">
              <Star size={13} className="text-teal-300 fill-teal-300" />
              <span className="text-xs font-bold text-teal-300">{cafe.rating.toFixed(1)}</span>
            </div>
          </div>
          
          <p className="text-xs text-zinc-400 mb-3 flex items-center">
            <MapPin size={12} className="mr-1 text-teal-300" />
            {cafe.station}エリア
          </p>

          <div className="space-y-2 mb-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1 text-zinc-300 font-medium">
                <span>💻 作業適性</span>
                <span className="text-cyan-400 font-bold">{cafe.scores.workability.toFixed(1)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(cafe.scores.workability / 5) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1 text-zinc-300 font-medium">
                <span>✨ おしゃれ度</span>
                <span className="text-teal-300 font-bold">{cafe.scores.stylishness.toFixed(1)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-teal-400 to-cyan-400 h-1.5 rounded-full" style={{ width: `${(cafe.scores.stylishness / 5) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            {cafe.features.hasWifi && (
              <div className="flex items-center space-x-1 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-300">
                <Wifi size={12} className="text-teal-300" /> <span>Wi-Fi</span>
              </div>
            )}
            {cafe.features.hasOutlet && (
              <div className="flex items-center space-x-1 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-300">
                <BatteryCharging size={12} className="text-teal-300" /> <span>電源</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center space-x-8 mt-4 shrink-0">
        <button 
          onClick={() => {
            setDragOffset(-SWIPE_THRESHOLD - 50);
            setTimeout(() => onDislike(cafe.placeId), 200);
          }}
          className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-rose-400 hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
          title="スキップ"
        >
          <X size={26} />
        </button>
        <button 
          onClick={() => {
            setDragOffset(SWIPE_THRESHOLD + 50);
            setTimeout(() => onLike(cafe.placeId), 200);
          }}
          className="w-14 h-14 bg-gradient-to-br from-teal-400 via-emerald-400 to-cyan-400 rounded-full flex items-center justify-center text-zinc-950 hover:brightness-110 transition-all shadow-lg shadow-teal-500/20 active:scale-95"
          title="お気に入り保存"
        >
          <Heart size={26} fill="currentColor" />
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