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

  const navigateToDeckLibrary = useCallback(() => {
    navigate('/decks');
  }, [navigate]);

  const navigateToDeckView = useCallback((deckId: AutomergeUrl) => {
    navigate(`/deck/${deckId}`);
  }, [navigate]);

  const navigateToCardEdit = useCallback((cardId: AutomergeUrl) => {
    navigate(`/card/${cardId}/edit`);
  }, [navigate]);

  const navigateToDebug = useCallback(() => {
    navigate('/debug');
  }, [navigate]);

  return {
    navigateToGame,
    navigateToHome,
    navigateToSettings,
    navigateToCardLibrary,
    navigateToCardView,
    navigateToDeckLibrary,
    navigateToDeckView,
    navigateToCardEdit,
    navigateToDebug,
  };
};

// URL helper functions that include the full path context
export const makeGameUrl = (gameUrl: AutomergeUrl) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/game/${gameUrl}`;
};

export const makeCardViewUrl = (cardId: AutomergeUrl) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/card/${cardId}`;
};

export const makeCardEditUrl = (cardId: AutomergeUrl) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/card/${cardId}/edit`;
};

export const makeDeckViewUrl = (deckId: AutomergeUrl) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/deck/${deckId}`;
};

export const makeHomeUrl = () => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/`;
};

export const makeSettingsUrl = () => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/settings`;
};

export const makeCardLibraryUrl = () => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/library`;
};

export const makeDeckLibraryUrl = () => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/decks`;
};

export const makeDebugUrl = () => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/debug`;
};
