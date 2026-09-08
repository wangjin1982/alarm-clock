import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';

const DEFAULT_CITY = '北京';
const MANUAL_CITY_KEY = 'alarm-clock-manual-city';

function loadManualCity(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(MANUAL_CITY_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

function saveManualCity(city: string | null) {
  try {
    if (city) {
      localStorage.setItem(MANUAL_CITY_KEY, city);
    } else {
      localStorage.removeItem(MANUAL_CITY_KEY);
    }
  } catch {
    // localStorage 不可用时忽略，手动城市仅本次会话生效
  }
}

type LocationPermission =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'services-disabled'
  | 'unsupported';

type LocationSource = 'system' | 'ip' | 'manual' | 'default';

export interface LocationCoordinates {
  lat: number;
  lon: number;
  accuracy?: number;
}

interface LocationData {
  city: string;
  coordinates: LocationCoordinates | null;
  loading: boolean;
  error: string | null;
  permission: LocationPermission;
  source: LocationSource;
}

interface SystemLocationResult {
  city: string | null;
  permission: LocationPermission;
  coordinates: LocationCoordinates | null;
  error: string | null;
}

interface NativeLocationResult {
  status: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  error?: string | null;
}

interface IpCityResult {
  city: string;
  coordinates: LocationCoordinates | null;
}

async function getCityByIP(): Promise<IpCityResult | null> {
  try {
    const response = await fetch('https://ipwho.is/', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get location');
    }

    const data = await response.json() as {
      success?: boolean;
      city?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!data.success || !data.city) {
      return null;
    }

    const coordinates = typeof data.latitude === 'number' && typeof data.longitude === 'number'
      ? { lat: data.latitude, lon: data.longitude }
      : null;

    return {
      city: cityMap[data.city] || data.city,
      coordinates,
    };
  } catch {
    return null;
  }
}

// IP 服务返回英文城市名，这里映射常用的中国城市
const cityMap: Record<string, string> = {
  Beijing: '北京',
  Shanghai: '上海',
  Guangzhou: '广州',
  Shenzhen: '深圳',
  Hangzhou: '杭州',
  Nanjing: '南京',
  Chengdu: '成都',
  Wuhan: '武汉',
  "Xi'an": '西安',
  Chongqing: '重庆',
  Tianjin: '天津',
  Suzhou: '苏州',
  Wuxi: '无锡',
  Ningbo: '宁波',
  Qingdao: '青岛',
  Dalian: '大连',
  Shenyang: '沈阳',
  Jinan: '济南',
  Harbin: '哈尔滨',
  Changchun: '长春',
  Zhengzhou: '郑州',
  Changsha: '长沙',
  Fuzhou: '福州',
  Xiamen: '厦门',
  Kunming: '昆明',
  Guiyang: '贵阳',
  Nanning: '南宁',
  Haikou: '海口',
  Lanzhou: '兰州',
  Yinchuan: '银川',
  Xining: '西宁',
  Urumqi: '乌鲁木齐',
  Lhasa: '拉萨',
  Hohhot: '呼和浩特',
  Taiyuan: '太原',
  Shijiazhuang: '石家庄',
  Hefei: '合肥',
  Nanchang: '南昌',
};

function mapNativePermission(status: string): LocationPermission {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'restricted':
      return 'restricted';
    case 'services-disabled':
      return 'services-disabled';
    case 'prompt':
      return 'prompt';
    default:
      return 'unsupported';
  }
}

async function getSystemLocation(): Promise<SystemLocationResult> {
  if (isTauri()) {
    try {
      const result = await invoke<NativeLocationResult>('request_system_location');
      const permission = mapNativePermission(result.status);

      if (permission !== 'granted' || result.latitude == null || result.longitude == null) {
        return {
          city: null,
          permission,
          coordinates: null,
          error: result.error ?? null,
        };
      }

      return {
        city: result.city ?? null,
        permission: 'granted',
        coordinates: {
          lat: result.latitude,
          lon: result.longitude,
          accuracy: result.accuracy ?? undefined,
        },
        error: null,
      };
    } catch (error) {
      return {
        city: null,
        permission: 'unsupported',
        coordinates: null,
        error: error instanceof Error ? error.message : '系统定位不可用',
      };
    }
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      city: null,
      permission: 'unsupported',
      coordinates: null,
      error: '当前环境不支持系统定位',
    };
  }

  const geolocationPromise = new Promise<SystemLocationResult>(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          city: null,
          permission: 'granted',
          coordinates: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          error: null,
        });
      },
      error => {
        resolve({
          city: null,
          permission: error.code === error.PERMISSION_DENIED ? 'denied' : 'unsupported',
          coordinates: null,
          error: error.message || '系统定位失败',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });

  // 部分环境（如内嵌 WebView）授权弹窗未决时 timeout 不生效，会无限挂起，
  // 这里加硬超时强制降级，避免堵死 IP 定位兜底
  const hardTimeout = new Promise<SystemLocationResult>(resolve => {
    window.setTimeout(() => resolve({
      city: null,
      permission: 'unsupported',
      coordinates: null,
      error: '系统定位超时，改用 IP 定位',
    }), 12000);
  });

  return Promise.race([geolocationPromise, hardTimeout]);
}

function getPermissionMessage(permission: LocationPermission, fallbackError: string | null) {
  if (permission === 'denied') {
    return '未授予系统定位权限，当前使用 IP 城市定位';
  }

  if (permission === 'restricted') {
    return '系统限制了定位访问，当前使用 IP 城市定位';
  }

  if (permission === 'services-disabled') {
    return '系统定位服务已关闭，当前使用 IP 城市定位';
  }

  return fallbackError;
}

export function useLocation() {
  const manualCity = loadManualCity();
  const [location, setLocation] = useState<LocationData>({
    city: manualCity ?? DEFAULT_CITY,
    coordinates: null,
    loading: !manualCity,
    error: null,
    permission: 'prompt',
    source: manualCity ? 'manual' : 'default',
  });
  const requestIdRef = useRef(0);

  const updateCity = useCallback((city: string) => {
    const trimmed = city.trim().slice(0, 30);
    if (!trimmed) {
      return;
    }

    saveManualCity(trimmed);
    requestIdRef.current += 1;
    setLocation(prev => ({
      ...prev,
      city: trimmed,
      coordinates: null,
      loading: false,
      error: null,
      source: 'manual',
    }));
  }, []);

  const refreshLocation = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // 手动指定城市视为放弃自动定位
    saveManualCity(null);

    setLocation(prev => ({
      ...prev,
      loading: true,
      error: null,
      source: prev.source === 'manual' ? 'default' : prev.source,
    }));

    const [systemLocation, ipResult] = await Promise.all([
      getSystemLocation(),
      getCityByIP(),
    ]);

    if (requestId !== requestIdRef.current) {
      return;
    }

    const ipCity = ipResult?.city ?? null;

    if (systemLocation.coordinates) {
      setLocation({
        city: systemLocation.city ?? ipCity ?? '当前位置',
        coordinates: systemLocation.coordinates,
        loading: false,
        error: null,
        permission: 'granted',
        source: 'system',
      });
      return;
    }

    setLocation(prev => ({
      city: prev.source === 'manual' ? prev.city : ipCity ?? DEFAULT_CITY,
      coordinates: prev.source === 'manual' ? null : ipResult?.coordinates ?? null,
      loading: false,
      error: getPermissionMessage(systemLocation.permission, systemLocation.error),
      permission: systemLocation.permission,
      source: prev.source === 'manual' ? 'manual' : ipCity ? 'ip' : 'default',
    }));
  }, []);

  useEffect(() => {
    // 已手动指定城市时不自动定位，直接按城市查天气
    if (!manualCity) {
      void refreshLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = useMemo(() => {
    if (location.loading) {
      return '正在请求系统定位权限...';
    }

    if (location.source === 'system') {
      return '已开启系统定位，天气会自动跟随当前位置';
    }

    if (location.source === 'manual') {
      return '当前使用手动城市，点击定位按钮可恢复自动定位';
    }

    if (location.permission === 'denied') {
      return '未授予系统定位权限，当前使用 IP 城市定位';
    }

    if (location.permission === 'restricted') {
      return '系统限制了定位访问，当前使用 IP 城市定位';
    }

    if (location.permission === 'services-disabled') {
      return '系统定位服务已关闭，当前使用 IP 城市定位';
    }

    if (location.source === 'ip') {
      return '当前使用 IP 城市定位';
    }

    return location.error;
  }, [location]);

  return {
    city: location.city,
    coordinates: location.coordinates,
    loading: location.loading,
    error: location.error,
    permission: location.permission,
    source: location.source,
    statusText,
    setCity: updateCity,
    refreshLocation,
  };
}
