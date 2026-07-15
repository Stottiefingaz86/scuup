import { show, showSpace } from "@intercom/messenger-js-sdk";

export const INTERCOM_APP_ID =
  process.env.NEXT_PUBLIC_INTERCOM_APP_ID ?? "ejfy2b6b";

export function openIntercomHelpCentre() {
  showSpace("help");
}

export function openIntercomLiveChat() {
  show();
}
