import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type MouseEvent, type TouchEvent, type SVGProps } from 'react';
import { MapPin, Wifi, BatteryCharging, Star, Heart, X, ExternalLink, ChevronLeft, List, Navigation } from 'lucide-react';

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

const MOCK_CAFES: Cafe[] = [
  {
    placeId: "ChIJ1",
    name: "ROASTERY TOKYO SHIBUYA",
    address: "東京都渋谷区神南1-2-3",
    station: "渋谷",
    mapPosition: { x: 45, y: 65 }, // 地図上の相対位置(%)
    rating: 4.7,
    photoUrls: ["https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80"],
    scores: { workability: 4.8, stylishness: 4.9 },
    features: { hasOutlet: true, hasWifi: true },
    isChain: false
  },
  {
    placeId: "ChIJ2",
    name: "Workspace Cafe 新宿",
    address: "東京都新宿区新宿3-1-1",
    station: "新宿",
    mapPosition: { x: 55, y: 35 },
    rating: 4.2,
    photoUrls: ["https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=600&q=80"],
    scores: { workability: 4.9, stylishness: 3.5 },
    features: { hasOutlet: true, hasWifi: true },
    isChain: false
  },
  {
    placeId: "ChIJ3",
    name: "Designers Lounge Cafe",
    address: "東京都渋谷区代官山町1-1",
    station: "渋谷",
    mapPosition: { x: 35, y: 75 },
    rating: 4.5,
    photoUrls: ["https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?auto=format&fit=crop&w=600&q=80"],
    scores: { workability: 3.2, stylishness: 5.0 },
    features: { hasOutlet: false, hasWifi: true },
    isChain: false
  },
  {
    placeId: "ChIJ4",
    name: "Book & Coffee Shinjuku",
    address: "東京都新宿区西新宿2-8-1",
    station: "新宿",
    mapPosition: { x: 40, y: 30 },
    rating: 4.4,
    photoUrls: ["https://images.unsplash.com/photo-1521017430209-f64710118e41?auto=format&fit=crop&w=600&q=80"],
    scores: { workability: 4.5, stylishness: 4.2 },
    features: { hasOutlet: true, hasWifi: false },
    isChain: false
  },
  {
    placeId: "ChIJ5",
    name: "渋谷ストリーム・ロースター",
    address: "東京都渋谷区渋谷3-21-3",
    station: "渋谷",
    mapPosition: { x: 55, y: 55 },
    rating: 4.6,
    photoUrls: ["https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80"],
    scores: { workability: 4.0, stylishness: 4.5 },
    features: { hasOutlet: true, hasWifi: true },
    isChain: false
  }
];

const generateTabelogUrl = (name: string, address: string) => {
  const areaMatch = address.match(/(.+?[市区町村])/);
  const area = areaMatch ? areaMatch[1] : '';
  const keyword = encodeURIComponent(`${name} ${area}`.trim());
  return `https://tabelog.com/rst/rstsearch/?keyword=${keyword}`;
};

export default function App() {
  const [view, setView] = useState<'top' | 'swipe' | 'list'>('top');
  const [selectedStation, setSelectedStation] = useState<Station>('all');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [dislikedIds, setDislikedIds] = useState<string[]>([]);

  // 初期マウント時のデータ復元
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

  const saveState = (likes: string[], dislikes: string[]) => {
    setLikedIds(likes);
    setDislikedIds(dislikes);
    localStorage.setItem('cafe_search_likes', JSON.stringify(likes));
    localStorage.setItem('cafe_search_dislikes', JSON.stringify(dislikes));
  };

  const handleLike = (id: string) => {
    saveState([...likedIds, id], dislikedIds);
  };

  const handleDislike = (id: string) => {
    saveState(likedIds, [...dislikedIds, id]);
  };

  const handleReset = () => {
    saveState([], []);
  };

  // フィルタリングと表示対象の算出
  const stationCafes = MOCK_CAFES.filter(c => selectedStation === 'all' || c.station === selectedStation);
  const evaluated = new Set<string>([...likedIds, ...dislikedIds]);
  const unseenCafes = stationCafes.filter(c => !evaluated.has(c.placeId));
  const likedCafes = stationCafes.filter(c => likedIds.includes(c.placeId));

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans">
      <div className="w-full max-w-[400px] h-[100dvh] sm:h-[800px] bg-white sm:rounded-[40px] sm:shadow-2xl overflow-hidden flex flex-col relative border-4 border-gray-900">
        
        {view === 'top' && (
          <TopScreen 
            selectedStation={selectedStation}
            setSelectedStation={setSelectedStation}
            likedCafes={likedCafes}
            unseenCount={unseenCafes.length}
            onGoToSwipe={() => setView('swipe')}
            onGoToList={() => setView('list')}
          />
        )}

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

      </div>
    </div>
  );
}

function TopScreen({ selectedStation, setSelectedStation, likedCafes, unseenCount, onGoToSwipe, onGoToList }: TopScreenProps) {
  const stations: { id: Station; label: string }[] = [
    { id: 'all', label: 'すべて' },
    { id: '渋谷', label: '渋谷' },
    { id: '新宿', label: '新宿' }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ヘッダー */}
      <header className="px-6 py-4 flex justify-between items-center bg-white shadow-sm z-20">
        <div className="flex items-center space-x-2 text-orange-600">
          <MapPin size={24} />
          <h1 className="font-bold text-xl tracking-tight">Cafe Map</h1>
        </div>
        <button 
          onClick={onGoToList}
          className="relative p-2 rounded-full text-gray-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
        >
          <List size={24} />
          {likedCafes.length > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-orange-600 rounded-full border-2 border-white"></span>
          )}
        </button>
      </header>

      {/* 駅選択タブ */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 z-10">
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

      {/* マップエリア（疑似実装） */}
      <div className="flex-1 relative bg-[#e5e7eb] overflow-hidden">
        {/* マップの背景模様（道路や区画のイメージ） */}
        <div className="absolute inset-0 opacity-20" style={{ 
          backgroundImage: 'linear-gradient(#cbd5e1 2px, transparent 2px), linear-gradient(90deg, #cbd5e1 2px, transparent 2px)', 
          backgroundSize: '40px 40px' 
        }}></div>
        <div className="absolute top-1/4 left-0 right-0 h-1 bg-white opacity-40 rotate-12"></div>
        <div className="absolute top-1/2 left-1/4 bottom-0 w-1 bg-white opacity-40 -rotate-12"></div>

        {/* プレースホルダーメッセージ（ピンがない場合） */}
        {likedCafes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur px-6 py-3 rounded-full text-sm font-medium text-gray-500 shadow-sm">
              カフェを探してピンを立てましょう
            </div>
          </div>
        )}

        {/* いいねしたカフェのピン */}
        {likedCafes.map(cafe => (
          <div 
            key={cafe.placeId} 
            className="absolute transform -translate-x-1/2 -translate-y-full transition-all duration-500" 
            style={{ left: `${cafe.mapPosition.x}%`, top: `${cafe.mapPosition.y}%` }}
          >
            <div className="relative group">
              <MapPin size={36} className="text-orange-600 fill-orange-500 drop-shadow-lg" />
              {/* ツールチップ的な店舗名表示 */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-white text-xs font-bold px-2 py-1 rounded shadow-md whitespace-nowrap text-gray-800 pointer-events-none border border-gray-100">
                {cafe.name}
              </div>
            </div>
          </div>
        ))}

        {/* スワイプ画面への動線ボタン */}
        <div className="absolute bottom-8 left-0 right-0 px-6 flex justify-center">
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
    </div>
  );
}

function SwipeScreen({ unseenCafes, onLike, onDislike, onBack, onReset }: SwipeScreenProps) {
  const currentCafe = unseenCafes[0];
  const isFinished = unseenCafes.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="px-4 py-3 flex items-center z-20">
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
            <div className="space-y-4 w-full">
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
            cafe={currentCafe} 
            onLike={onLike} 
            onDislike={onDislike} 
          />
        )}
      </div>
    </div>
  );
}

function ListScreen({ likedCafes, onBack }: ListScreenProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="px-4 py-3 flex items-center bg-white shadow-sm z-20">
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
  const startX = useRef(0);
  
  const SWIPE_THRESHOLD = 100;

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
          transform: `translateX(${dragOffset}px) rotate(${rotate}deg)`,
          opacity: isDragging ? opacity : 1,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s'
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

      <div className="flex justify-center space-x-8 mt-6">
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