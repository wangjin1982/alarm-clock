const POMODORO_QUOTES = [
  '先把这一轮做好，结果会替你说话。',
  '稳定专注二十五分钟，胜过分心忙碌一整天。',
  '每完成一个番茄，你都在把目标拉近一点。',
  '别急着看远方，先把眼前这一小段走稳。',
  '今天的自律，会变成明天的底气。',
  '专注不是压榨自己，而是把注意力还给重要的事。',
  '一次只做好一件事，力量就会慢慢聚拢。',
  '把现在这一分钟守住，整段时间都会站到你这边。',
  '你不是在硬撑，你是在给未来的自己铺路。',
  '完成比完美更重要，开始比犹豫更有力量。',
  '保持节奏，灵感会在行动里出现。',
  '安静做完这一轮，你会比刚才更强一点。',
];

export function getNextPomodoroQuote(currentQuote?: string) {
  if (POMODORO_QUOTES.length === 1) {
    return POMODORO_QUOTES[0];
  }

  const availableQuotes = currentQuote
    ? POMODORO_QUOTES.filter((quote) => quote !== currentQuote)
    : POMODORO_QUOTES;

  const randomIndex = Math.floor(Math.random() * availableQuotes.length);
  return availableQuotes[randomIndex];
}
