import { useState, useCallback, useEffect } from 'react';
import { AutomergeUrl, DocHandle, DocHandleEphemeralMessagePayload } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { playSound } from '../utils/audioUtils';

type BoardClickMessage = {
  type: 'board-click';
  playerId: AutomergeUrl;
  x: number;
  y: number;
};

type EmojiAnimation = {
  id: string;
  x: number;
  y: number;
  emoji: string;
  timestamp: number;
};

/**
 * Custom hook for handling game board clicks and emoji animations
 * @param gameDocHandle - The Automerge document handle for broadcasting
 * @param selfId - The current player's ID
 * @param isCurrentPlayer - Whether the current user is the active player
 * @param duration - Animation duration in milliseconds (default: 2000)
 * @returns [handleBoardClick, emojiAnimations] - Click handler and current animations
 */
export const useGameBoardClicks = (
  gameDocHandle: DocHandle<GameDoc>,
  selfId: AutomergeUrl,
  duration: number = 2000
) => {
  // State for emoji animations
  const [emojiAnimations, setEmojiAnimations] = useState<EmojiAnimation[]>([]);

  // Set up ephemeral message listener for click broadcasts
  useEffect(() => {
    const handleEphemeralMessage = (event: DocHandleEphemeralMessagePayload<GameDoc>) => {
      const message = event.message as BoardClickMessage;
      if (message.type === 'board-click' && message.playerId !== selfId) {
        // Add emoji animation for other player's click
        const newAnimation: EmojiAnimation = {
          id: `${message.playerId}-${Date.now()}`,
          x: message.x,
          y: message.y,
          emoji: '👆',
          timestamp: Date.now()
        };
        
        setEmojiAnimations(prev => [...prev, newAnimation]);
        
        // Remove animation after specified duration
        setTimeout(() => {
          setEmojiAnimations(prev => prev.filter(anim => anim.id !== newAnimation.id));
        }, duration);
      }
    };

    gameDocHandle.on("ephemeral-message", handleEphemeralMessage);
    
    return () => {
      gameDocHandle.off("ephemeral-message", handleEphemeralMessage);
    };
  }, [gameDocHandle, selfId, duration]);

  // Handle board clicks for broadcasting
  const handleBoardClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Don't broadcast if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]') || target.closest('.card') || target.closest('[data-interactive]')) {
      return;
    }
    
    // Play click sound immediately when board is clicked
    playSound('click');
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Broadcast the click
    gameDocHandle.broadcast({
      type: 'board-click',
      playerId: selfId,
      x,
      y,
      timestamp: Date.now()
    } as BoardClickMessage);
    
    // Show local animation for the clicking player
    const newAnimation: EmojiAnimation = {
      id: `self-${Date.now()}`,
      x,
      y,
      emoji: '👆',
      timestamp: Date.now()
    };
    
    setEmojiAnimations(prev => [...prev, newAnimation]);
    
    // Remove animation after specified duration
    setTimeout(() => {
      setEmojiAnimations(prev => prev.filter(anim => anim.id !== newAnimation.id));
    }, duration);
  }, [gameDocHandle, selfId, duration]);

  return [handleBoardClick, emojiAnimations] as const;
};
