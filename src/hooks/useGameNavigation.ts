import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomergeUrl } from '@automerge/react';

export const useGameNavigation = () => {
  const navigate = useNavigate();

  const navigateToGame = useCallback((gameUrl: AutomergeUrl) => {
    navigate(`/game/${gameUrl}`);
  }, [navigate]);

  const navigateToHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const navigateToSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const navigateToCardLibrary = useCallback(() => {
    navigate('/library');
  }, [navigate]);

  const navigateToCardView = useCallback((cardId: AutomergeUrl) => {
    navigate(`/card/${cardId}`);
  }, [navigate]);

  return {
    navigateToGame,
    navigateToHome,
    navigateToSettings,
    navigateToCardLibrary,
    navigateToCardView,
  };
};

export const makeCardViewUrl = (cardId: AutomergeUrl) => {
  return `${window.location.origin}/#/card/${cardId}`;
};