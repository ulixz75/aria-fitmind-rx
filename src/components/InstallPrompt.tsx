import {
  Download,
  Monitor,
  Globe2,
  Share2,
  Smartphone,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent
  extends Event {
  readonly platforms: string[];

  readonly userChoice: Promise<{
    outcome:
      | "accepted"
      | "dismissed";
    platform: string;
  }>;

  prompt(): Promise<void>;
}

const DISMISS_KEY =
  "aria-install-prompt-dismissed-at";

const DISMISS_DURATION_MS =
  14 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  const standaloneMedia =
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

  const iosStandalone =
    "standalone" in
      window.navigator &&
    Boolean(
      (
        window.navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone,
    );

  return (
    standaloneMedia ||
    iosStandalone
  );
}

function isIOS() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  return /iphone|ipad|ipod/i.test(
    window.navigator.userAgent,
  );
}

function wasRecentlyDismissed() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  try {
    const stored =
      window.localStorage.getItem(
        DISMISS_KEY,
      );

    if (!stored) {
      return false;
    }

    const timestamp =
      Number(stored);

    if (
      !Number.isFinite(
        timestamp,
      )
    ) {
      return false;
    }

    return (
      Date.now() -
        timestamp <
      DISMISS_DURATION_MS
    );
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now()),
    );
  } catch {
    // Ignore storage restrictions.
  }
}

function detectBrowserType() {
  if (isIOS()) {
    return "ios" as const;
  }

  if (
    typeof navigator !==
    "undefined"
  ) {
    const userAgent =
      navigator.userAgent.toLowerCase();

    if (
      userAgent.includes(
        "android",
      )
    ) {
      return "android" as const;
    }
  }

  return "desktop" as const;
}

export function InstallPrompt({
  children,
}: {
  children: ReactNode;
}) {
  const [
    deferredPrompt,
    setDeferredPrompt,
  ] =
    useState<BeforeInstallPromptEvent | null>(
      null,
    );

  const [
    visible,
    setVisible,
  ] = useState(false);

  const [
    installing,
    setInstalling,
  ] = useState(false);

  const [
    ios,
    setIos,
  ] = useState(false);

  const [
    browserType,
    setBrowserType,
  ] = useState<
    "ios" | "android" | "desktop"
  >("desktop");

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }

    if (
      wasRecentlyDismissed()
    ) {
      return;
    }

    const detectedIOS =
      isIOS();

    setIos(detectedIOS);
    setBrowserType(
      detectBrowserType(),
    );

    /*
     * Give the application a moment to
     * render before showing the modal.
     */
    const timer =
      window.setTimeout(
        () => {
          setVisible(true);
        },
        450,
      );

    function handleBeforeInstallPrompt(
      event: Event,
    ) {
      event.preventDefault();

      setDeferredPrompt(
        event as BeforeInstallPromptEvent,
      );
    }

    function handleAppInstalled() {
      setVisible(false);
      setInstalling(false);
      setDeferredPrompt(
        null,
      );

      try {
        window.localStorage.removeItem(
          DISMISS_KEY,
        );
      } catch {
        // Ignore storage restrictions.
      }
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
    );

    return () => {
      window.clearTimeout(
        timer,
      );

      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled,
      );
    };
  }, []);

  async function installApp() {
    if (ios) {
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    setInstalling(true);

    try {
      await deferredPrompt.prompt();

      await deferredPrompt.userChoice;

      setDeferredPrompt(
        null,
      );
      setVisible(false);
      setInstalling(false);
    } catch (error) {
      console.error(
        "PWA installation prompt failed:",
        error,
      );

      setInstalling(false);
    }
  }

  function closePrompt() {
    rememberDismissal();

    setVisible(false);
  }

  if (!visible) {
    return <>{children}</>;
  }

  const canUseNativeInstall =
    Boolean(
      deferredPrompt,
    );

  return (
    <>
      {children}

      <div
        className="install-prompt-backdrop"
        role="presentation"
        onClick={closePrompt}
      >
        <section
          className="install-prompt"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-prompt-title"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            className="install-prompt-close"
            aria-label="Close installation prompt"
            onClick={closePrompt}
          >
            <X size={18} />
          </button>

          <div className="install-prompt-brand">
            <img
              src="/icons/icon-512.png"
              alt="ARIA FitMind Rx"
            />
          </div>

          <span className="eyebrow">
            FitMind Rx
          </span>

          <h2 id="install-prompt-title">
            Take ARIA with you.
          </h2>

          <p className="muted">
            Your voice coach
            anywhere. Install ARIA
            for a faster, focused
            workout experience.
          </p>

        <div className="install-platforms">
  <div className="install-platform">
    <Smartphone
      size={17}
    />

    <span>
      Android
    </span>
  </div>

  <div className="install-platform">
    {ios ? (
      <Share2
        size={17}
      />
    ) : (
      <Monitor
        size={17}
      />
    )}

    <span>
      {ios
        ? "iPhone / iPad"
        : "Desktop"}
    </span>
  </div>

  <div className="install-platform">
    <Globe2
      size={17}
    />

    <span>
      Web app
    </span>
  </div>
</div>

          {ios ? (
            <div className="install-ios-guide">
              <strong>
                Add ARIA to your
                Home Screen
              </strong>

              <div className="install-ios-step">
                <span>
                  1
                </span>

                <p>
                  Tap the{" "}
                  <Share2
                    size={14}
                  />{" "}
                  Share button in
                  Safari.
                </p>
              </div>

              <div className="install-ios-step">
                <span>
                  2
                </span>

                <p>
                  Choose{" "}
                  <strong>
                    Add to Home
                    Screen
                  </strong>
                  .
                </p>
              </div>

              <div className="install-ios-step">
                <span>
                  3
                </span>

                <p>
                  Tap{" "}
                  <strong>
                    Add
                  </strong>
                  .
                </p>
              </div>
            </div>
          ) : canUseNativeInstall ? (
            <button
              type="button"
              className="primary-button install-prompt-button"
              onClick={() =>
                void installApp()
              }
              disabled={
                installing
              }
            >
              <Download
                size={18}
              />

              {installing
                ? "Installing…"
                : "Install ARIA"}
            </button>
          ) : (
            <div className="install-browser-guide">
              <Monitor
                size={18}
              />

              <span>
                Your browser can
                install ARIA from
                its address bar or
                browser menu.
              </span>
            </div>
          )}

          {ios && (
            <button
              type="button"
              className="secondary-button install-prompt-button"
              onClick={
                closePrompt
              }
            >
              Continue in browser
            </button>
          )}

          {!ios && (
            <button
              type="button"
              className="install-browser-link"
              onClick={
                closePrompt
              }
            >
              Continue in browser
            </button>
          )}

          <small className="install-prompt-note">
            ARIA works on phones,
            tablets and computers.
            You can always use it
            directly in your browser.
          </small>
        </section>
      </div>
    </>
  );
}