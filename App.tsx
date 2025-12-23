import React, { useState, useRef, useEffect } from 'react';

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

export default function App() {
  const [cards, setCards] = useState<Array<{id: number, text: string, x: number, y: number}>>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'text' | 'audio'>('text');
  const [inputText, setInputText] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Audio State
  const [audioName, setAudioName] = useState("INSERT TAPE");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startPrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setShowModal(false);

    const newId = Date.now();
    // Random position within safe area
    const x = Math.random() * 40 + 5; 
    const y = Math.random() * 40 + 5;
    
    // Initialize card
    setCards(prev => [...prev, { id: newId, text: '█', x, y }]);

    const textToType = inputText || "EMPTY_MSG.TXT";
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Typing effect loop
    for (let i = 0; i <= textToType.length; i++) {
        const currentText = textToType.substring(0, i) + (i < textToType.length ? '█' : '');
        setCards(prev => prev.map(c => c.id === newId ? { ...c, text: currentText } : c));
        
        if (i < textToType.length) playClick(audioCtx);
        
        const delay = textToType[i-1] === '\n' ? 300 : 50 + Math.random() * 50;
        await new Promise(r => setTimeout(r, delay));
    }
    
    setIsPrinting(false);
    setInputText('');
  };

  const removeCard = (id: number) => {
      setCards(prev => prev.filter(c => c.id !== id));
  };

  const handleDragStart = (e: React.MouseEvent, id: number) => {
    const el = e.currentTarget as HTMLElement; // The wrapper
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
    
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        el.style.zIndex = "10";
    };

    el.style.zIndex = "100";
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  
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

      {/* Decorations */}
      <div className="sticker" style={{bottom: '100px', right: '50px'}}>🐸</div>
      <div className="sticker" style={{top: '100px', right: '100px'}}>💿</div>
      <div className="sticker" style={{top: '200px', left: '80px', fontSize: '60px'}}>👾</div>

      <div id="canvas">
        {cards.map(card => (
            <div 
                key={card.id} 
                className="card-wrapper win-frame"
                style={{left: `${card.x}%`, top: `${card.y}%`}}
                onMouseDown={(e) => handleDragStart(e, card.id)}
            >
                <div className="title-bar">
                    <div className="title-bar-text">
                        <span>📝</span> NOTE_{card.id.toString().slice(-4)}.TXT
                    </div>
                    <div className="win-btn" onClick={(e) => { e.stopPropagation(); removeCard(card.id); }}>X</div>
                </div>
                <div className="win-body">
                    <div className="card-content">{card.text}</div>
                </div>
            </div>
        ))}
      </div>

      <div className="dock">
        <button className="y2k-btn" onClick={() => { setModalMode('text'); setShowModal(true); }}>
            📄 New Note
        </button>
        <button className="y2k-btn" onClick={() => { setModalMode('audio'); setShowModal(true); }}>
            🎵 Player
        </button>
      </div>

      {showModal && (
        <div id="modal" onClick={(e) => { if(e.target === e.currentTarget) setShowModal(false); }}>
            <div className="win-frame modal-window">
                <div className="title-bar">
                    <div className="title-bar-text">
                        <span>{modalMode === 'text' ? '✍️ NOTEPAD.EXE' : '🎧 WINAMP_LITE.EXE'}</span>
                    </div>
                    <div className="win-btn" onClick={() => setShowModal(false)}>X</div>
                </div>
                
                <div className="win-body">
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
                </div>
            </div>
        </div>
      )}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </>
  );
}
