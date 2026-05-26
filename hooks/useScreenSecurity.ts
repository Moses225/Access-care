import { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";

/**
 * useScreenSecurity
 * Prevents screenshots and screen recording on screens that display
 * sensitive health or financial information (insurance, bookings, payments).
 *
 * Usage: call at the top of any sensitive screen component.
 *   useScreenSecurity();
 *
 * On iOS: blocks screenshots and screen recordings via UIKit.
 * On Android: sets FLAG_SECURE on the window (blocks screenshots + recordings).
 */
export function useScreenSecurity() {
  useEffect(() => {
    let prevented = false;

    ScreenCapture.preventScreenCaptureAsync()
      .then(() => { prevented = true; })
      .catch(() => { /* simulator or permission denied — non-fatal */ });

    return () => {
      if (prevented) {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
    };
  }, []);
}
