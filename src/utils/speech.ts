export const speakText = (text: string, lang: string = 'zh-CN'): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('浏览器不支持语音播放'));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`语音播放失败: ${event.error}`));

    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
};
