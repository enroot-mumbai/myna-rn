declare module 'InstallReferrer' {
  interface ReferrerDetails {
    installReferrer: string;
    referrerClickTimestampSeconds: number;
    installBeginTimestampSeconds: number;
  }

  export function getReferrer(): Promise<ReferrerDetails>;
} 