import { useEffect, useState, useCallback } from 'react';
import { Settings, X, GripHorizontal, Minus, User, Lock, Unlock } from 'lucide-react';
import { PomodoroTimer } from './components/PomodoroTimer';
import { WeatherWidget } from './components/WeatherWidget';
import { useSettings } from './hooks/useSettings';
import { useLocation } from './hooks/useLocation';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';

const LOCK_STORAGE_KEY = 'alarm-clock-window-locked';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTauriEnv] = useState(() => isTauri());
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(LOCK_STORAGE_KEY) === 'true';
  });
  const { settings, loaded, updateSetting, toggleSetting } = useSettings();
  const {
    city,
    coordinates,
    loading: locationLoading,
    source: locationSource,
    statusText: locationStatusText,
    setCity,
    refreshLocation,
  } = useLocation();

  const getAppWindow = useCallback(async () => {
    if (isTauriEnv) {
      return getCurrentWindow();
    }
    return null;
  }, [isTauriEnv]);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCK_STORAGE_KEY, String(isLocked));
    }
  }, [isLocked]);

  const syncWindowState = useCallback(async () => {
    if (!isTauriEnv) {
      return;
    }

    try {
      const appWindow = await getAppWindow();
      if (!appWindow) {
        return;
      }

      await Promise.allSettled([
        appWindow.setAlwaysOnTop(isLocked || settings.alwaysOnTop),
        appWindow.setResizable(!isLocked),
        appWindow.setClosable(!isLocked),
        appWindow.setMinimizable(!isLocked),
      ]);
    } catch (error) {
      console.error('同步窗口状态失败:', error);
    }
  }, [getAppWindow, isLocked, isTauriEnv, settings.alwaysOnTop]);

  useEffect(() => {
    void syncWindowState();
  }, [syncWindowState]);

  const minimizeWindow = useCallback(async () => {
    if (isLocked) return;
    try {
      const appWindow = await getAppWindow();
      if (appWindow) {
        await appWindow.minimize();
      }
    } catch (e) {
      console.error('最小化失败:', e);
    }
  }, [isLocked, getAppWindow]);

  const closeWindow = useCallback(async () => {
    if (isLocked) return;
    try {
      const appWindow = await getAppWindow();
      if (appWindow) {
        await appWindow.destroy();
      }
    } catch (e) {
      console.error('关闭失败:', e);
    }
  }, [isLocked, getAppWindow]);

  const toggleLock = useCallback(() => {
    if (!isTauriEnv) {
      alert('锁定功能仅在桌面应用中可用');
      return;
    }
    setIsLocked(prev => !prev);
  }, [isTauriEnv]);

  const startDraggingWindow = useCallback(async () => {
    if (!isTauriEnv || isLocked) {
      return;
    }

    try {
      const appWindow = await getAppWindow();
      await appWindow?.startDragging();
    } catch (error) {
      console.error('拖动窗口失败:', error);
    }
  }, [getAppWindow, isLocked, isTauriEnv]);

  const stopDragPropagation = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  if (!loaded) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>;
  }

  return (
    <div className="relative w-full h-full flex flex-col p-4 select-none">
      <div
        className={`flex items-center justify-between mb-4 rounded-2xl px-3 py-2 transition-colors ${
          isLocked ? 'bg-red-500/10' : 'bg-white/5 cursor-move'
        }`}
        onMouseDown={() => void startDraggingWindow()}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 group">
            {!isLocked ? (
              <>
                <button 
                  onClick={closeWindow}
                  onMouseDown={stopDragPropagation}
                  className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] hover:brightness-90 transition-all flex items-center justify-center group-hover:scale-110"
                  title="关闭"
                >
                  <X size={8} className="opacity-0 group-hover:opacity-100 text-[#4d0000]" />
                </button>
                <button 
                  onClick={minimizeWindow}
                  onMouseDown={stopDragPropagation}
                  className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] hover:brightness-90 transition-all flex items-center justify-center group-hover:scale-110"
                  title="最小化"
                >
                  <Minus size={8} className="opacity-0 group-hover:opacity-100 text-[#995700]" />
                </button>
                <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]" />
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-500" />
                <div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-500" />
                <div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-500" />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {settings.nickname && !isLocked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-tomato/20 text-tomato">
              {settings.nickname}
            </span>
          )}

          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              {formatTime(currentTime)}
            </div>
            <div className="text-base font-semibold tracking-tight tabular-nums text-slate-200">
              {formatDate(currentTime)}
            </div>
          </div>

          <button 
            onClick={toggleLock}
            onMouseDown={stopDragPropagation}
            className={`p-2 rounded-lg transition-all duration-300 ${
              isLocked 
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/40'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:scale-105'
            }`}
            title={isLocked ? '点击解锁' : '点击锁定'}
          >
            <span className="flex items-center gap-2">
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
              <span className="text-xs font-medium">{isLocked ? '已锁定' : '未锁定'}</span>
            </span>
          </button>

          {!isLocked && (
            <button 
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              onMouseDown={stopDragPropagation}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin">
        <PomodoroTimer
          soundEnabled={settings.soundEnabled}
          notificationsEnabled={settings.notifications}
          nickname={settings.nickname}
        />

        <WeatherWidget 
          initialCity={city} 
          coordinates={coordinates}
          onCityChange={setCity} 
          onLocate={() => void refreshLocation()}
          locationSource={locationSource}
          locationLoading={locationLoading}
          locationStatusText={locationStatusText}
          usingSystemLocation={locationSource === 'system'}
          nickname={settings.nickname}
          notificationsEnabled={settings.notifications}
          soundEnabled={settings.soundEnabled}
        />
      </div>

      {!isLocked && (
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-slate-500 cursor-move"
          onMouseDown={() => void startDraggingWindow()}
        >
          <GripHorizontal size={20} />
        </div>
      )}

      {isLocked && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-red-400/60">
          已锁定 · 窗口不可拖动、不可最小化、不可关闭
        </div>
      )}

      {isSettingsOpen && !isLocked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-white/10 w-full max-w-sm overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold">设置</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* 个性化设置 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <User size={16} />
                  <span>个性化</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">您的称呼</label>
                  <input
                    type="text"
                    value={settings.nickname}
                    onChange={(e) => updateSetting('nickname', e.target.value)}
                    placeholder="例如：金哥"
                    className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tomato/50"
                    maxLength={10}
                  />
                  <p className="text-xs text-slate-500">
                    设置后，语音播报时会先称呼您
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* 功能开关 */}
              <div className="space-y-3">
                <div className="text-sm text-slate-400 mb-2">功能设置</div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">通知提醒</span>
                    <p className="text-xs text-slate-500">番茄钟和闹钟结束时通知</p>
                  </div>
                  <button 
                    onClick={() => toggleSetting('notifications')}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      settings.notifications ? 'bg-sky-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.notifications ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">声音提醒</span>
                    <p className="text-xs text-slate-500">语音播报和提示音</p>
                  </div>
                  <button 
                    onClick={() => toggleSetting('soundEnabled')}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      settings.soundEnabled ? 'bg-sky-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">总在最前</span>
                    <p className="text-xs text-slate-500">解锁时窗口始终置顶</p>
                  </div>
                  <button 
                    onClick={() => toggleSetting('alwaysOnTop')}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      settings.alwaysOnTop ? 'bg-sky-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.alwaysOnTop ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* 关于 */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>版本</span>
                  <span>v1.0.0</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>运行环境</span>
                  <span>{isTauriEnv ? 'macOS 原生' : 'Web 浏览器'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
