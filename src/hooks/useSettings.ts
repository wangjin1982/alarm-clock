import { useState, useEffect } from 'react';

export interface Settings {
  nickname: string;
  notifications: boolean;
  soundEnabled: boolean;
  alwaysOnTop: boolean;
}

const defaultSettings: Settings = {
  nickname: '',
  notifications: true,
  soundEnabled: true,
  alwaysOnTop: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  // 从 localStorage 加载设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alarm-clock-settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings({ ...defaultSettings, ...parsed });
        } catch {
          // 解析失败使用默认值
        }
      }
      setLoaded(true);
    }
  }, []);

  // 保存到 localStorage
  useEffect(() => {
    if (loaded && typeof window !== 'undefined') {
      localStorage.setItem('alarm-clock-settings', JSON.stringify(settings));
    }
  }, [settings, loaded]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleSetting = (key: keyof Settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return {
    settings,
    loaded,
    updateSetting,
    toggleSetting,
  };
}
