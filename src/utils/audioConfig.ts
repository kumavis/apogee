/**
 * Audio configuration mapping semantic sound names to asset paths
 * This centralizes all audio file references for easy maintenance
 */

export type SoundName =
  | 'click'
  | 'playCard'
  | 'playerDied'
  | 'turnOver'
  | 'turnStart';

export type AudioConfig = {
  readonly [K in SoundName]: string;
};

/**
 * Audio configuration mapping semantic names to asset paths
 * All paths are relative to the public directory
 */
export const AUDIO_CONFIG: AudioConfig = {
  click: 'assets/audio/Click.mp3',
  playCard: 'assets/audio/PlayCard.mp3',
  playerDied: 'assets/audio/PlayerDied.mp3',
  turnOver: 'assets/audio/TurnOverSwoosh.mp3',
  turnStart: 'assets/audio/Lighting_an_8bit_torch_Flutter.mp3',
} as const;

/**
 * Get the asset path for a sound by its semantic name
 * @param soundName - The semantic name of the sound
 * @returns The asset path for the sound
 */
export function getSoundPath(soundName: SoundName): string {
  return (AUDIO_CONFIG as Record<SoundName, string>)[soundName];
}
