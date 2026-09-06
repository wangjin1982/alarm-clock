use serde::{Deserialize, Serialize};
use std::{
    ffi::{CStr, c_char},
    process::Command,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

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

fn escape_applescript_text(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"")
}

fn speak_on_macos(message: &str) {
    #[cfg(target_os = "macos")]
    let _ = Command::new("say").arg(message).status();
}

fn notify_on_macos(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            escape_applescript_text(body),
            escape_applescript_text(title)
        );
        let _ = Command::new("osascript").args(["-e", &script]).status();
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
        speak_on_macos(&speech_text);
    }

    if notifications_enabled {
        notify_on_macos(notification_title, &notification_body);
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

    #[cfg(not(target_os = "macos"))]
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
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.set_title("桌面闹钟").ok();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
