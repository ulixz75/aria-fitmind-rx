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

export interface RealtimeFunctionCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ConnectRealtimeOptions {
  clientSecret: string;

  onEvent?: (
    event: RealtimeEvent,
  ) => void;

  onFunctionCall?: (
    functionCall: RealtimeFunctionCall,
  ) => void;

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
    onFunctionCall,
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

  audioElement.style.display =
    "none";

  document.body.appendChild(
    audioElement,
  );

  peerConnection.ontrack = (
    event,
  ) => {
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

  /*
   * ----------------------------------------------------------
   * 5. Receive Realtime events
   * ----------------------------------------------------------
   */

  dataChannel.addEventListener(
    "message",
    (event) => {
      try {
        const parsed =
          JSON.parse(
            event.data,
          ) as RealtimeEvent;

        /*
         * Always expose the raw
         * event to the caller.
         */
        onEvent?.(parsed);

        /*
         * ----------------------------------------------------
         * Function calling
         * ----------------------------------------------------
         *
         * OpenAI Realtime may emit:
         *
         * response.function_call_arguments.done
         *
         * containing:
         *
         * - call_id
         * - name
         * - arguments
         *
         * We convert that into a
         * simpler application-level object.
         */

        if (
          parsed.type ===
          "response.function_call_arguments.done"
        ) {
          const callId =
            typeof parsed.call_id === "string"
              ? parsed.call_id
              : "";

          const name =
            typeof parsed.name === "string"
              ? parsed.name
              : "";

          let args: Record<string, unknown> = {};

          if (
            typeof parsed.arguments === "string" &&
            parsed.arguments.trim().length > 0
          ) {
            try {
              const parsedArguments = JSON.parse(parsed.arguments);

              if (
                parsedArguments &&
                typeof parsedArguments === "object" &&
                !Array.isArray(parsedArguments)
              ) {
                args = parsedArguments as Record<string, unknown>;
              }
            } catch (error) {
              console.warn(
                "ARIA function arguments could not be parsed:",
                parsed.arguments,
                error,
              );
            }
          }

          console.info("ARIA function call event:", {
            callId,
            name,
            arguments: args,
          });

          if (callId && name) {
            onFunctionCall?.({
              callId,
              name,
              arguments: args,
            });
          }
        }
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
   * 6. Create SDP offer
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
   * 7. Send SDP offer to OpenAI Realtime
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
   * OpenAI returns the SDP answer
   * as text.
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
   SEND FUNCTION CALL RESULT
   ============================================================ */

export function sendRealtimeFunctionResult(
  dataChannel: RTCDataChannel,
  callId: string,
  output: unknown,
): void {
  if (dataChannel.readyState !== "open") {
    console.warn(
      "ARIA function result could not be sent because the data channel is not open.",
    );
    return;
  }

  dataChannel.send(
    JSON.stringify({
      type: "conversation.item.create",

      item: {
        type: "function_call_output",

        call_id: callId,

        output:
          typeof output === "string"
            ? output
            : JSON.stringify(output),
      },
    }),
  );

  dataChannel.send(
    JSON.stringify({
      type: "response.create",
    }),
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