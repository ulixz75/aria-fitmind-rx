export interface RealtimeClientSession {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  microphoneStream: MediaStream;
  audioElement: HTMLAudioElement;
}

export interface RealtimeEvent {
  type?: string;
  [key: string]: unknown;
}

export interface ConnectRealtimeOptions {
  clientSecret: string;
  onEvent?: (event: RealtimeEvent) => void;
  onConnectionStateChange?: (
    state: RTCPeerConnectionState,
  ) => void;
}

export async function connectRealtime(
  options: ConnectRealtimeOptions,
): Promise<RealtimeClientSession> {
  const {
    clientSecret,
    onEvent,
    onConnectionStateChange,
  } = options;

  if (!clientSecret) {
    throw new Error(
      "Missing Realtime client secret.",
    );
  }

  if (
    typeof window === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error(
      "Microphone access is not available in this browser or context.",
    );
  }

  /*
   * ----------------------------------------------------------
   * 1. Create WebRTC peer connection
   * ----------------------------------------------------------
   */

  const peerConnection =
    new RTCPeerConnection();

  peerConnection.onconnectionstatechange =
    () => {
      onConnectionStateChange?.(
        peerConnection.connectionState,
      );
    };

  /*
   * ----------------------------------------------------------
   * 2. Remote audio from ARIA
   * ----------------------------------------------------------
   */

  const audioElement =
    document.createElement("audio");

  audioElement.autoplay = true;
  audioElement.setAttribute(
    "playsinline",
    "true",
  );

  audioElement.style.display = "none";

  document.body.appendChild(
    audioElement,
  );

  peerConnection.ontrack = (event) => {
    const [remoteStream] =
      event.streams;

    if (remoteStream) {
      audioElement.srcObject =
        remoteStream;

      void audioElement
        .play()
        .catch((error) => {
          console.warn(
            "Remote audio autoplay was blocked:",
            error,
          );
        });
    }
  };

  /*
   * ----------------------------------------------------------
   * 3. Microphone permission
   * ----------------------------------------------------------
   */

  const microphoneStream =
    await navigator.mediaDevices.getUserMedia(
      {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
    );

  const microphoneTrack =
    microphoneStream.getAudioTracks()[0];

  if (!microphoneTrack) {
    microphoneStream
      .getTracks()
      .forEach((track) =>
        track.stop(),
      );

    throw new Error(
      "No microphone audio track was created.",
    );
  }

  peerConnection.addTrack(
    microphoneTrack,
    microphoneStream,
  );

  /*
   * ----------------------------------------------------------
   * 4. Realtime data channel
   * ----------------------------------------------------------
   *
   * This is where we will later send/receive:
   *
   * - function calls
   * - session events
   * - transcripts
   * - control events
   */

  const dataChannel =
    peerConnection.createDataChannel(
      "oai-events",
    );

  dataChannel.addEventListener(
    "open",
    () => {
      console.info(
        "ARIA Realtime data channel opened.",
      );
    },
  );

  dataChannel.addEventListener(
    "close",
    () => {
      console.info(
        "ARIA Realtime data channel closed.",
      );
    },
  );

  dataChannel.addEventListener(
    "error",
    (event) => {
      console.error(
        "ARIA Realtime data channel error:",
        event,
      );
    },
  );

  dataChannel.addEventListener(
    "message",
    (event) => {
      try {
        const parsed =
          JSON.parse(event.data);

        onEvent?.(parsed);
      } catch (error) {
        console.warn(
          "Unable to parse ARIA Realtime event:",
          error,
          event.data,
        );
      }
    },
  );

  /*
   * ----------------------------------------------------------
   * 5. Create SDP offer
   * ----------------------------------------------------------
   */

  const offer =
    await peerConnection.createOffer({
      offerToReceiveAudio: true,
    });

  await peerConnection.setLocalDescription(
    offer,
  );

  const localDescription =
    peerConnection.localDescription;

  if (
    !localDescription?.sdp
  ) {
    throw new Error(
      "Unable to generate local WebRTC SDP offer.",
    );
  }

  /*
   * ----------------------------------------------------------
   * 6. Send SDP offer to OpenAI Realtime
   * ----------------------------------------------------------
   */

  const sdpResponse =
    await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${clientSecret}`,

          "Content-Type":
            "application/sdp",
        },

        body:
          localDescription.sdp,
      },
    );

  if (!sdpResponse.ok) {
    const errorText =
      await sdpResponse.text();

    microphoneStream
      .getTracks()
      .forEach((track) =>
        track.stop(),
      );

    audioElement.remove();

    peerConnection.close();

    throw new Error(
      `OpenAI Realtime WebRTC connection failed (${sdpResponse.status}): ${errorText}`,
    );
  }

  /*
   * OpenAI returns the SDP answer as text.
   */

  const answerSdp =
    await sdpResponse.text();

  if (!answerSdp) {
    microphoneStream
      .getTracks()
      .forEach((track) =>
        track.stop(),
      );

    audioElement.remove();

    peerConnection.close();

    throw new Error(
      "OpenAI returned an empty WebRTC SDP answer.",
    );
  }

  await peerConnection.setRemoteDescription(
    {
      type: "answer",
      sdp: answerSdp,
    },
  );

  return {
    peerConnection,
    dataChannel,
    microphoneStream,
    audioElement,
  };
}

/* ============================================================
   SEND REALTIME EVENT
   ============================================================ */

export function sendRealtimeEvent(
  dataChannel: RTCDataChannel,
  event: RealtimeEvent,
): void {
  if (
    dataChannel.readyState !==
    "open"
  ) {
    throw new Error(
      "ARIA Realtime data channel is not open.",
    );
  }

  dataChannel.send(
    JSON.stringify(event),
  );
}

/* ============================================================
   DISCONNECT REALTIME SESSION
   ============================================================ */

export function disconnectRealtime(
  session:
    | RealtimeClientSession
    | null
    | undefined,
): void {
  if (!session) {
    return;
  }

  try {
    session.dataChannel.close();
  } catch {
    // Ignore already-closed channel.
  }

  session.microphoneStream
    .getTracks()
    .forEach((track) =>
      track.stop(),
    );

  session.peerConnection.close();

  session.audioElement.pause();
  session.audioElement.srcObject =
    null;

  session.audioElement.remove();
}