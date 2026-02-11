
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, WordObject, GameStats, ScoreEntry } from './types';
import { DEFAULT_WORDS, TIME_OPTIONS, THEMES } from './constants';
import { shuffleArray, calculateWPM, calculateAccuracy, saveScore, getScoreHistory } from './utils';
import { generateThematicWords } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [words, setWords] = useState<WordObject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [duration, setDuration] = useState(60);
  const [selectedTopic, setSelectedTopic] = useState('random');
  const [customTopic, setCustomTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ScoreEntry[]>([]);
  
  const [stats, setStats] = useState<GameStats>({
    wpm: 0,
    accuracy: 0,
    correctWords: 0,
    incorrectWords: 0,
    totalKeystrokes: 0,
    timeSpent: 0
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordContainerRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(getScoreHistory());
  }, []);

  // Auto-scroll logic: ensures the current typing area is always visible
  useEffect(() => {
    if (wordContainerRef.current) {
      const activeWord = wordContainerRef.current.querySelector('.active-word');
      if (activeWord) {
        const container = wordContainerRef.current;
        const activeRect = (activeWord as HTMLElement).getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Scroll if word is hidden or nearing edges
        if (activeRect.bottom > containerRect.bottom - 40 || activeRect.top < containerRect.top + 40) {
          activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentIndex, inputValue]);

  const initGame = useCallback(async (customWords?: string[]) => {
    let baseWords = customWords || DEFAULT_WORDS;
    const shuffled = shuffleArray(baseWords).map((w): WordObject => ({
      text: w,
      status: 'pending'
    }));
    shuffled[0].status = 'active';
    
    setWords(shuffled);
    setCurrentIndex(0);
    setInputValue('');
    setTimeLeft(duration);
    setStatus('idle');
    setStats({
      wpm: 0,
      accuracy: 0,
      correctWords: 0,
      incorrectWords: 0,
      totalKeystrokes: 0,
      timeSpent: 0
    });
  }, [duration]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const startGame = () => {
    setStatus('playing');
    if (inputRef.current) inputRef.current.focus();
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('finished');
    
    setStats(prev => {
      const finalWpm = calculateWPM(prev.correctWords, duration);
      const finalAccuracy = calculateAccuracy(prev.correctWords, prev.incorrectWords);
      
      const newScore: ScoreEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        topic: selectedTopic === 'custom' ? customTopic : selectedTopic,
        wpm: finalWpm,
        accuracy: finalAccuracy,
        correctWords: prev.correctWords,
        incorrectWords: prev.incorrectWords,
        totalKeystrokes: prev.totalKeystrokes,
        timeSpent: duration
      };
      
      saveScore(newScore);
      setHistory(prevHist => [...prevHist, newScore]);
      
      return { ...prev, wpm: finalWpm, accuracy: finalAccuracy };
    });
  }, [duration, selectedTopic, customTopic]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (status === 'idle') {
      startGame();
    }

    if (val.endsWith(' ')) {
      const typedWord = val.trim();
      const currentWord = words[currentIndex].text;
      const isCorrect = typedWord === currentWord;

      setWords(prev => {
        const next = [...prev];
        next[currentIndex].status = isCorrect ? 'correct' : 'incorrect';
        if (currentIndex + 1 < next.length) {
          next[currentIndex + 1].status = 'active';
        }
        return next;
      });

      setStats(prev => ({
        ...prev,
        correctWords: isCorrect ? prev.correctWords + 1 : prev.correctWords,
        incorrectWords: isCorrect ? prev.incorrectWords : prev.incorrectWords + 1,
        totalKeystrokes: prev.totalKeystrokes + typedWord.length + 1
      }));

      setCurrentIndex(prev => prev + 1);
      setInputValue('');

      if (currentIndex + 10 > words.length) {
        setWords(prev => [...prev, ...shuffleArray(DEFAULT_WORDS).map((w): WordObject => ({ text: w, status: 'pending' }))]);
      }
    } else {
      // Keep input character limit tied to current word + buffer
      if (val.length <= words[currentIndex].text.length + 3) {
        setInputValue(val);
      }
    }
  };

  const handleThemeChange = async (themeId: string) => {
    setSelectedTopic(themeId);
    if (themeId === 'custom') return;

    setIsLoading(true);
    let newWords: string[] = [];
    if (themeId === 'tech') {
      newWords = await generateThematicWords('Computer science terminology, hardware, software, networking');
    } else if (themeId === 'nature') {
      newWords = await generateThematicWords('Geography, biological diversity, climate, environments');
    } else {
      newWords = DEFAULT_WORDS;
    }
    
    initGame(newWords.length > 0 ? newWords : undefined);
    setIsLoading(false);
  };

  const handleCustomTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic) return;
    setIsLoading(true);
    const newWords = await generateThematicWords(customTopic);
    initGame(newWords.length > 0 ? newWords : undefined);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-2 rounded-lg shadow-lg shadow-sky-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">TypingPulse <span className="text-sky-400">AI</span></h1>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setStatus('idle')}
            className="text-slate-400 hover:text-slate-100 transition-colors font-medium text-sm"
          >
            History
          </button>
        </div>
      </header>

      {status !== 'finished' ? (
        <main className="w-full flex flex-col gap-8 animate-in fade-in duration-500">
          {/* Settings Section */}
          <div className="flex flex-wrap justify-between items-end gap-6 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/40 backdrop-blur-sm">
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Game Theme</label>
              <div className="flex flex-wrap gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      selectedTopic === t.id 
                        ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {t.icon} <span className="ml-1">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Duration</label>
              <div className="flex gap-2">
                {TIME_OPTIONS.map(t => (
                  <button
                    key={t}
                    onClick={() => { setDuration(t); setTimeLeft(t); }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      duration === t 
                        ? 'bg-slate-100 border-white text-slate-900 shadow-lg shadow-white/10' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedTopic === 'custom' && (
            <form onSubmit={handleCustomTopicSubmit} className="flex gap-2 animate-in slide-in-from-top-4">
              <input
                type="text"
                placeholder="Type a topic for AI generation..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-slate-200"
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-sky-500/20"
              >
                {isLoading ? '...' : 'Generate'}
              </button>
            </form>
          )}

          {/* Core Word Display Container */}
          <div 
            onClick={() => inputRef.current?.focus()}
            className="relative group cursor-text"
          >
            <div className={`absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 ${status === 'playing' ? 'opacity-40' : ''}`}></div>
            <div className="relative bg-slate-900/90 border border-slate-800 rounded-2xl p-10 min-h-[340px] shadow-2xl overflow-hidden flex flex-col">
              
              {/* Live HUD */}
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800/50">
                <div className="flex gap-16">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Pace</span>
                    <span className="text-4xl font-black text-sky-400 mono">{calculateWPM(stats.correctWords, duration - timeLeft)} <span className="text-sm font-normal text-slate-600 tracking-tight">WPM</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Accuracy</span>
                    <span className="text-4xl font-black text-slate-300 mono">{calculateAccuracy(stats.correctWords, stats.incorrectWords)}<span className="text-sm font-normal text-slate-600">%</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Time</span>
                  <span className={`text-4xl font-black mono transition-all ${timeLeft <= 10 ? 'text-rose-500 scale-110 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'text-slate-100'}`}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Word Display (The Requested "RichText" Logic) */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
                  <div className="w-10 h-10 border-4 border-sky-500/10 border-t-sky-500 rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm font-medium tracking-wide">Syncing Dictionary...</p>
                </div>
              ) : (
                <div 
                  ref={wordContainerRef}
                  className="flex-1 text-2xl font-medium leading-[2] select-none overflow-y-auto pr-4 mono tracking-tight"
                >
                  <div className="flex flex-wrap items-center">
                    {words.map((w, idx) => {
                      const isPast = idx < currentIndex;
                      const isCurrent = idx === currentIndex;
                      const isFuture = idx > currentIndex;

                      // Past Words: Dimmed
                      if (isPast) {
                        return (
                          <span 
                            key={idx} 
                            className={`mr-[1ch] transition-colors duration-300 ${w.status === 'correct' ? 'text-slate-100/30' : 'text-rose-500/50 line-through'}`}
                          >
                            {w.text}
                          </span>
                        );
                      }

                      // Current Word: Character-level Matching
                      if (isCurrent) {
                        const wordText = w.text;
                        const typed = inputValue;
                        
                        let matchPart = "";
                        let remainingPart = "";
                        
                        // Check which part of typed input matches the word prefix
                        for (let i = 0; i < typed.length; i++) {
                          if (i < wordText.length && typed[i] === wordText[i] && matchPart.length === i) {
                            matchPart += typed[i];
                          }
                        }
                        
                        // The rest of the word text
                        remainingPart = wordText.substring(matchPart.length);

                        return (
                          <span key={idx} className="mr-[1ch] active-word inline-block">
                            <span className="text-slate-100 font-bold underline decoration-sky-500 decoration-2 underline-offset-4">{matchPart}</span>
                            <span className="text-yellow-600 opacity-90">{remainingPart}</span>
                          </span>
                        );
                      }

                      // Future Words: Standard
                      if (isFuture) {
                        return (
                          <span key={idx} className="mr-[1ch] text-slate-600 transition-colors">
                            {w.text}
                          </span>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              )}

              {/* Hidden System Input */}
              <input
                ref={inputRef}
                type="text"
                autoFocus
                disabled={isLoading}
                autoCapitalize="off"
                autoComplete="off"
                spellCheck="false"
                className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && inputValue === '' && currentIndex > 0) {
                    e.preventDefault();
                  }
                }}
              />
              
              {/* Ready State Modal Overlay */}
              {status === 'idle' && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity rounded-2xl z-30">
                  <div className="bg-slate-800 border border-slate-700/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6">
                    <div className="text-slate-400 text-center text-sm font-medium">
                       Press space after words. <br/>
                       Begin typing to start the race.
                    </div>
                    <button 
                      onClick={() => inputRef.current?.focus()}
                      className="bg-sky-500 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-sky-500/20 hover:bg-sky-400 hover:scale-105 active:scale-95 transition-all"
                    >
                      Focus & Start
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* Post-Game Summary Section */
        <main className="w-full flex flex-col gap-10 animate-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-3xl text-center backdrop-blur-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Speed</div>
              <div className="text-4xl font-black text-sky-400 mono">{stats.wpm}</div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">WPM</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-3xl text-center backdrop-blur-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Accuracy</div>
              <div className="text-4xl font-black text-emerald-400 mono">{stats.accuracy}%</div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">Consistency</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-3xl text-center backdrop-blur-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Words</div>
              <div className="text-4xl font-black text-slate-100 mono">{stats.correctWords}</div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">Correct</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-3xl text-center backdrop-blur-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Errors</div>
              <div className="text-4xl font-black text-rose-500 mono">{stats.incorrectWords}</div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">Typos</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 border border-slate-700/30 p-8 rounded-3xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-sky-400 rounded-full"></div>
                Progress Chart
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="wpm" 
                      stroke="#38bdf8" 
                      strokeWidth={3} 
                      dot={{ fill: '#38bdf8', strokeWidth: 2, r: 4, stroke: '#0f172a' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/30 rounded-3xl overflow-hidden shadow-2xl">
               <div className="p-6 border-b border-slate-700/30 flex justify-between items-center bg-slate-800/40">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-400 rounded-full"></div>
                    Leaderboard
                  </h3>
                  <button 
                    onClick={() => { localStorage.removeItem('typing_scores'); setHistory([]); }}
                    className="text-[10px] text-slate-600 hover:text-rose-500 font-black uppercase transition-colors"
                  >
                    Reset
                  </button>
               </div>
               <div className="max-h-[240px] overflow-y-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-900/50 sticky top-0">
                     <tr className="text-[10px] text-slate-600 uppercase tracking-widest font-black">
                       <th className="px-6 py-4">Theme</th>
                       <th className="px-6 py-4">WPM</th>
                       <th className="px-6 py-4">Acc</th>
                       <th className="px-6 py-4">Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/30">
                     {[...history].sort((a, b) => b.timestamp - a.timestamp).map(score => (
                       <tr key={score.id} className="text-xs text-slate-400 hover:bg-sky-500/5 transition-colors group">
                         <td className="px-6 py-4 font-semibold text-slate-300 capitalize group-hover:text-sky-300">{score.topic}</td>
                         <td className="px-6 py-4 font-black text-sky-400 mono">{score.wpm}</td>
                         <td className="px-6 py-4 text-slate-500">{score.accuracy}%</td>
                         <td className="px-6 py-4 text-slate-600">
                           {new Date(score.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                         </td>
                       </tr>
                     ))}
                     {history.length === 0 && (
                       <tr>
                         <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic text-sm">Race data will appear here.</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <button 
              onClick={() => initGame()}
              className="bg-white text-slate-900 px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-sky-400 hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New Race
            </button>
          </div>
        </main>
      )}

      <footer className="mt-auto pt-8 pb-10 text-center text-slate-700 text-[10px] font-bold tracking-[0.3em] uppercase w-full">
        TYPINGPULSE AI • GEMINI 3 FLASH EDITION
      </footer>
    </div>
  );
};

export default App;
