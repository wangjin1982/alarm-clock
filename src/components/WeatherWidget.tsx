import { Cloud, MapPin, Plus, Trash2, Volume2, Clock, Loader2, RefreshCw, LocateFixed } from 'lucide-react';
import { useWeather } from '../hooks/useWeather';
import { useState, useEffect } from 'react';

interface WeatherWidgetProps {
  initialCity?: string;
  coordinates?: { lat: number; lon: number } | null;
  onCityChange?: (city: string) => void;
  onLocate?: () => void;
  locationSource?: 'system' | 'ip' | 'manual' | 'default';
  locationLoading?: boolean;
  locationStatusText?: string | null;
  usingSystemLocation?: boolean;
  nickname?: string;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
}

export function WeatherWidget({
  initialCity = '北京',
  coordinates = null,
  onCityChange,
  onLocate,
  locationSource = 'default',
  locationLoading,
  locationStatusText,
  usingSystemLocation = false,
  nickname = '',
  notificationsEnabled = true,
  soundEnabled = true,
}: WeatherWidgetProps) {
  const {
    weather,
    city,
    setCity,
    alarms,
    loading,
    error,
    addAlarm,
    removeAlarm,
    toggleAlarm,
    speakWeather,
    fetchWeather,
  } = useWeather({
    initialCity,
    coordinates,
    nickname,
    notificationsEnabled,
    soundEnabled,
  });

  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [newHour, setNewHour] = useState(8);
  const [newMinute, setNewMinute] = useState(0);

  // 当外部城市变化时更新
  useEffect(() => {
    if (initialCity && initialCity !== city) {
      setCity(initialCity);
    }
  }, [initialCity, city, setCity]);

  useEffect(() => {
    if (initialCity && locationSource !== 'manual') {
      void fetchWeather(initialCity, coordinates, initialCity);
    }
  }, [coordinates, fetchWeather, initialCity, locationSource]);

  const handleAddAlarm = () => {
    addAlarm(newHour, newMinute);
    setShowAddAlarm(false);
  };

  const handleSpeak = () => {
    if (weather) {
      speakWeather(weather);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCity = e.target.value;
    setCity(newCity);
    if (onCityChange) {
      onCityChange(newCity);
    }
  };

  // 手动刷新天气
  const handleRefreshWeather = () => {
    fetchWeather(city, coordinates, city);
  };

  // 输入框失焦或按回车时刷新天气
  const handleCityBlur = () => {
    fetchWeather(city, null, city);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchWeather(city, null, city);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-sky-light" />
          <span className="font-medium text-sm">天气闹钟</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLocate}
            disabled={locationLoading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-slate-300 disabled:opacity-50"
            title="重新定位"
          >
            <LocateFixed size={16} className={locationLoading ? 'animate-pulse' : ''} />
          </button>
          <button
            onClick={handleRefreshWeather}
            disabled={loading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-slate-300 disabled:opacity-50"
            title="刷新天气"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleSpeak}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
            title="播报天气"
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      {/* 城市选择 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
          <MapPin size={16} className="text-slate-400" />
          <input
            type="text"
            value={city}
            onChange={handleCityChange}
            onBlur={handleCityBlur}
            onKeyDown={handleCityKeyDown}
            placeholder="输入城市名称，按回车确认"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
          {locationLoading && (
            <Loader2 size={14} className="animate-spin text-sky-400" />
          )}
        </div>
        {(locationLoading || locationStatusText) && (
          <p
            className={`mt-1 text-xs ${
              usingSystemLocation ? 'text-emerald-400/90' : 'text-slate-500'
            }`}
          >
            {locationLoading ? '正在定位您的城市...' : locationStatusText}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* 天气显示 */}
      {weather && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-white/5 rounded-xl">
          <span className="text-4xl">{weather.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
              <span className="text-sm font-medium">{weather.city}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{weather.temperature}°</span>
              <span className="text-sm text-slate-400">{weather.description}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              湿度 {weather.humidity}% · 风速 {weather.windSpeed}m/s
            </div>
          </div>
        </div>
      )}

      {/* 闹钟列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock size={12} />
            闹钟列表
          </span>
          <button
            onClick={() => setShowAddAlarm(true)}
            className="p-1 rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {alarms.map(alarm => (
          <div
            key={alarm.id}
            className={`flex items-center justify-between p-2 rounded-lg transition-all ${
              alarm.enabled 
                ? 'bg-sky-500/10 border border-sky-500/20' 
                : 'bg-white/5 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-lg font-mono ${alarm.enabled ? 'text-sky-400' : 'text-slate-500'}`}>
                {alarm.hour.toString().padStart(2, '0')}:{alarm.minute.toString().padStart(2, '0')}
              </span>
              {alarm.enabled && (
                <span className="text-xs text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-full">
                  已开启
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAlarm(alarm.id)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  alarm.enabled ? 'bg-sky-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    alarm.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                onClick={() => removeAlarm(alarm.id)}
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 添加闹钟弹窗 */}
      {showAddAlarm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-2xl border border-white/10 w-64">
            <h3 className="font-medium mb-4">添加天气闹钟</h3>
            <div className="flex items-center justify-center gap-2 mb-4">
              <select
                value={newHour}
                onChange={(e) => setNewHour(Number(e.target.value))}
                className="bg-white/10 rounded-lg px-3 py-2 text-center"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-xl">:</span>
              <select
                value={newMinute}
                onChange={(e) => setNewMinute(Number(e.target.value))}
                className="bg-white/10 rounded-lg px-3 py-2 text-center"
              >
                {[0, 15, 30, 45].map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddAlarm(false)}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddAlarm}
                className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500 text-center">
        到设定时间自动播报当天天气
      </div>
    </div>
  );
}
