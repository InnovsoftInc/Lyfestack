/**
 * Wrapper around react-native-webrtc for the OpenAI Realtime session.
 * Uses a dynamic import so the module is only resolved when the dev-client
 * (with native bindings) is running. Inside Expo Go this throws a clear
 * error rather than a cryptic native crash.
 */

import { realtimeApi, type RealtimeSession } from './openai.api';

export interface RealtimeConnection {
  pc: any;
  dc: any;
  session: RealtimeSession;
  close: () => void;
}

export interface RealtimeCallbacks {
  onTranscript?: (text: string) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export async function startRealtime(opts: { instructions?: string; voice?: string } & RealtimeCallbacks = {}): Promise<RealtimeConnection> {
  let webrtc: typeof import('react-native-webrtc');
  try {
    webrtc = await import('react-native-webrtc');
  } catch (err) {
    throw new Error(
      'react-native-webrtc is not loaded. You need a custom dev-client build (run `npx expo prebuild` then rebuild the app) — Expo Go cannot load this native module.',
    );
  }

  const { mediaDevices, RTCPeerConnection } = webrtc;
  const sessionOpts: { instructions?: string; voice?: string } = {};
  if (opts.instructions) sessionOpts.instructions = opts.instructions;
  if (opts.voice) sessionOpts.voice = opts.voice;
  const session = await realtimeApi.mintSession(sessionOpts);

  const pc = new RTCPeerConnection({});
  const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
  for (const track of stream.getTracks()) pc.addTrack(track, stream);

  const dc = pc.createDataChannel('oai-events') as unknown as { onmessage: ((ev: { data: string }) => void) | null; close: () => void };
  dc.onmessage = (event: { data: string }) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type?.endsWith('.delta') && typeof parsed.delta === 'string') {
        opts.onTranscript?.(parsed.delta);
      } else if (parsed.type?.endsWith('.completed') && typeof parsed.transcript === 'string') {
        opts.onTranscript?.(parsed.transcript);
      }
    } catch { /* skip */ }
  };

  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
    method: 'POST',
    body: offer.sdp ?? '',
    headers: {
      Authorization: `Bearer ${session.clientSecret}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Beta': 'realtime=v1',
    },
  });
  if (!sdpRes.ok) {
    pc.close();
    throw new Error(`Realtime SDP exchange failed: ${sdpRes.status}`);
  }
  const answer = { type: 'answer' as const, sdp: await sdpRes.text() };
  await pc.setRemoteDescription(answer);

  const close = () => {
    try { dc.close(); } catch { /* ignore */ }
    try { pc.close(); } catch { /* ignore */ }
    try { stream.getTracks().forEach((t: { stop: () => void }) => t.stop()); } catch { /* ignore */ }
    opts.onClose?.();
  };

  (pc as unknown as { onconnectionstatechange: (() => void) | null }).onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes((pc as unknown as { connectionState: string }).connectionState)) {
      opts.onClose?.();
    }
  };

  return { pc, dc, session, close };
}
