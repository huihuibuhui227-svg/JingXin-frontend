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
    utterance.onerror = (event) => {
      // 把错误码**挂成属性**再抛。原先只把它揉进 message 字符串里,于是调用方
      // 分不清「这段语音播不出来」和「它被后来的一次播放打断了」——
      // 而这两件事的处置完全相反:M2.6 要靠这个区分决定"提问窗口该不该上报"。
      const err = new Error(`语音播放失败: ${event.error}`) as Error & { code?: string };
      err.code = event.error;      // 'canceled' / 'interrupted' = 被自己人打断
      reject(err);
    };

    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
};
