import React, { useState, useEffect, useCallback } from 'react';
import { 
  Volume2, 
  RotateCcw, 
  Import, 
  CheckCircle2, 
  HelpCircle, 
  XCircle,
  ChevronRight,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

/**
 * Fisher-Yates Shuffle Algorithm
 */
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

/**
 * Furigana Parser (Kanji[Reading] -> Ruby HTML)
 */
const parseFurigana = (text) => {
  if (!text) return [];
  const regex = /([^\[\]]+)\[([^\[\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'ruby', base: match[1], rt: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

/**
 * TTS Text Cleaner
 */
const cleanForTTS = (text) => text.replace(/\[.*?\]/g, '');

const App = () => {
  // --- States ---
  const [importText, setImportText] = useState(() => {
    return localStorage.getItem('flashcard_import_text') || '';
  });
  const [deck, setDeck] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isImporting, setIsImporting] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('flashcard_import_text', importText);
  }, [importText]);

  /**
   * Web Speech API TTS
   */
  const speak = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanForTTS(text));
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * Import Logic (Handles Comma or Pipe)
   */
  const handleImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n').filter(line => line.trim());
    
    const rawCards = lines.map((line, index) => {
      const separatorMatch = line.match(/[,，|｜]/);
      let frontSide = "";
      let backSide = "";

      if (!separatorMatch) {
        frontSide = line.trim();
        backSide = "";
      } else {
        const idx = separatorMatch.index;
        frontSide = line.substring(0, idx).trim();
        backSide = line.substring(idx + 1).trim();
      }

      return {
        id: `card-${Date.now()}-${index}`,
        front: frontSide,
        back: backSide
      };
    }).filter(c => c.front);

    const shuffled = shuffleArray(rawCards);
    setDeck(shuffled);
    setQueue([...shuffled]);
    setCurrentIndex(0);
    setIsImporting(false);
  };

  /**
   * Spaced Repetition Logic
   */
  const nextCard = (action) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsFlipped(false); 

    setTimeout(() => {
      const currentCard = queue[currentIndex];
      let newQueue = [...queue];

      if (action === 'forgot') {
        newQueue.splice(currentIndex + 4, 0, { ...currentCard });
      } else if (action === 'blurry') {
        newQueue.splice(currentIndex + 9, 0, { ...currentCard });
      }

      setQueue(newQueue);
      setCurrentIndex(prev => prev + 1);
      setIsAnimating(false);
    }, 450); 
  };

  const restart = () => {
    setQueue(shuffleArray(deck));
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsImporting(false);
  };

  /**
   * Fixed Clear Logic: Removed window.confirm for better environment compatibility
   */
  const clearAll = () => {
    setIsImporting(true);
    setDeck([]);
    setQueue([]);
    setCurrentIndex(0);
    setImportText('');
    setIsFlipped(false);
    // Explicitly clear storage to ensure sync
    localStorage.removeItem('flashcard_import_text');
  };

  /**
   * Furigana Component
   */
  const RubyText = ({ text, className, rtColor = "text-indigo-500" }) => {
    const parts = parseFurigana(text);
    return (
      <span className={className}>
        {parts.map((part, i) => (
          part.type === 'ruby' ? (
            <ruby key={i} className="px-0.5">
              {part.base}<rt className={`text-[0.45em] mb-1.5 ${rtColor} font-bold`}>{part.rt}</rt>
            </ruby>
          ) : <span key={i}>{part.content}</span>
        ))}
      </span>
    );
  };

  const isFinished = currentIndex >= queue.length && queue.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 flex flex-col items-center justify-center p-4 md:p-8">
      
      {/* Top Controls (Visible when studying) */}
      {!isImporting && (
        <div className="fixed top-6 right-6 flex gap-2 z-50">
          <button 
            onClick={clearAll}
            className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full shadow-md border border-slate-200 transition-all flex items-center gap-2 group active:scale-95"
            title="清空词库并重置"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline text-sm font-bold pr-1">清空</span>
          </button>
          <button 
            onClick={() => setIsImporting(true)}
            className="p-3 bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-full shadow-md border border-slate-200 transition-all flex items-center gap-2 group active:scale-95"
          >
            <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden sm:inline text-sm font-bold pr-1">返回导入</span>
          </button>
        </div>
      )}

      {/* Import Screen */}
      {isImporting && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 animate-in fade-in zoom-in duration-300 border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                <Import size={24} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">日语学习闪卡</h2>
                <p className="text-sm text-slate-500">支持 逗号(,) 或 竖线(|) 分割。</p>
              </div>
            </div>
            {importText && (
              <button 
                onClick={() => setImportText('')}
                className="text-slate-400 hover:text-rose-500 transition-colors p-2"
                title="清空文本框"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <textarea
            className="w-full h-64 p-5 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm mb-6 resize-none shadow-inner"
            placeholder="羊云，ひつじぐも：空[そら]にきれいなひつじぐもが出[で]ています。&#10;先生[せんせい] | 老师&#10;美味しい[おいしい] , 好吃"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            开始挑战 (自动打乱) <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Study Screen */}
      {!isImporting && !isFinished && (
        <div className="w-full flex flex-col items-center">
          {/* Progress Bar */}
          <div className="w-full max-w-md mb-8 flex items-center gap-4 px-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-700 ease-out"
                style={{ width: `${(currentIndex / queue.length) * 100}%` }}
              />
            </div>
            <span className="text-slate-400 text-[10px] font-black w-10 text-right uppercase">
              {currentIndex + 1} / {queue.length}
            </span>
          </div>

          {/* 3D Stage */}
          <div className="w-full max-w-md card-perspective">
            <div 
              className={`card-container ${isFlipped ? 'is-flipped' : ''}`}
              onClick={() => !isAnimating && setIsFlipped(!isFlipped)}
            >
              {/* Front Side */}
              <div className="card-face face-front bg-white border border-slate-200 shadow-xl rounded-[2.5rem] p-8 flex flex-col items-center justify-center">
                <div className="flex-1 flex items-center justify-center">
                  <RubyText 
                    text={queue[currentIndex].front} 
                    className="text-4xl md:text-5xl font-bold leading-[2.2] text-slate-800 text-center"
                  />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); speak(queue[currentIndex].front); }}
                  className="mb-2 p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-full transition-all flex items-center gap-2 px-5 border border-slate-100 group active:scale-90 shadow-sm"
                >
                  <Volume2 size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Listen Front</span>
                </button>
              </div>

              {/* Back Side */}
              <div className="card-face face-back bg-indigo-600 border-4 border-indigo-500 shadow-xl rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-white">
                <div className="flex-1 flex items-center justify-center">
                  <RubyText 
                    text={queue[currentIndex].back} 
                    className="text-xl md:text-2xl font-medium leading-relaxed text-center"
                    rtColor="text-white"
                  />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); speak(queue[currentIndex].back || queue[currentIndex].front); }}
                  className="mb-2 p-3 bg-white/10 hover:bg-white/20 text-indigo-50 rounded-full transition-all flex items-center gap-2 px-5 border border-white/20 group active:scale-90 shadow-sm"
                >
                  <Volume2 size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-50">Listen Back</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Controls */}
          <div className={`mt-10 grid grid-cols-3 gap-4 w-full max-w-md transition-all duration-500 ${!isFlipped ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <button 
              onClick={() => nextCard('forgot')}
              className="group flex flex-col items-center gap-2 p-4 bg-white hover:bg-rose-50 border border-slate-200 rounded-2xl transition-all shadow-sm active:scale-95"
            >
              <XCircle className="text-rose-400 group-hover:text-rose-500 transition-colors" size={28} />
              <span className="text-[10px] font-black uppercase text-slate-400">忘记了</span>
            </button>
            <button 
              onClick={() => nextCard('blurry')}
              className="group flex flex-col items-center gap-2 p-4 bg-white hover:bg-amber-50 border border-slate-200 rounded-2xl transition-all shadow-sm active:scale-95"
            >
              <HelpCircle className="text-amber-400 group-hover:text-amber-500 transition-colors" size={28} />
              <span className="text-[10px] font-black uppercase text-slate-400">模糊</span>
            </button>
            <button 
              onClick={() => nextCard('remembered')}
              className="group flex flex-col items-center gap-2 p-4 bg-white hover:bg-emerald-50 border border-slate-200 rounded-2xl transition-all shadow-sm active:scale-95"
            >
              <CheckCircle2 className="text-emerald-400 group-hover:text-emerald-500 transition-colors" size={28} />
              <span className="text-[10px] font-black uppercase text-slate-400">记住了</span>
            </button>
          </div>
        </div>
      )}

      {/* Finished Screen */}
      {isFinished && (
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-12 text-center animate-in fade-in zoom-in border border-slate-100">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">学习完成！</h2>
          <p className="text-slate-500 mb-8 font-medium">所有内容已复习完毕。词库已保存在本地。</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={restart}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <RotateCcw size={18} /> 重新随机挑战
            </button>
            <button
              onClick={() => setIsImporting(true)}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
            >
              返回修改词库
            </button>
          </div>
        </div>
      )}

      {/* Core 3D CSS */}
      <style>{`
        .card-perspective {
          perspective: 1500px;
          height: 250px;
          width: 100%;
        }
        @media (min-width: 768px) {
          .card-perspective {
            height: 280px;
          }
        }
        .card-container {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-style: preserve-3d;
          cursor: pointer;
        }
        .is-flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          z-index: 1;
        }
        .face-front {
          transform: rotateY(0deg);
        }
        .face-back {
          transform: rotateY(180deg);
        }
        rt {
          ruby-position: over;
        }
      `}</style>
    </div>
  );
};

export default App;
