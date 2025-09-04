import { getAssetPath } from './assetUtils';
import { AUDIO_CONFIG, getSoundPath, SoundName } from './audioConfig';

/**
 * Audio utility functions for playing game sounds with best practices
 */

// Cache for preloaded audio elements to avoid loading delays
const audioCache = new Map<string, HTMLAudioElement>();

// Global audio settings
const DEFAULT_VOLUME = 0.7;
const DEFAULT_PLAYBACK_RATE = 1.0;

/**
 * Preload an audio file and cache it for instant playback
 * @param soundName - The semantic name of the sound to preload
 * @returns Promise that resolves when the audio is loaded
 */
export async function preloadSound(soundName: SoundName): Promise<void> {
  const assetPath = getSoundPath(soundName);
  const fullPath = getAssetPath(assetPath);

  // Return early if already cached
  if (audioCache.has(fullPath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio(fullPath);
    audio.preload = 'auto';
    audio.volume = DEFAULT_VOLUME;

    audio.addEventListener('canplaythrough', () => {
      audioCache.set(fullPath, audio);
      resolve();
    }, { once: true });

    audio.addEventListener('error', (error) => {
      console.error(`Failed to preload sound ${soundName}:`, error);
      reject(error);
    }, { once: true });

    // Start loading
    audio.load();
  });
}

/**
 * Preload all game sounds for instant playback
 * @returns Promise that resolves when all sounds are loaded
 */
export async function preloadAllSounds(): Promise<void> {
  const soundNames = Object.keys(AUDIO_CONFIG) as SoundName[];

  try {
    await Promise.all(soundNames.map(preloadSound));
    console.log('All game sounds preloaded successfully');
  } catch (error) {
    console.error('Failed to preload some sounds:', error);
    // Don't throw - game should continue even if sounds fail to load
  }
}

/**
 * Play a sound by its semantic name
 * @param soundName - The semantic name of the sound to play
 * @param options - Optional playback options
 */
export function playSound(
  soundName: SoundName,
  options: {
    volume?: number;
    playbackRate?: number;
    loop?: boolean;
  } = {}
): void {
  const assetPath = getSoundPath(soundName);
  const fullPath = getAssetPath(assetPath);

  // Try to get from cache first
  let audio = audioCache.get(fullPath);

  if (!audio) {
    // Create new audio element if not cached
    audio = new Audio(fullPath);
    audio.volume = options.volume ?? DEFAULT_VOLUME;
    audioCache.set(fullPath, audio);
  }

  // Apply options
  audio.volume = options.volume ?? DEFAULT_VOLUME;
  audio.playbackRate = options.playbackRate ?? DEFAULT_PLAYBACK_RATE;
  audio.loop = options.loop ?? false;

  // Reset to beginning and play
  audio.currentTime = 0;

  audio.play().catch((error) => {
    console.error(`Failed to play sound ${soundName}:`, error);
    // Don't throw - game should continue even if sounds fail to play
  });
}

/**
 * Stop all currently playing sounds
 */
export function stopAllSounds(): void {
  audioCache.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

/**
 * Set the global volume for all sounds
 * @param volume - Volume level between 0 and 1
 */
export function setGlobalVolume(volume: number): void {
  const clampedVolume = Math.max(0, Math.min(1, volume));
  audioCache.forEach((audio) => {
    audio.volume = clampedVolume;
  });
}

/**
 * Check if a sound is currently playing
 * @param soundName - The semantic name of the sound to check
 * @returns True if the sound is currently playing
 */
export function isSoundPlaying(soundName: SoundName): boolean {
  const assetPath = getSoundPath(soundName);
  const fullPath = getAssetPath(assetPath);
  const audio = audioCache.get(fullPath);

  return audio ? !audio.paused && audio.currentTime > 0 : false;
}
