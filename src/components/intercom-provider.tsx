"use client";

import { useEffect } from "react";
import Intercom from "@intercom/messenger-js-sdk";
import { INTERCOM_APP_ID } from "@/lib/intercom";

export function IntercomProvider() {
  useEffect(() => {
    if (!INTERCOM_APP_ID) return;
    Intercom({ app_id: INTERCOM_APP_ID });
  }, []);

  return null;
}
