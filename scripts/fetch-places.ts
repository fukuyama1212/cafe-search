import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.PLACES_API_KEY;

// Firebase Admin SDK の初期化
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
initializeApp({
  credential: cert(serviceAccountPath),
});

// データベースID 'cafe-search' を指定
const db = getFirestore('cafe-search');

interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  photos?: Array<{ name: string }>;
}

function checkIsChain(name: string): boolean {
  const chainKeywords = ['ドトール', 'ベローチェ', 'スターバックス', 'タリーズ', 'サンマルク', 'エクセルシオール'];
  return chainKeywords.some((keyword) => name.includes(keyword));
}

async function fetchAndSyncShibuyaCafes() {
  if (!API_KEY) {
    console.error('エラー: .env.local に PLACES_API_KEY が設定されていません。');
    process.exit(1);
  }

  const endpoint = 'https://places.googleapis.com/v1/places:searchText';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos',
      },
      body: JSON.stringify({
        textQuery: '渋谷 カフェ 作業 勉強',
        languageCode: 'ja',
        pageSize: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error [${response.status}]: ${errorText}`);
    }

    const data: { places?: GooglePlace[] } = await response.json();
    const places = data.places || [];

    console.log(`Places APIから ${places.length} 件取得しました。Firestoreへの同期を開始します...`);

    for (const place of places) {
      const placeId = place.id;
      const cafeName = place.displayName?.text || '';

      // 写真リソース名をブラウザで直接表示可能な Places API Media URL に変換（最大5枚）
      const photoUrls = place.photos
        ? place.photos.slice(0, 5).map(
            (photo) =>
              `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=800&key=${API_KEY}`
          )
        : [];

      const cafeData = {
        placeId: placeId,
        name: cafeName,
        address: place.formattedAddress || '',
        station: '渋谷',
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
        mapPosition: { x: 50, y: 50 },
        rating: place.rating || 0.0,
        photoUrls: photoUrls, // 変換した画像URL配列を設定
        scores: {
          workability: 3.0,
          stylishness: 3.0,
        },
        features: {
          hasOutlet: false,
          hasWifi: false,
        },
        isChain: checkIsChain(cafeName),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.collection('cafes').doc(placeId).set(cafeData, { merge: true });
      console.log(`[保存完了] ${cafeName} (画像: ${photoUrls.length}枚)`);
    }

    console.log('\n✨ 画像URLを含めたすべてのデータが Firestore に同期されました！');
  } catch (error) {
    console.error('同期処理中にエラーが発生しました:', error);
  }
}

fetchAndSyncShibuyaCafes();
