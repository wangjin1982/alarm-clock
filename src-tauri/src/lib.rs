use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use std::ffi::{CStr, c_char};
#[cfg(target_os = "macos")]
use std::process::Command;
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};
#[cfg(target_os = "macos")]
use tauri::Manager;
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn alarm_clock_request_location_json(timeout_seconds: f64) -> *mut c_char;
    fn alarm_clock_free_c_string(value: *mut c_char);
}

#[derive(Clone, Default)]
struct PhaseScheduler {
    generation: Arc<AtomicU64>,
}

impl PhaseScheduler {
    fn next_generation(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
    }

    fn is_current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }
}

#[derive(Clone, Default)]
struct PomodoroScheduler(PhaseScheduler);

#[derive(Clone, Default)]
struct CountdownScheduler(PhaseScheduler);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PomodoroScheduleRequest {
    phase_id: String,
    duration_seconds: u64,
    mode: PomodoroMode,
    nickname: Option<String>,
    speech_text: Option<String>,
    notification_body: Option<String>,
    sound_enabled: bool,
    notifications_enabled: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PomodoroFinishedPayload {
    phase_id: String,
    completed_mode: PomodoroMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CountdownScheduleRequest {
    phase_id: String,
    duration_seconds: u64,
    nickname: Option<String>,
    speech_text: Option<String>,
    notification_body: Option<String>,
    sound_enabled: bool,
    notifications_enabled: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CountdownFinishedPayload {
    phase_id: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemLocationPayload {
    status: String,
    city: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    accuracy: Option<f64>,
    error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum PomodoroMode {
    Work,
    Break,
}

impl PomodoroMode {
    fn notification_body(self, nickname: Option<&str>) -> String {
        let prefix = nickname
            .filter(|name| !name.trim().is_empty())
            .map(|name| format!("{name}，"))
            .unwrap_or_default();

        match self {
            PomodoroMode::Work => format!("{prefix}番茄时间到了，起来喝点水休息一下吧。"),
            PomodoroMode::Break => format!("{prefix}休息时间结束了，下一轮番茄钟已经准备好了。"),
        }
    }
}

#[cfg(target_os = "macos")]
fn escape_applescript_text(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "windows")]
fn escape_powershell_text(text: &str) -> String {
    text.replace('\'', "''")
}

#[cfg(target_os = "windows")]
mod windows {
    use std::process::{Command, Output};

    pub(super) const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    const BASE64_TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    fn base64_encode(input: &[u8]) -> String {
        let mut encoded = String::with_capacity((input.len() + 2) / 3 * 4);
        for chunk in input.chunks(3) {
            let first = chunk[0] as u32;
            let second = chunk.get(1).copied().unwrap_or(0) as u32;
            let third = chunk.get(2).copied().unwrap_or(0) as u32;
            let value = (first << 16) | (second << 8) | third;
            encoded.push(BASE64_TABLE[((value >> 18) & 0x3f) as usize] as char);
            encoded.push(BASE64_TABLE[((value >> 12) & 0x3f) as usize] as char);
            if chunk.len() > 1 {
                encoded.push(BASE64_TABLE[((value >> 6) & 0x3f) as usize] as char);
            } else {
                encoded.push('=');
            }
            if chunk.len() > 2 {
                encoded.push(BASE64_TABLE[(value & 0x3f) as usize] as char);
            } else {
                encoded.push('=');
            }
        }
        encoded
    }

    pub(super) fn run_powershell_script(script: &str) -> Option<Output> {
        use std::os::windows::process::CommandExt;

        let mut utf16_le = Vec::with_capacity(script.len() * 2);
        for unit in script.encode_utf16() {
            utf16_le.extend_from_slice(&unit.to_le_bytes());
        }

        Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                &base64_encode(&utf16_le),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()
    }
}

fn speak_message(message: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("say").arg(message).status();
    }

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Add-Type -AssemblyName System.Speech; \
             $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
             $voice = $speaker.GetInstalledVoices() | Where-Object {{ $_.VoiceInfo.Culture.Name -like 'zh*' }} | Select-Object -First 1; \
             if ($voice) {{ $speaker.SelectVoice($voice.VoiceInfo.Name) }}; \
             $speaker.Speak('{}')",
            escape_powershell_text(message)
        );
        let _ = windows::run_powershell_script(&script);
    }
}

fn notify_message(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            escape_applescript_text(body),
            escape_applescript_text(title)
        );
        let _ = Command::new("osascript").args(["-e", &script]).status();
    }

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             Add-Type -AssemblyName System.Drawing; \
             $notify = New-Object System.Windows.Forms.NotifyIcon; \
             $notify.Icon = [System.Drawing.SystemIcons]::Information; \
             $notify.BalloonTipTitle = '{}'; \
             $notify.BalloonTipText = '{}'; \
             $notify.Visible = $true; \
             $notify.ShowBalloonTip(5000); \
             Start-Sleep -Seconds 6; \
             $notify.Dispose()",
            escape_powershell_text(title),
            escape_powershell_text(body)
        );
        let _ = windows::run_powershell_script(&script);
    }
}

fn deliver_phase_alert(
    notification_title: &str,
    fallback_body: String,
    speech_override: Option<&str>,
    notification_override: Option<&str>,
    sound_enabled: bool,
    notifications_enabled: bool,
) {
    let notification_body = notification_override
        .map(str::to_string)
        .unwrap_or(fallback_body);
    let speech_text = speech_override
        .map(str::to_string)
        .unwrap_or_else(|| notification_body.clone());

    if sound_enabled {
        speak_message(&speech_text);
    }

    if notifications_enabled {
        notify_message(notification_title, &notification_body);
    }
}

#[tauri::command]
fn schedule_pomodoro_phase(
    app: AppHandle,
    scheduler: State<'_, PomodoroScheduler>,
    request: PomodoroScheduleRequest,
) {
    let clock = scheduler.inner().0.clone();
    let generation = clock.next_generation();

    thread::spawn(move || {
        thread::sleep(Duration::from_secs(request.duration_seconds));

        if !clock.is_current(generation) {
            return;
        }

        let fallback_body = request.mode.notification_body(request.nickname.as_deref());
        deliver_phase_alert(
            "番茄钟提醒",
            fallback_body,
            request.speech_text.as_deref(),
            request.notification_body.as_deref(),
            request.sound_enabled,
            request.notifications_enabled,
        );

        let payload = PomodoroFinishedPayload {
            phase_id: request.phase_id,
            completed_mode: request.mode,
        };

        let _ = app.emit("pomodoro://finished", payload);
    });
}

#[tauri::command]
fn cancel_pomodoro_phase(scheduler: State<'_, PomodoroScheduler>) {
    scheduler.0.cancel();
}

#[tauri::command]
fn schedule_countdown_phase(
    app: AppHandle,
    scheduler: State<'_, CountdownScheduler>,
    request: CountdownScheduleRequest,
) {
    let clock = scheduler.inner().0.clone();
    let generation = clock.next_generation();

    thread::spawn(move || {
        thread::sleep(Duration::from_secs(request.duration_seconds));

        if !clock.is_current(generation) {
            return;
        }

        let prefix = request
            .nickname
            .as_deref()
            .filter(|name| !name.trim().is_empty())
            .map(|name| format!("{name}，"))
            .unwrap_or_default();
        let fallback_body = format!("{prefix}倒计时时间到了。");
        deliver_phase_alert(
            "倒计时提醒",
            fallback_body,
            request.speech_text.as_deref(),
            request.notification_body.as_deref(),
            request.sound_enabled,
            request.notifications_enabled,
        );

        let payload = CountdownFinishedPayload {
            phase_id: request.phase_id,
        };

        let _ = app.emit("countdown://finished", payload);
    });
}

#[tauri::command]
fn cancel_countdown_phase(scheduler: State<'_, CountdownScheduler>) {
    scheduler.0.cancel();
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct WindowsLocationReport {
    status: String,
    latitude: Option<f64>,
    longitude: Option<f64>,
    accuracy: Option<f64>,
    #[serde(rename = "errorCode")]
    error_code: Option<String>,
}

#[cfg(target_os = "windows")]
fn request_windows_location() -> Result<SystemLocationPayload, String> {
    const SCRIPT: &str = "$ErrorActionPreference = 'Stop'; \
        Add-Type -AssemblyName System.Runtime.WindowsRuntime; \
        [void][Windows.Devices.Geolocation.Geolocator, Windows.Devices.Geolocation, ContentType=WindowsRuntime]; \
        $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1; \
        $report = { param($status, $fields) $output = @{ status = $status } + $fields; $output | ConvertTo-Json -Compress }; \
        try { \
            $accessMethod = $asTask.MakeGenericMethod([Windows.Devices.Geolocation.GeolocationAccessStatus]); \
            $accessTask = $accessMethod.Invoke($null, @([Windows.Devices.Geolocation.Geolocator]::RequestAccessAsync())); \
            $access = $accessTask.Result; \
            if ($access -eq 'Allowed') { \
                $locator = [Windows.Devices.Geolocation.Geolocator]::new(); \
                $positionMethod = $asTask.MakeGenericMethod([Windows.Devices.Geolocation.Geoposition]); \
                $positionTask = $positionMethod.Invoke($null, @($locator.GetGeopositionAsync())); \
                if ($positionTask.Wait(15000)) { \
                    $position = $positionTask.Result; \
                    $point = $position.Coordinate.Point.Position; \
                    & $report 'granted' @{ latitude = $point.Latitude; longitude = $point.Longitude; accuracy = $position.Coordinate.Accuracy } \
                } else { \
                    & $report 'unsupported' @{ errorCode = 'timeout' } \
                } \
            } elseif ($access -eq 'Denied') { \
                & $report 'denied' @{} \
            } else { \
                & $report 'services-disabled' @{} \
            } \
        } catch { \
            & $report 'unsupported' @{ errorCode = 'exception' } \
        }";

    let output = windows::run_powershell_script(SCRIPT)
        .ok_or_else(|| "无法启动 PowerShell 获取系统定位".to_string())?;

    if !output.status.success() {
        return Err("系统定位脚本执行失败".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let report: WindowsLocationReport =
        serde_json::from_str(stdout.trim()).map_err(|error| format!("解析定位结果失败: {error}"))?;

    let error = match report.error_code.as_deref() {
        Some("timeout") => Some("系统定位超时，请稍后重试".to_string()),
        _ => Some("系统定位失败".to_string()),
    };

    Ok(SystemLocationPayload {
        status: report.status,
        city: None,
        latitude: report.latitude,
        longitude: report.longitude,
        accuracy: report.accuracy,
        error,
    })
}

#[tauri::command]
fn request_system_location() -> Result<SystemLocationPayload, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        let raw = alarm_clock_request_location_json(15.0);
        if raw.is_null() {
            return Err("获取系统定位失败".into());
        }

        let json = CStr::from_ptr(raw).to_string_lossy().into_owned();
        alarm_clock_free_c_string(raw);

        serde_json::from_str(&json).map_err(|error| format!("解析定位结果失败: {error}"))
    }

    #[cfg(target_os = "windows")]
    {
        request_windows_location()
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Err("当前平台暂不支持系统定位".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PomodoroScheduler::default())
        .manage(CountdownScheduler::default())
        .invoke_handler(tauri::generate_handler![
            schedule_pomodoro_phase,
            cancel_pomodoro_phase,
            schedule_countdown_phase,
            cancel_countdown_phase,
            request_system_location
        ])
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = _app.get_webview_window("main") {
                    window.set_title("桌面闹钟").ok();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
