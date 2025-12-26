import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/genai";

// --- 1. 音效合成器 (Y2K Click) ---
const playClick = (ctx: AudioContext) => {
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 600;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) { console.error(e); }
};

// --- 2. 时钟组件 ---
const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
};

// --- 3. 类型定义 ---
type Sticker = { id: number; src: string; x: number; y: number; animation: string; };
type Card = { id: number; text: string; x: number; y: number; title?: string; };
type ModalMode = 'text' | 'audio' | 'sticker' | 'fx';

// --- 4. 主程序 ---
export default function App() {
  const [cards, setCards] = useState<Array<Card>>([]);
  const [stickers, setStickers] = useState<Array<Sticker>>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('text');
  const [inputText, setInputText] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  
  // 音频与特效状态
  const [audioName, setAudioName] = useState("INSERT TAPE");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fxSrc, setFxSrc] = useState<string | null>(null);
  const [pixelSize, setPixelSize] = useState(8);
  const [fxColor, setFxColor] = useState('#ffffff');
  const [fxAnimation, setFxAnimation] = useState('none');
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- 核心逻辑：AI 打印机 ---
  const startPrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setShowModal(false);

    const userInput = inputText || "EMPTY_MSG.TXT";
    const newId = Date.now();
    const x = Math.random() * 40 + 5; 
    const y = Math.random() * 40 + 5;
    
    // 初始化用户便签
    setCards(prev => [...prev, { id: newId, text: '█', x, y, title: '📝 USER_NOTE.TXT' }]);
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 用户打字效果
    for (let i = 0; i <= userInput.length; i++) {
      const currentText = userInput.substring(0, i) + (i < userInput.length ? '█' : '');
      setCards(prev => prev.map(c => c.id === newId ? { ...c, text: currentText } : c));
      if (i < userInput.length) playClick(audioCtx);
      await new Promise(r => setTimeout(r, 50));
    }
    setInputText('');

    // --- AI 对话部分 (修正版) ---
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // 必须是 VITE_ 开头
      if (!apiKey) throw new Error("API_KEY_MISSING");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `你是一个运行在2000年的复古电脑助手。用户说：“${userInput}”。请用中文给出一个简短、幽默、神经质的神回复（30字以内）。`;
      
      const result = await model.generateContent(prompt);
      const replyText = result.response.text();

      const replyId = Date.now() + 1;
      setCards(prev => [...prev, { id: replyId, text: '█', x: Math.min(x + 10, 70), y: Math.min(y + 15, 70), title: '🤖 SYSTEM_REPLY.EXE' }]);

      // AI 打字效果
      for (let i = 0; i <= replyText.length; i++) {
        const currentText = replyText.substring(0, i) + (i < replyText.length ? '█' : '');
        setCards(prev => prev.map(c => c.id === replyId ? { ...c, text: currentText } : c));
        if (i % 2 === 0) playClick(audioCtx);
        await new Promise(r => setTimeout(r, 30));
      }
    } catch (e) {
      console.error("AI Error:", e);
      setCards(prev => [...prev, { id: Date.now()+2, text: "FATAL ERROR: AI_OFFLINE\nCHECK VITE_GEMINI_API_KEY", x: 50, y: 50, title: '⚠️ SYS_ERR.LOG' }]);
    } finally {
      setIsPrinting(false);
    }
  };

  // --- 拖拽逻辑 (支持 Trash) ---
  const handleDragStart = (e: React.MouseEvent, id: number, type: 'card' | 'sticker') => {
    if ((e.target as HTMLElement).classList.contains('win-btn')) return;
    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX, startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const startLeft = rect.left, startTop = rect.top;

    const onMove = (ev: MouseEvent) => {
      el.style.left = `${startLeft + (ev.clientX - startX)}px`;
      el.style.top = `${startTop + (ev.clientY - startY)}px`;
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const trash = document.getElementById('trash-bin')?.getBoundingClientRect();
      if (trash && ev.clientX >= trash.left && ev.clientX <= trash.right && ev.clientY >= trash.top && ev.clientY <= trash.bottom) {
        type === 'card' ? setCards(p => p.filter(c => c.id !== id)) : setStickers(p => p.filter(s => s.id !== id));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 其余功能代码（Audio, FX Gen）保持原样...
  // (由于篇幅限制，此处省略重复的 Audio/FX 逻辑，请保留你之前版本中这些函数的实现)

  return (
    <>
      <div className="desktop-bar">
        <div className="bar-left"><div className="start-btn">❖ START</div></div>
        <div className="bar-right"><Clock /></div>
      </div>

      <div id="canvas">
        {stickers.map(s => (
          <div key={s.id} className={`sticker-wrapper anim-${s.animation}`} style={{left: s.x+'%', top: s.y+'%'}} onMouseDown={(e) => handleDragStart(e, s.id, 'sticker')}>
            <img src={s.src} className="sticker-img" />
          </div>
        ))}
        {cards.map(c => (
          <div key={c.id} className="card-wrapper win-frame" style={{left: c.x+'%', top: c.y+'%'}} onMouseDown={(e) => handleDragStart(e, c.id, 'card')}>
            <div className="title-bar">
              <div className="title-bar-text"><span>{c.title?.includes('SYS') ? '🤖' : '📝'}</span> {c.title}</div>
              <div className="win-btn" onClick={() => setCards(p => p.filter(x => x.id !== c.id))}>X</div>
            </div>
            <div className="win-body"><div className="card-content">{c.text}</div></div>
          </div>
        ))}
      </div>

      <div id="trash-bin" className="trash-bin"><div className="trash-icon">🗑️</div><div className="trash-label">TRASH</div></div>

      <div className="dock">
        <button className="y2k-btn" onClick={() => { setModalMode('text'); setShowModal(true); }}>📄 New Note</button>
        <button className="y2k-btn" onClick={() => { setModalMode('audio'); setShowModal(true); }}>🎵 Player</button>
        <button className="y2k-btn" onClick={() => { setModalMode('fx'); setShowModal(true); }}>⚡ FX Gen</button>
      </div>

      {showModal && (
        <div id="modal" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={`win-frame modal-window ${modalMode === 'fx' ? 'large' : ''}`}>
            <div className="title-bar">
              <div className="title-bar-text">{modalMode.toUpperCase()}.EXE</div>
              <div className="win-btn" onClick={() => setShowModal(false)}>X</div>
            </div>
            <div className="win-body">
              {modalMode === 'text' && (
                <>
                  <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Type a message..." />
                  <button className="y2k-btn" onClick={startPrint} disabled={isPrinting} style={{marginTop:10, float:'right'}}>OK</button>
                </>
              )}
              {/* 其他模式的 UI 保持不变 */}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
