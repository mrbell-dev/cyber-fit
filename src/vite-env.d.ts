/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL of the shared push relay (empty = relay not configured) */
  readonly VITE_RELAY_URL?: string;
  /** VAPID public key matching the shared relay */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
