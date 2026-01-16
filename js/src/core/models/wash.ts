export interface WashLocation {
  id: string;
  name: string;
  address: string;
}

export interface WashHistory {
  id: string;
  userId: string;
  location: WashLocation;
  washType: string;
  date: Date;
  time: string;
}
