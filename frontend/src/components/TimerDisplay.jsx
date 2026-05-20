import React, { useState, useEffect } from 'react';

function TimerDisplay({ socket, initialTime }) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime || 0);

  useEffect(() => {
    const handleTimerUpdate = (t) => {
       setTimeRemaining(t);
    };
    
    socket.on('timerUpdate', handleTimerUpdate);
    socket.on('phaseChanged', ({ timeRemaining: t }) => {
       setTimeRemaining(t);
    });

    return () => {
      socket.off('timerUpdate', handleTimerUpdate);
      // Let App.jsx handle phaseChanged for other state, but TimerDisplay updates its own time.
    };
  }, [socket]);

  const isCritical = timeRemaining <= 10;
  return (
    <div
      className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border shadow-inner shrink-0 transform-gpu ${
        isCritical
          ? 'bg-red-950/40 border-red-800/60 animate-pulse'
          : 'bg-slate-800 border-slate-700'
      }`}
      style={{ backfaceVisibility: 'hidden' }}
    >
      <span
        className={`text-2xl sm:text-3xl font-black leading-none tabular-nums tracking-tight ${isCritical ? 'text-blood-red' : 'text-white'}`}
        style={{ transform: 'translateZ(0)' }}
      >
        {timeRemaining}
      </span>
      <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-tighter mt-0.5">Sn</span>
    </div>
  );
}

export default React.memo(TimerDisplay);