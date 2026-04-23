import { TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { fetchTtsDataUri } from '../services/openai.api';

interface Props {
  text: string;
  voice?: string;
  label?: string;
  style?: object;
  textStyle?: object;
}

/**
 * Plays the supplied text via OpenAI TTS. The audio buffer is fetched once on
 * first tap, cached for the lifetime of the component, and replayed on
 * subsequent taps. Tap while playing to stop.
 */
export function TtsPlayer({ text, voice, label = '🔊 Listen', style, textStyle }: Props) {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => () => {
    try { playerRef.current?.remove(); } catch { /* ignore */ }
    playerRef.current = null;
  }, []);

  const onPress = async () => {
    if (playing && playerRef.current) {
      try { playerRef.current.pause(); } catch { /* ignore */ }
      setPlaying(false);
      return;
    }
    setBusy(true);
    try {
      if (!playerRef.current) {
        const uri = await fetchTtsDataUri(text, voice);
        playerRef.current = createAudioPlayer({ uri });
        playerRef.current.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) setPlaying(false);
        });
      }
      playerRef.current.seekTo(0);
      playerRef.current.play();
      setPlaying(true);
    } catch (err: any) {
      Alert.alert('TTS failed', err?.message ?? 'Could not play audio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} hitSlop={6} activeOpacity={0.7} style={style} disabled={busy}>
      {busy ? <ActivityIndicator size="small" /> : (
        <Text style={textStyle}>{playing ? '⏸ Stop' : label}</Text>
      )}
    </TouchableOpacity>
  );
}
