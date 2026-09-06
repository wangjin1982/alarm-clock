export function playWebBeep(audio: HTMLAudioElement | null): void {
  if (!audio) {
    return;
  }

  audio.currentTime = 0;
  audio.play().catch(() => undefined);
}

export function showWebNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, { body, icon: '/favicon.svg' });
}

export function speakChinese(text: string, rate = 0.85, pitch = 0.9): void {
  if (!('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = rate;
  utterance.pitch = pitch;

  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v =>
    v.lang.includes('zh') &&
    (v.name.includes('Ting') || v.name.includes('Yaoyao') || v.name.includes('Meijia') || v.name.includes('Female'))
  );

  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  window.speechSynthesis.speak(utterance);
}
