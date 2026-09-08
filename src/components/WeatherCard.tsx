import { useEffect, useState } from 'react';
import { Cloud, MapPin, RefreshCw, Volume2, Loader2, LocateFixed, PenLine } from 'lucide-react';
import { useWeather } from '../hooks/useWeather';
import { useLocation } from '../hooks/useLocation';
import { SectionCard } from './SectionCard';

export interface WeatherSummary {
  icon: string;
  temperature: number;
  city: string;
}

interface WeatherCardProps {
  nickname: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** 天气数据变化时上报摘要（供时钟展示），无数据时上报 null */
  onSummaryChange?: (summary: WeatherSummary | null) => void;
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function WeatherCard({
  nickname,
  notificationsEnabled,
  soundEnabled,
  expanded,
  onToggle,
  onSummaryChange,
}: WeatherCardProps) {
  const location = useLocation();
  const [cityInput, setCityInput] = useState('');
  const { weather, loading, error, fetchWeather, speakWeather } = useWeather({
    initialCity: location.city,
    coordinates: location.coordinates,
    nickname,
    notificationsEnabled,
    soundEnabled,
  });

  useEffect(() => {
    onSummaryChange?.(
      weather
        ? { icon: weather.icon, temperature: weather.temperature, city: weather.city }
        : null,
    );
  }, [weather, onSummaryChange]);

  useEffect(() => {
    if (location.loading) {
      return;
    }

    void fetchWeather(location.city, location.coordinates, location.city);
  }, [location.loading, location.city, location.coordinates, fetchWeather]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchWeather(location.city, location.coordinates, location.city);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [location.city, location.coordinates, fetchWeather]);

  const handleSpeak = () => {
    if (weather) {
      speakWeather(weather);
    }
  };

  const refreshWeather = () => {
    void fetchWeather(location.city, location.coordinates, location.city);
  };

  const summary = weather
    ? <span className="text-sky-light">{weather.icon} {weather.temperature}° {weather.city}</span>
    : (loading || location.loading)
      ? <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />定位中…</span>
      : '暂无天气数据';

  const actions = (
    <>
      <button
        onClick={() => void location.refreshLocation()}
        disabled={location.loading}
        className="rounded-lg bg-white/10 p-2 text-slate-300 transition-colors hover:bg-white/20 disabled:opacity-50"
        title="重新定位"
      >
        <LocateFixed size={14} className={location.loading ? 'animate-pulse' : ''} />
      </button>
      <button
        onClick={refreshWeather}
        disabled={loading}
        className="rounded-lg bg-white/10 p-2 text-slate-300 transition-colors hover:bg-white/20 disabled:opacity-50"
        title="刷新天气"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onClick={handleSpeak}
        disabled={!weather}
        className="rounded-lg bg-white/10 p-2 text-slate-300 transition-colors hover:bg-white/20 disabled:opacity-50"
        title="播报天气"
      >
        <Volume2 size={14} />
      </button>
    </>
  );

  return (
    <SectionCard
      icon={<Cloud size={18} />}
      iconColor="text-sky-light"
      title="天气"
      expanded={expanded}
      onToggle={onToggle}
      summary={summary}
      actions={actions}
    >
      {weather ? (
        <div className="flex items-center gap-4 rounded-xl bg-white/5 p-3">
          <span className="text-4xl">{weather.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="shrink-0 text-slate-400" />
              <span className="truncate text-sm font-medium">{weather.city}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{weather.temperature}°</span>
              <span className="text-sm text-slate-400">{weather.description}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              湿度 {weather.humidity}% · 风速 {weather.windSpeed}m/s
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 p-4 text-xs text-slate-500">
          {loading || location.loading ? (
            <>
              <Loader2 size={14} className="animate-spin text-sky-400" />
              <span>正在获取当前位置和天气...</span>
            </>
          ) : (
            <span>暂无天气数据，点击右上角刷新重试</span>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      {!location.loading && location.statusText && (
        <p className={`mt-2 text-[11px] ${
          location.source === 'system' ? 'text-emerald-400/90' : 'text-slate-500'
        }`}>
          {location.statusText}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <PenLine size={13} className="shrink-0 text-slate-500" />
        <input
          type="text"
          value={cityInput}
          onChange={(event) => setCityInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && cityInput.trim()) {
              location.setCity(cityInput);
              setCityInput('');
            }
          }}
          placeholder={`手动输入城市，如：${location.city === '杭州' ? '上海' : '杭州'}`}
          maxLength={30}
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
        />
        <button
          onClick={() => {
            if (cityInput.trim()) {
              location.setCity(cityInput);
              setCityInput('');
            }
          }}
          disabled={!cityInput.trim()}
          className="shrink-0 rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs text-sky-300 transition-colors hover:bg-sky-500/30 disabled:opacity-40"
        >
          使用
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        手动城市会记住，点右上角定位按钮可恢复自动定位。
      </p>
    </SectionCard>
  );
}
