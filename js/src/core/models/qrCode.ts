export interface QRCode {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
  used: boolean;
}

export interface CodeTimer {
  minutes: number;
  seconds: number;
  expired: boolean;
}
