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

  return (
    <div className="flex flex-col items-center justify-center bg-slate-800 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-slate-700 shadow-inner shrink-0 transition-transform">
      <span className={`text-2xl sm:text-3xl font-black leading-none ${timeRemaining <= 10 ? 'text-blood-red animate-pulse' : 'text-white'}`}>
        {timeRemaining}
      </span>
      <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-tighter mt-0.5">Sn</span>
    </div>
  );
}

export default React.memo(TimerDisplay);