
import React, { useEffect, useState } from 'react';

type ConfettiPiece = {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
};

export const Confetti: React.FC = () => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  
  useEffect(() => {
    const colors = ['#8B5CF6', '#F97316', '#10B981', '#3B82F6', '#EC4899', '#EAB308'];
    const numPieces = 100;
    const newPieces: ConfettiPiece[] = [];
    
    for (let i = 0; i < numPieces; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 10,
        delay: Math.random() * 0.5,
      });
    }
    
    setPieces(newPieces);
    
    // Clean up confetti after animation
    const timer = setTimeout(() => {
      setPieces([]);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (pieces.length === 0) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute confetti"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}
    </div>
  );
};
