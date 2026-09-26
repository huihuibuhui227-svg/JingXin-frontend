import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { voiceApi, dashboardApi, sessionApi } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import { speakText } from '@/utils/speech';

export const useAssessment = (type: 'interview' | 'research') => {
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [started, setStarted] = useState(false);

  const { addAnswer, currentQuestionIndex } = useAssessmentStore();

  // ── M2.6:自动播题 + 提问窗口上报(spec §5.6)────────────────────────────
  //
  // ⚠️ 序号**不用** store 的 `currentQuestionIndex`:那个只在 `addAnswer` 里 +1,
  //    而 `setQuestions` / `resetAssessment` 在仓库里**零调用方**(死代码)⟹
  //    同一个页面里连做两场时它从 10 接着数,不是"本场第几题"。服务端
  //    `questions.jsonl` 要的是**会话内 0 基**序号,所以这里自己数。
  //    (只做一场时两者一致;分叉只在第二场出现,而那时 store 那个数本来就坏了。)
  const questionIndexRef = useRef(-1);
  const questionRef = useRef('');
  // 每道题**首次成功播完**才上报一次,重播只当重播 —— 否则面试官在候选人作答
  // 中途重播会把 `ask_end` 推到后面,而 `response_latency = 首次开口 − ask_end`
  // 会因此变成负数(一个看着正常、其实无意义的数)。
  const reportedIndexesRef = useRef<Set<number>>(new Set());
  // 播放令牌:用来分辨"这次播放被后来的播放打断了"与"这次播放真失败了"。
  // 两者处置相反 —— 前者只是让位,后者必须喊出来。理由见 playAndMaybeReport 开头。
  const playTokenRef = useRef(0);

  const playAndMaybeReport = useCallback(async () => {
    const question = questionRef.current;
    const index = questionIndexRef.current;
    if (!question || index < 0) return;

    // 每次播放领一个令牌。`speakText` 开头会 `speechSynthesis.cancel()` ⟹
    // **后一次播放会打断前一次**,而前一次会以 `canceled`/`interrupted` 失败。
    // 没有令牌,被自己人打断的那次就会被当成"播题失败":轻则误弹一个红提示,
    // 重则在打断那一刻算出一个**看着正常、其实截断了的 `ask_end`** —— 后者更坏,
    // 因为它不留任何痕迹。
    const token = ++playTokenRef.current;
    const alreadyReported = reportedIndexesRef.current.has(index);
    // ★ 墙钟**秒** —— 服务端的量程闸拦毫秒(`session_meta._validate_window`)。
    // ⚠️ 这里取的是**本次播放开始**的时刻,不是 spec §5.6 字面上的"推题那一刻"。
    //    自动播就发生在推题的同一次调用里,两者相差毫秒 ⟹ 正常路径无差别;
    //    差别只在**自动播失败、事后手点重播**这一条兜底路径上:那时窗口是
    //    「重播开始→重播结束」,而不是把中间那段等待也算进去。对 M3 更干净,
    //    因为 `response_latency` 只用 `ask_end`,而窗口本身不该含空闲段。
    const askStart = Date.now() / 1000;

    // ⚠️ 看门狗:`speakText` 只在 `onend`/`onerror` 落定,而 Chromium 的语音合成有
    //    若干**不落定**的情形(标签页转后台、长句被浏览器截断、首次调用声音还没加载完)。
    //    没有它,这个 promise 会永远悬着 ⟹ 这道题静默无窗口,连一行日志都没有 ——
    //    而这个 diff 里其他每条失败路径至少都会喊一声。超时**不编 `ask_end`**,
    //    只把"缺了"这件事说出去。
    const timeoutMs = Math.max(10_000, question.length * 400);
    const timer = setTimeout(() => {
      // ⚠️ 超时**只是喊一声** —— 不编 `ask_end`,也**不放弃**这次播放:
      //    它要是随后真念完了(`onend` 到了),下面照样按**真时刻**上报。
      //    (先前的写法是 `Promise.race` 直接把这次播放判死,那会把一个
      //    "慢、但活着"的窗口白扔掉 —— 而那个窗口是真的。)
      console.warn(`⚠️ 第 ${index} 题的播放超过 ${Math.round(timeoutMs / 1000)} 秒仍未结束 —— `
        + '若最终收到结束事件,窗口仍会如实上报;否则收尾对账会把它点成漏报');
      message.warning('播题迟迟没有结束 —— 若一直没动静,请点「播放问题」重播', 8);
    }, timeoutMs);

    try {
      // `speakText` 在 `onend` 才 resolve ⟹ 那一刻才是"题问完",不是"回答提交"。
      await speakText(question);
    } catch (error: any) {
      if (token !== playTokenRef.current) return;   // 已被后一次播放取代:静默让位
      if (error?.code === 'canceled' || error?.code === 'interrupted') {
        // 走到这里说明令牌**是当前的** ⟹ 不是自己人接管(接管的话上面就 return 了),
        // 是浏览器/别处把这句掐了。这道题确实没被问完,如实不报(让收尾对账点成漏报),
        // 但不能像原先那样只留一行 warn —— 那种静默正是本项目在杀的。
        console.error(`❌ 第 ${index} 题的播放被外部取消,提问窗口缺失:`, error);
        message.error('播题被中断 —— 这道题的响应时延会缺失,请点「播放问题」重播');
        return;
      }
      // 真失败:不放 `ask_end` —— 宁可让收尾对账点成缺项,也不编一个时刻出来。
      console.error('❌ 播题失败,这道题的提问窗口将缺失:', error);
      if (alreadyReported) {
        // 已经报过的题重播失败没有后果,别用"时延会缺失"吓人(那是假话)。
        message.warning('重播失败(这道题的提问窗口已上报,不受影响)');
      } else {
        message.error('播题失败 —— 请点「播放问题」重试,否则这道题的响应时延会缺失');
      }
      return;
    } finally {
      clearTimeout(timer);
    }

    if (token !== playTokenRef.current) return;   // 本次已作废,别拿它的 askEnd 上报
    if (alreadyReported) return;                  // 重播:说完就行,不覆盖首次的窗口

    const askEnd = Date.now() / 1000;
    if (!(askEnd > askStart)) {
      // 零长/倒挂窗口服务端会 400(`session_meta._validate_window`)。不上报,**说出去**。
      console.error('❌ 提问窗口零长,不上报:', { askStart, askEnd });
      message.error('这道题的提问窗口无效(零长)—— 它的响应时延会缺失');
      return;
    }

    reportedIndexesRef.current.add(index);
    try {
      await sessionApi.reportQuestion({
        qid: question, index, ask_start: askStart, ask_end: askEnd
      });
      console.log(`🕐 提问窗口已上报:第 ${index} 题`, { askStart, askEnd });
    } catch (error: any) {
      // 把这题放回"未上报" —— 否则一次网络抖动就让它永久缺失。
      reportedIndexesRef.current.delete(index);
      console.error('❌ 提问窗口上报失败:', error?.response?.data ?? error);
      message.error('提问时刻上报失败 —— 这道题的响应时延会缺失');
    }
  }, []);

  /** 推一道题:记下会话内序号 → 自动朗读一次(使用者的裁定)→ 上报提问窗口。
   *  自动播与手动「播放问题」走同一个函数,所以两条路都不会漏报、也不会重复报。 */
  const pushQuestion = useCallback((question: string) => {
    questionIndexRef.current += 1;
    questionRef.current = question;
    setCurrentQuestion(question);
    void playAndMaybeReport();
  }, [playAndMaybeReport]);

  const start = useCallback(async () => {
    // 本场从头开始:序号归零、已上报集合清空(否则第二场会被第一场的记录挡住)。
    questionIndexRef.current = -1;
    questionRef.current = '';
    reportedIndexesRef.current = new Set();
    playTokenRef.current += 1;   // 作废上一场还在飞的播放,别让它把窗口写进新场次

    setLoading(true);
    try {
      console.log('🚀 开始启动多模态服务...');

      const facePromise = dashboardApi.runModule('face').catch(err => {
        console.warn('⚠️ FACE模块启动失败:', err.message);
        return null;
      });

      const gesturePromise = dashboardApi.runModule('gesture').catch(err => {
        console.warn('⚠️ GESTURE模块启动失败:', err.message);
        return null;
      });

      const voiceApiService = type === 'interview' ? voiceApi.interview : voiceApi.research;
      const voicePromise = voiceApiService.start();

      const [faceResult, gestureResult, voiceResult] = await Promise.allSettled([
        facePromise,
        gesturePromise,
        voicePromise
      ]);

      if (voiceResult.status === 'fulfilled') {
        // 推首题:顺带自动朗读一次并上报它的提问窗口(M2.6)。
        pushQuestion(voiceResult.value.question);
        console.log('✅ VOICE服务启动成功');
      } else {
        console.error('❌ VOICE服务启动失败:', voiceResult.reason);
        throw new Error('语音服务启动失败');
      }

      const services = ['语音'];
      if (faceResult.status === 'fulfilled' && faceResult.value) {
        services.push('面部');
        console.log('✅ FACE服务启动成功:', faceResult.value.message);
      }
      if (gestureResult.status === 'fulfilled' && gestureResult.value) {
        services.push('手势');
        console.log('✅ GESTURE服务启动成功:', gestureResult.value.message);
      }

      message.success(`${type === 'interview' ? '面试' : '科研评估'}已开始 - 已启动: ${services.join(', ')}分析`);
      setStarted(true);
      return true;
    } catch (error: any) {
      console.error('❌ 启动失败:', error);
      message.error(error.message || '启动失败，请检查后端服务是否正常运行');
      return false;
    } finally {
      setLoading(false);
    }
  }, [type, pushQuestion]);

  const submitAnswer = useCallback(async (answer: string, audioFile?: File) => {
    try {
      const api = type === 'interview' ? voiceApi.interview : voiceApi.research;

      // ⚠️ 二者**只能走一条**。两个端点在服务端**各自都会调一次 `add_answer`** ⟹
      //    同一道题被记两遍,题号指针每题前进两格:实测 `question_index = 0,2,4,6`,
      //    于是 8 题的题库答到第 4 题就"面试已结束"提前跳转;`transcript.json`
      //    里每句也重复一遍(实测 10 段实际只有 5 句)。
      //    有音频时**以音频为准**:服务端 ASR 文本与那份音频同源,`transcript.json`、
      //    连接词密度、声学特征都从同一份来,不会互相打架。
      //    代价(已与使用者确认):在输入框里手改过的识别结果不会被记录。
      if (audioFile) {
        await api.submitAudioAnswer(audioFile);
      } else if (answer.trim()) {
        await api.submitAnswer(answer);
      }

      addAnswer({
        question: currentQuestion,
        answer,
        timestamp: new Date(),
        audioFile
      });

      const nextResult = await api.getQuestion();
      if (nextResult.question) {
        pushQuestion(nextResult.question);
        return { hasNext: true };
      }

      // ★ 这里**刻意不**往 store 里塞一个合成的 evaluationResult。
      // 那个 store 会持久化(partialize 含 evaluationResult),而 ReportPage 有
      // "store 有结果就不问服务端"的短路 —— 塞一个 total_score: 0 / dimensions: {} 的
      // 合成结果进去,真实报告就**永远不会被取**,而且刷新后仍在。
      // 正确路径:报告页自己去 /api/report/structured 取(M2.1 已让该端点自报场次);
      // 也不在这里 fire-and-forget 调 runModule('report') —— 那正是账本跟进项 22
      // 要收口的东西,而它的失败只进 console.warn 属于本项目在杀的静默失效。
      message.success('评估已完成');
      return { hasNext: false };
    } catch (error) {
      console.error('提交回答失败:', error);
      message.error('提交回答失败');
      return { hasNext: true, error: true };
    }
  }, [type, currentQuestion, addAnswer, pushQuestion]);

  const getEvaluation = useCallback(async () => {
    try {
      const api = type === 'interview' ? voiceApi.interview : voiceApi.research;
      const result = await api.getEvaluation();
      return result;
    } catch (error) {
      console.error('获取评估结果失败:', error);
      message.error('获取评估结果失败');
      return null;
    }
  }, [type]);

  return {
    loading,
    currentQuestion,
    started,
    currentQuestionIndex,
    start,
    submitAnswer,
    // 「播放问题」按钮仍然在,只是现在它和自动播走同一条路:首次成功播完会上报
    // 提问窗口,重播不会覆盖它。
    playQuestion: playAndMaybeReport,
    getEvaluation
  };
};
