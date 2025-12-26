import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Sound synthesis helper
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
  } catch (e) {
    console.error(e);
  }
};

const Clock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return <span>{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>;
};

// Types
type Sticker = {
    id: number;
    src: string;
    x: number;
    y: number;
    animation: string;
};

type Card = {
    id: number;
    text: string;
    x: number;
    y: number;
    title?: string; // Optional custom title
};

type ModalMode = 'text' | 'audio' | 'sticker' | 'fx';

export default function App() {
  const [cards, setCards] = useState<Array<Card>>([]);
  const [stickers, setStickers] = useState<Array<Sticker>>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('text');
  
  // Notepad State
  const [inputText, setInputText] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Audio State
  const [audioName, setAudioName] = useState("INSERT TAPE");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FX Generator State
  const [fxSrc, setFxSrc] = useState<string | null>(null);
  const [pixelSize, setPixelSize] = useState(8);
  const [fxColor, setFxColor] = useState('#ffffff'); // Tint
  const [fxAnimation, setFxAnimation] = useState('none');
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- Logic: Notepad & AI Chat ---
  const startPrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setShowModal(false);

    const userInput = inputText || "EMPTY_MSG.TXT";

    const newId = Date.now();
    // Random position within safe area
    const x = Math.random() * 40 + 5; 
    const y = Math.random() * 40 + 5;
    
    // 1. Initialize user card
    setCards(prev => [...prev, { id: newId, text: '█', x, y, title: '📝 USER_NOTE.TXT' }]);

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 2. Typing effect for user
    for (let i = 0; i <= userInput.length; i++) {
        const currentText = userInput.substring(0, i) + (i < userInput.length ? '█' : '');
        setCards(prev => prev.map(c => c.id === newId ? { ...c, text: currentText } : c));
        
        if (i < userInput.length) playClick(audioCtx);
        
        const delay = userInput[i-1] === '\n' ? 300 : 50 + Math.random() * 50;
        await new Promise(r => setTimeout(r, delay));
    }
    
    setInputText('');

    // 3. AI Reply Logic
    try {
        // Wait a beat before the system thinks
        await new Promise(r => setTimeout(r, 600));

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `你是一个运行在2000年的复古电脑操作系统助手（类似有点神经质的Clippy）。用户刚刚在桌面上贴了一个便签，内容是：“${userInput}”。请用中文给出一个简短、幽默、搞笑甚至稍微带点调侃的神回复（30字以内）。`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        const replyText = response.text || "SYSTEM_ERR: HUMOR_MODULE_OFFLINE";

        // Create System Reply Card (offset from user card)
        const replyId = Date.now() + 1;
        const replyX = Math.min(x + 5, 70);
        const replyY = Math.min(y + 15, 70);

        setCards(prev => [...prev, { id: replyId, text: '█', x: replyX, y: replyY, title: '🤖 SYSTEM_REPLY.EXE' }]);

        // 4. Typing effect for system
        for (let i = 0; i <= replyText.length; i++) {
            const currentText = replyText.substring(0, i) + (i < replyText.length ? '█' : '');
            setCards(prev => prev.map(c => c.id === replyId ? { ...c, text: currentText } : c));
            
            // System types faster
            if (i < replyText.length && i % 2 === 0) playClick(audioCtx);
            await new Promise(r => setTimeout(r, 30));
        }

    } catch (e) {
        console.error("AI Generation Error:", e);
    } finally {
        setIsPrinting(false);
    }
  };

  const removeCard = (id: number) => {
      setCards(prev => prev.filter(c => c.id !== id));
  };

  // --- Logic: Audio ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && audioRef.current) {
          audioRef.current.src = URL.createObjectURL(file);
          setAudioName(file.name.slice(0, 15).toUpperCase());
          setIsPlaying(false);
      }
  };

  const toggleAudio = () => {
      if (!audioRef.current?.src) {
        setAudioName("ERR: NO TAPE");
        setTimeout(() => setAudioName("INSERT TAPE"), 1500);
        return;
      }
      if (audioRef.current.paused) {
          audioRef.current.play();
          setIsPlaying(true);
      } else {
          audioRef.current.pause();
          setIsPlaying(false);
      }
  };

  // --- Logic: Stickers & Dragging ---
  const addSticker = (src: string, animation = 'none') => {
      const newSticker: Sticker = {
          id: Date.now(),
          src,
          x: Math.random() * 40 + 10,
          y: Math.random() * 40 + 10,
          animation
      };
      setStickers(prev => [...prev, newSticker]);
      setShowModal(false);
      setFxSrc(null); // Reset FX
  };

  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const src = URL.createObjectURL(file);
          if (modalMode === 'fx') {
              setFxSrc(src);
          } else {
              addSticker(src);
          }
      }
  };

  const removeSticker = (e: React.MouseEvent, id: number) => {
      if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setStickers(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleDragStart = (e: React.MouseEvent, id: number, type: 'card' | 'sticker') => {
    // Only drag if not clicking controls
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).classList.contains('win-btn')) return;

    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const rect = el.getBoundingClientRect();
    const startLeft = rect.left;
    const startTop = rect.top;

    const onMove = (ev: MouseEvent) => {
       const dx = ev.clientX - startX;
       const dy = ev.clientY - startY;
       el.style.left = `${startLeft + dx}px`;
       el.style.top = `${startTop + dy}px`;
    };
    
    const onUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        el.style.zIndex = type === 'card' ? "10" : "5";
        
        // Trash Detection
        const trash = document.getElementById('trash-bin');
        if (trash) {
            const trashRect = trash.getBoundingClientRect();
            // Simple AABB collision detection with the cursor
            if (
                ev.clientX >= trashRect.left && 
                ev.clientX <= trashRect.right && 
                ev.clientY >= trashRect.top && 
                ev.clientY <= trashRect.bottom
            ) {
                if (type === 'card') {
                    removeCard(id);
                } else {
                    setStickers(prev => prev.filter(s => s.id !== id));
                }
            }
        }
    };

    el.style.zIndex = "100";
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // --- Logic: FX Generator ---
  useEffect(() => {
      if (modalMode === 'fx' && fxSrc && fxCanvasRef.current) {
          const canvas = fxCanvasRef.current;
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = fxSrc;
          img.onload = () => {
              if (!ctx) return;
              
              // Set canvas size to match image aspect ratio, capped at 400px
              const maxDim = 300;
              const scale = Math.min(1, maxDim / img.width, maxDim / img.height);
              canvas.width = img.width * scale;
              canvas.height = img.height * scale;

              // 1. Turn off smoothing for pixelation effect
              ctx.imageSmoothingEnabled = false;

              // 2. Draw small (to lose detail)
              const w = canvas.width;
              const h = canvas.height;
              // Ensure pixelSize isn't 0
              const ps = Math.max(1, pixelSize); 
              
              const smallCanvas = document.createElement('canvas');
              smallCanvas.width = Math.ceil(w / ps);
              smallCanvas.height = Math.ceil(h / ps);
              const smallCtx = smallCanvas.getContext('2d');
              if(!smallCtx) return;
              smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);

              // 3. Draw big (upscale)
              ctx.clearRect(0,0, w, h);
              ctx.drawImage(smallCanvas, 0, 0, smallCanvas.width, smallCanvas.height, 0, 0, w, h);

              // 4. Apply Color Tint (if not white)
              if (fxColor !== '#ffffff') {
                  ctx.globalCompositeOperation = 'source-atop'; // Only draw on existing pixels
                  ctx.fillStyle = fxColor;
                  ctx.fillRect(0, 0, w, h);
                  ctx.globalCompositeOperation = 'source-over'; // Reset
                  
                  // Blend it a bit so we see structure? Or just flat tint?
                  // For "Y2K", multiply or overlay is cool.
                  // Let's re-draw the image with 'multiply' to keep shadows
                  ctx.globalCompositeOperation = 'multiply';
                  ctx.drawImage(smallCanvas, 0, 0, smallCanvas.width, smallCanvas.height, 0, 0, w, h);
                  ctx.globalCompositeOperation = 'source-over';
              }
          };
      }
  }, [fxSrc, pixelSize, fxColor, modalMode]);

  const saveFx = () => {
      if (fxCanvasRef.current) {
          const dataUrl = fxCanvasRef.current.toDataURL('image/png');
          addSticker(dataUrl, fxAnimation);
      }
  };

  const reelClass = `reel ${isPlaying ? 'spinning' : ''}`;

  return (
    <>
      {/* Desktop Top Bar */}
      <div className="desktop-bar">
          <div className="bar-left">
              <div className="start-btn">
                  <span>❖</span> START
              </div>
              <span style={{color: '#666'}}>A:\Desktop\My Notes</span>
          </div>
          <div className="bar-right">
              <div className="signal-icon">
                  <div className="sig-bar s1"></div><div className="sig-bar s2"></div><div className="sig-bar s3"></div><div className="sig-bar s4"></div>
              </div>
              <div className="battery-icon">
                  <div className="bat-fill"></div>
              </div>
              <Clock />
          </div>
      </div>

      {/* Decorations (Static) */}
      <div className="sticker" style={{bottom: '100px', right: '50px'}}>🐸</div>
      <div className="sticker" style={{top: '100px', right: '100px'}}>💿</div>
      <div className="sticker" style={{top: '200px', left: '80px', fontSize: '60px'}}>👾</div>

      <div id="canvas">
        {/* Stickers Layer */}
        {stickers.map(sticker => (
            <div
                key={sticker.id}
                className={`sticker-wrapper anim-${sticker.animation}`}
                style={{left: sticker.x + '%', top: sticker.y + '%'}}
                onMouseDown={(e) => handleDragStart(e, sticker.id, 'sticker')}
                onContextMenu={(e) => removeSticker(e, sticker.id)}
                title="Ctrl+Click to Remove"
            >
                <img src={sticker.src} className="sticker-img" alt="sticker" />
            </div>
        ))}

        {/* Notes Layer */}
        {cards.map(card => (
            <div 
                key={card.id} 
                className="card-wrapper win-frame"
                style={{left: `${card.x}%`, top: `${card.y}%`}}
                onMouseDown={(e) => handleDragStart(e, card.id, 'card')}
            >
                <div className="title-bar">
                    <div className="title-bar-text">
                        <span>{card.title?.includes('SYS') ? '🤖' : '📝'}</span> 
                        {card.title || `NOTE_${card.id.toString().slice(-4)}.TXT`}
                    </div>
                    <div className="win-btn" onClick={(e) => { e.stopPropagation(); removeCard(card.id); }}>X</div>
                </div>
                <div className="win-body">
                    <div className="card-content">{card.text}</div>
                </div>
            </div>
        ))}
      </div>

      {/* Recycle Bin */}
      <div id="trash-bin" className="trash-bin" title="Drag items here to delete">
        <div className="trash-icon">🗑️</div>
        <div className="trash-label">TRASH</div>
      </div>

      {/* Dock */}
      <div className="dock">
        <button className="y2k-btn" onClick={() => { setModalMode('text'); setShowModal(true); }}>
            📄 New Note
        </button>
        <button className="y2k-btn" onClick={() => { setModalMode('audio'); setShowModal(true); }}>
            🎵 Player
        </button>
        <button className="y2k-btn" onClick={() => { setModalMode('sticker'); setShowModal(true); }}>
            🖼️ Sticker
        </button>
        <button className="y2k-btn" onClick={() => { setModalMode('fx'); setShowModal(true); }}>
            ⚡ FX Gen
        </button>
      </div>

      {/* Modals */}
      {showModal && (
        <div id="modal" onClick={(e) => { if(e.target === e.currentTarget) setShowModal(false); }}>
            <div className={`win-frame modal-window ${modalMode === 'fx' ? 'large' : ''}`}>
                <div className="title-bar">
                    <div className="title-bar-text">
                        <span>
                            {modalMode === 'text' && '✍️ NOTEPAD.EXE'}
                            {modalMode === 'audio' && '🎧 WINAMP_LITE.EXE'}
                            {modalMode === 'sticker' && '🖼️ IMAGE_VIEWER.DLL'}
                            {modalMode === 'fx' && '⚡ PIXEL_STUDIO_V1.0'}
                        </span>
                    </div>
                    <div className="win-btn" onClick={() => setShowModal(false)}>X</div>
                </div>
                
                <div className="win-body">
                    {/* NOTEPAD MODE */}
                    {modalMode === 'text' && (
                        <div id="text-ui">
                            <div style={{fontSize: 12, marginBottom: 5}}>ENTER MESSAGE:</div>
                            <textarea 
                                value={inputText} 
                                onChange={e => setInputText(e.target.value)} 
                                placeholder="Type something..." 
                                autoFocus
                            />
                            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 10}}>
                                <button className="y2k-btn" onClick={startPrint} disabled={isPrinting}>
                                    {isPrinting ? 'PRINTING...' : 'OK'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PLAYER MODE */}
                    {modalMode === 'audio' && (
                        <div id="audio-ui">
                            <div className="walkman-case">
                                <div className="lcd-display">{audioName}</div>
                                <div className="tape-window">
                                    <div className={reelClass}></div>
                                    <div className={reelClass}></div>
                                </div>
                            </div>
                            <div style={{display: 'flex', gap: 10}}>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    accept="audio/*" 
                                    style={{display: 'none'}} 
                                    onChange={handleFileChange} 
                                />
                                <button className="y2k-btn" style={{flex: 1, fontSize: 12}} onClick={() => fileInputRef.current?.click()}>⏏ EJECT</button>
                                <button className="y2k-btn" style={{flex: 1, fontSize: 12}} onClick={toggleAudio}>
                                    {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STICKER UPLOAD MODE */}
                    {modalMode === 'sticker' && (
                        <div style={{textAlign: 'center', padding: 20}}>
                            <p style={{marginBottom: 20}}>UPLOAD PNG TO DESKTOP</p>
                            <input type="file" accept="image/png, image/jpeg" onChange={handleStickerUpload} style={{marginBottom: 20}} />
                            <p style={{fontSize: 10, color: '#666'}}>TIP: CTRL+CLICK OR DRAG TO TRASH TO REMOVE</p>
                        </div>
                    )}

                    {/* FX GENERATOR MODE */}
                    {modalMode === 'fx' && (
                        <div className="fx-container">
                            <div className="fx-controls">
                                <label>SOURCE IMAGE</label>
                                <input type="file" accept="image/*" onChange={handleStickerUpload} />
                                
                                <label>PIXELATION: {pixelSize}px</label>
                                <input 
                                    type="range" min="1" max="20" step="1" 
                                    value={pixelSize} 
                                    onChange={(e) => setPixelSize(Number(e.target.value))} 
                                />

                                <label>TINT COLOR</label>
                                <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
                                    <input 
                                        type="color" 
                                        value={fxColor} 
                                        onChange={(e) => setFxColor(e.target.value)}
                                        style={{height: 30, width: 30, padding: 0, border: '2px solid #000'}}
                                    />
                                    <span style={{fontSize: 10}}>{fxColor}</span>
                                </div>

                                <label>ANIMATION</label>
                                <select value={fxAnimation} onChange={(e) => setFxAnimation(e.target.value)}>
                                    <option value="none">NONE</option>
                                    <option value="float">FLOAT (Hover)</option>
                                    <option value="shake">SHAKE (Glitch)</option>
                                    <option value="spin">SPIN (Rotate)</option>
                                    <option value="pulse">PULSE (Flash)</option>
                                </select>

                                <button 
                                    className="y2k-btn" 
                                    style={{marginTop: 'auto', fontSize: 12}}
                                    onClick={saveFx}
                                    disabled={!fxSrc}
                                >
                                    💾 SAVE TO DESKTOP
                                </button>
                            </div>
                            <div className="fx-preview">
                                <canvas ref={fxCanvasRef} />
                                {!fxSrc && <div style={{color: '#666'}}>NO IMAGE LOADED</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </>
  );
}
