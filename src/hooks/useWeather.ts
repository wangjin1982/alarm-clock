import { useState, useEffect, useCallback } from 'react';

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

interface WeatherAlarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  triggeredToday: boolean;
}

interface GeocodingResult {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  population?: number;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface UseWeatherOptions {
  initialCity?: string;
  coordinates?: { lat: number; lon: number } | null;
  nickname?: string;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
}

const weatherCodeMap: Record<number, { description: string; icon: string }> = {
  0: { description: '晴', icon: '☀️' },
  1: { description: '多云', icon: '⛅' },
  2: { description: '多云', icon: '⛅' },
  3: { description: '阴', icon: '☁️' },
  45: { description: '雾', icon: '🌫️' },
  48: { description: '雾凇', icon: '🌫️' },
  51: { description: '毛毛雨', icon: '🌧️' },
  53: { description: '小雨', icon: '🌧️' },
  55: { description: '中雨', icon: '🌧️' },
  56: { description: '冻雨', icon: '🌨️' },
  57: { description: '冻雨', icon: '🌨️' },
  61: { description: '小雨', icon: '🌧️' },
  63: { description: '中雨', icon: '🌧️' },
  65: { description: '大雨', icon: '🌧️' },
  66: { description: '冻雨', icon: '🌨️' },
  67: { description: '冻雨', icon: '🌨️' },
  71: { description: '小雪', icon: '❄️' },
  73: { description: '中雪', icon: '❄️' },
  75: { description: '大雪', icon: '❄️' },
  77: { description: '雪粒', icon: '❄️' },
  80: { description: '阵雨', icon: '🌦️' },
  81: { description: '强阵雨', icon: '🌧️' },
  82: { description: '暴雨', icon: '⛈️' },
  85: { description: '阵雪', icon: '🌨️' },
  86: { description: '强阵雪', icon: '🌨️' },
  95: { description: '雷雨', icon: '⛈️' },
  96: { description: '雷雨伴冰雹', icon: '⛈️' },
  99: { description: '强雷雨', icon: '⛈️' },
};

const chineseCityPattern = /[\u4e00-\u9fff]/;
const citySuffixPattern = /[市州盟地区县区旗]$/;
const featureCodeScore: Record<string, number> = {
  PPLC: 1000,
  PPLA: 950,
  PPLA2: 900,
  PPLA3: 860,
  PPLA4: 820,
  PPLG: 760,
  PPL: 620,
  PPLL: 580,
  AIRB: 300,
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return '早上好';
  }
  if (hour >= 12 && hour < 14) {
    return '中午好';
  }
  if (hour >= 14 && hour < 18) {
    return '下午好';
  }
  if (hour >= 18 && hour < 22) {
    return '晚上好';
  }
  return '夜深了';
}

function getActivitySuggestion() {
  const hour = new Date().getHours();
  if (hour >= 9 && hour < 18) {
    return '工作久了，建议站起来活动活动，喝点水，看看远处的风景';
  }
  if (hour >= 22 || hour < 6) {
    return '时间不早了，建议早点休息，保证充足的睡眠';
  }
  return '记得适当休息，保持良好的作息习惯';
}

function normalizeCityName(cityName: string) {
  return cityName.trim().replace(/\s+/g, '');
}

function buildGeocodingQueries(cityName: string) {
  const normalized = normalizeCityName(cityName);
  const queries = [normalized];

  if (chineseCityPattern.test(normalized) && !citySuffixPattern.test(normalized)) {
    queries.push(`${normalized}市`);
  }

  return Array.from(new Set(queries));
}

async function fetchGeocodingResults(query: string): Promise<GeocodingResult[]> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=zh&format=json`
    );

    if (!response.ok) {
      throw new Error('获取城市坐标失败');
    }

    const data = await response.json() as GeocodingResponse;
    return data.results ?? [];
  } catch (error) {
    console.error('获取城市坐标错误:', error);
    return [];
  }
}

function scoreGeocodingCandidate(candidate: GeocodingResult, cityName: string) {
  const normalizedInput = normalizeCityName(cityName);
  const inputWithoutSuffix = normalizedInput.replace(citySuffixPattern, '');
  const candidateName = normalizeCityName(candidate.name);
  const candidateWithoutSuffix = candidateName.replace(citySuffixPattern, '');
  const admin2 = normalizeCityName(candidate.admin2 ?? '');

  let score = 0;

  if (candidate.country_code === 'CN') {
    score += 300;
  }

  if (candidateName === normalizedInput) {
    score += 500;
  }

  if (candidateWithoutSuffix === inputWithoutSuffix) {
    score += 420;
  }

  if (admin2 === normalizedInput || admin2 === inputWithoutSuffix) {
    score += 260;
  }

  if (candidate.feature_code) {
    score += featureCodeScore[candidate.feature_code] ?? 0;
  }

  if (candidate.population) {
    score += Math.min(candidate.population, 5_000_000) / 10_000;
  }

  if (candidate.feature_code === 'PPL' && !candidate.population) {
    score -= 120;
  }

  return score;
}

async function getCityCoordinates(cityName: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const queries = buildGeocodingQueries(cityName);
  const results = await Promise.all(queries.map(fetchGeocodingResults));

  const mergedCandidates = results
    .flat()
    .filter(candidate => candidate.latitude && candidate.longitude)
    .filter((candidate, index, allCandidates) => {
      const key = candidate.id ?? `${candidate.name}-${candidate.latitude}-${candidate.longitude}`;
      return allCandidates.findIndex(item => (item.id ?? `${item.name}-${item.latitude}-${item.longitude}`) === key) === index;
    });

  if (mergedCandidates.length === 0) {
    return null;
  }

  const bestCandidate = mergedCandidates
    .map(candidate => ({
      candidate,
      score: scoreGeocodingCandidate(candidate, cityName),
    }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;

  if (!bestCandidate) {
    return null;
  }

  return {
    lat: bestCandidate.latitude,
    lon: bestCandidate.longitude,
    name: bestCandidate.name,
  };
}

async function getWeatherData(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
    );

    if (!response.ok) {
      throw new Error('获取天气数据失败');
    }

    const data = await response.json();
    if (!data.current) {
      return null;
    }

    const current = data.current;
    const weatherCode = current.weather_code || 0;
    const weatherInfo = weatherCodeMap[weatherCode] || { description: '晴', icon: '☀️' };

    return {
      city: '',
      temperature: Math.round(current.temperature_2m),
      description: weatherInfo.description,
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      icon: weatherInfo.icon,
    };
  } catch (error) {
    console.error('获取天气数据错误:', error);
    return null;
  }
}

export function useWeather({
  initialCity = '北京',
  coordinates = null,
  nickname = '',
  notificationsEnabled = true,
  soundEnabled = true,
}: UseWeatherOptions = {}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState(initialCity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<WeatherAlarm[]>([
    { id: '1', hour: 8, minute: 0, enabled: false, triggeredToday: false },
  ]);

  const fetchWeather = useCallback(async (
    cityName: string,
    locationCoordinates: { lat: number; lon: number } | null = coordinates,
    displayCityName = cityName
  ) => {
    setLoading(true);
    setError(null);

    try {
      let weatherData: WeatherData | null = null;

      if (locationCoordinates) {
        weatherData = await getWeatherData(locationCoordinates.lat, locationCoordinates.lon);
      } else {
        const coords = await getCityCoordinates(cityName);
        if (!coords) {
          setError(`未找到城市“${cityName}”，请检查输入`);
          setLoading(false);
          return null;
        }

        weatherData = await getWeatherData(coords.lat, coords.lon);
        if (weatherData) {
          weatherData.city = coords.name;
        }
      }

      if (!weatherData) {
        setError('获取天气数据失败，请稍后重试');
        setLoading(false);
        return null;
      }

      if (locationCoordinates) {
        weatherData.city = displayCityName || '当前位置';
      }

      setWeather(weatherData);
      setLoading(false);
      return weatherData;
    } catch {
      setError('网络错误，请检查网络连接');
      setLoading(false);
      return null;
    }
  }, [coordinates]);

  const speakWeather = useCallback((data: WeatherData) => {
    if (!soundEnabled || !('speechSynthesis' in window)) {
      return;
    }

    const greeting = getTimeGreeting();
    const activity = getActivitySuggestion();

    let text = nickname ? `${nickname}，${greeting}！` : `${greeting}！`;
    text += `现在是${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}。${data.city}今天${data.description}，气温${data.temperature}度，湿度${data.humidity}%。${activity}。祝您有美好的一天！`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v =>
      v.lang.includes('zh') &&
      (v.name.includes('Ting') || v.name.includes('Yaoyao') || v.name.includes('Meijia') || v.name.includes('Female'))
    );

    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [nickname, soundEnabled]);

  const addAlarm = useCallback((hour: number, minute: number) => {
    const id = Date.now().toString();
    setAlarms(prev => [...prev, { id, hour, minute, enabled: true, triggeredToday: false }]);
  }, []);

  const removeAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.filter(alarm => alarm.id !== id));
  }, []);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.map(alarm =>
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) {
      return;
    }

    const checkAlarms = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      if (currentSecond !== 0) {
        return;
      }

      alarms.forEach(alarm => {
        if (!alarm.enabled || alarm.triggeredToday) {
          return;
        }

        if (alarm.hour === currentHour && alarm.minute === currentMinute) {
          fetchWeather(city, coordinates, city).then(data => {
            if (!data) {
              return;
            }

            if (soundEnabled) {
              speakWeather(data);
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('天气闹钟', {
                body: `${data.city}今天${data.description}，${data.temperature}°C`,
                icon: '/favicon.svg',
              });
            }
          });

          setAlarms(prev => prev.map(item =>
            item.id === alarm.id ? { ...item, triggeredToday: true } : item
          ));
        }
      });

      if (currentHour === 0 && currentMinute === 0) {
        setAlarms(prev => prev.map(alarm => ({ ...alarm, triggeredToday: false })));
      }
    }, 1000);

    return () => clearInterval(checkAlarms);
  }, [alarms, city, coordinates, fetchWeather, notificationsEnabled, soundEnabled, speakWeather]);

  return {
    weather,
    city,
    setCity,
    loading,
    error,
    alarms,
    fetchWeather,
    addAlarm,
    removeAlarm,
    toggleAlarm,
    speakWeather,
  };
}
