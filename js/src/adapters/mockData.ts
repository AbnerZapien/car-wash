import type { User } from '../core/models/user';
import type { Plan, Subscription } from '../core/models/subscription';
import type { WashLocation, WashHistory } from '../core/models/wash';
import type { AdminStats, Member, AdminLocation, ChartDataPoint } from '../core/models/admin';

export const SEED_USERS: (User & { password: string })[] = [
  {
    id: '1',
    username: 'alex',
    email: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Johnson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    createdAt: new Date('2024-01-15'),
    password: 'demo123',
    role: 'user',
  },
  {
    id: '2',
    username: 'john',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
    createdAt: new Date('2024-02-20'),
    password: 'demo123',
    role: 'user',
  },
  {
    id: '3',
    username: 'admin',
    email: 'admin@hedgestone.com',
    firstName: 'Admin',
    lastName: 'User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    createdAt: new Date('2024-01-01'),
    password: 'admin123',
    role: 'admin',
  },
    // --- Meeting demo users ---
  {
    id: '4',
    username: 'mia',
    email: 'mia.torres@hedgestonecarwash.com',
    firstName: 'Mia',
    lastName: 'Torres',
    avatarUrl: 'https://i.pravatar.cc/150?img=47',
    createdAt: new Date('2025-09-01'),
    password: 'demo123',
    role: 'user',
  },
  {
    id: '5',
    username: 'carlos',
    email: 'carlos.mendoza@hedgestonecarwash.com',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    createdAt: new Date('2025-11-10'),
    password: 'demo123',
    role: 'user',
  },
  {
    id: '6',
    username: 'priya',
    email: 'priya.patel@hedgestonecarwash.com',
    firstName: 'Priya',
    lastName: 'Patel',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    createdAt: new Date('2025-06-15'),
    password: 'demo123',
    role: 'user',
  },

];

export const SEED_PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic Wash',
    price: 29,
    features: ['Exterior Wash', 'Interior Vacuum', 'Window Cleaning'],
  },
  {
    id: 'premium',
    name: 'Premium Wash',
    price: 49,
    features: ['Exterior Wash', 'Interior Vacuum', 'Window Cleaning', 'Tire Shine', 'Dashboard Polish'],
    popular: true,
  },
  {
    id: 'ultimate',
    name: 'Platinum Unlimited',
    price: 99,
    features: [
      'Unlimited Washes',
      'Interior Vacuum',
      'Window Cleaning',
      'Tire Shine',
      'Dashboard Polish',
      'Seat Conditioning',
      'Full Interior Detail',
    ],
  },
];

export const SEED_LOCATIONS: WashLocation[] = [
  { id: '1', name: 'Main Street Location', address: '123 Main St, Downtown' },
  { id: '2', name: 'Oakwood Plaza', address: '456 Oak Ave, Westside' },
  { id: '3', name: 'Harbor View', address: '789 Harbor Blvd, Seaside' },
];

export const SEED_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-1',
    userId: '1',
    plan: SEED_PLANS[2],
    status: 'active',
    startDate: new Date('2024-06-01'),
    nextBillingDate: new Date('2025-01-15'),
    washCount: 24,
  },
  {
    id: 'sub-2',
    userId: '2',
    plan: SEED_PLANS[1],
    status: 'active',
    startDate: new Date('2024-08-15'),
    nextBillingDate: new Date('2025-01-20'),
    washCount: 12,
  },
    // --- Meeting demo subscriptions ---
  {
    id: 'sub-4',
    userId: '4',
    plan: SEED_PLANS[1], // Premium
    status: 'active',
    startDate: new Date('2025-09-01'),
    nextBillingDate: new Date('2026-02-01'),
    washCount: 9,
  },
  {
    id: 'sub-5',
    userId: '5',
    plan: SEED_PLANS[0], // Basic
    status: 'active',
    startDate: new Date('2025-11-10'),
    nextBillingDate: new Date('2026-01-25'),
    washCount: 4,
  },
  {
    id: 'sub-6',
    userId: '6',
    plan: SEED_PLANS[2], // Platinum/Unlimited (assuming index 2 exists)
    status: 'active',
    startDate: new Date('2025-06-15'),
    nextBillingDate: new Date('2026-02-10'),
    washCount: 31,
  },

];

export const SEED_WASH_HISTORY: WashHistory[] = [
  {
    id: 'wash-1',
    userId: '1',
    location: SEED_LOCATIONS[0],
    washType: 'Full Service Wash',
    date: new Date('2024-12-08'),
    time: '2:30 PM',
  },
  {
    id: 'wash-2',
    userId: '1',
    location: SEED_LOCATIONS[1],
    washType: 'Express Wash',
    date: new Date('2024-12-05'),
    time: '10:15 AM',
  },
  {
    id: 'wash-3',
    userId: '1',
    location: SEED_LOCATIONS[0],
    washType: 'Premium Detail',
    date: new Date('2024-12-01'),
    time: '4:45 PM',
  },
  {
    id: 'wash-4',
    userId: '2',
    location: SEED_LOCATIONS[2],
    washType: 'Full Service Wash',
    date: new Date('2024-12-07'),
    time: '11:00 AM',
  },
    // --- Meeting demo wash history: Mia (Premium) ---
  {
    id: 'wash-401',
    userId: '4',
    location: SEED_LOCATIONS[0],
    washType: 'Full Service Wash',
    date: new Date('2026-01-10'),
    time: '9:10 AM',
  },
  {
    id: 'wash-402',
    userId: '4',
    location: SEED_LOCATIONS[1],
    washType: 'Express Wash',
    date: new Date('2026-01-03'),
    time: '6:20 PM',
  },
  {
    id: 'wash-403',
    userId: '4',
    location: SEED_LOCATIONS[2],
    washType: 'Interior Detail',
    date: new Date('2025-12-22'),
    time: '1:05 PM',
  },

  // --- Meeting demo wash history: Carlos (Basic) ---
  {
    id: 'wash-501',
    userId: '5',
    location: SEED_LOCATIONS[1],
    washType: 'Exterior Wash',
    date: new Date('2026-01-08'),
    time: '5:35 PM',
  },
  {
    id: 'wash-502',
    userId: '5',
    location: SEED_LOCATIONS[1],
    washType: 'Basic Wash',
    date: new Date('2025-12-30'),
    time: '8:55 AM',
  },

  // --- Meeting demo wash history: Priya (Platinum/Unlimited) ---
  {
    id: 'wash-601',
    userId: '6',
    location: SEED_LOCATIONS[2],
    washType: 'Unlimited Member Wash',
    date: new Date('2026-01-12'),
    time: '7:45 AM',
  },
  {
    id: 'wash-602',
    userId: '6',
    location: SEED_LOCATIONS[0],
    washType: 'Premium Detail',
    date: new Date('2025-12-28'),
    time: '3:50 PM',
  },
  {
    id: 'wash-603',
    userId: '6',
    location: SEED_LOCATIONS[0],
    washType: 'Express Wash',
    date: new Date('2025-12-20'),
    time: '4:10 PM',
  },

];

export const SEED_ADMIN_LOCATIONS: AdminLocation[] = [
  { id: 'loc-1', name: 'Main Street Location' },
  { id: 'loc-2', name: 'Oakwood Plaza' },
  { id: 'loc-3', name: 'Harbor View' },
  { id: 'all', name: 'All Locations' },
];

export const SEED_ADMIN_STATS: AdminStats = {
  activeMemberCount: 237,
  memberGrowth: 27,
  averageUsageRate: 0.18,
  monthlyProjection: 13628.16,
  demographics: [
    { ageGroup: '18-24', percentage: 15, color: '#4F46E5' },
    { ageGroup: '25-34', percentage: 35, color: '#7C3AED' },
    { ageGroup: '35-44', percentage: 25, color: '#EC4899' },
    { ageGroup: '45-54', percentage: 15, color: '#F59E0B' },
    { ageGroup: '55+', percentage: 10, color: '#10B981' },
  ],
};

export const SEED_MEMBERS: Member[] = [
  { id: '1', name: 'Alex Johnson', email: 'alex@example.com', plan: 'Platinum Unlimited', status: 'active', joinDate: new Date('2024-01-15') },
  { id: '2', name: 'John Doe', email: 'john@example.com', plan: 'Premium Wash', status: 'active', joinDate: new Date('2024-02-20') },
  { id: '3', name: 'Sarah Smith', email: 'sarah@example.com', plan: 'Basic Wash', status: 'active', joinDate: new Date('2024-03-10') },
  { id: '4', name: 'Mike Wilson', email: 'mike@example.com', plan: 'Platinum Unlimited', status: 'expired', joinDate: new Date('2024-01-05') },
  { id: '5', name: 'Emily Brown', email: 'emily@example.com', plan: 'Premium Wash', status: 'active', joinDate: new Date('2024-04-22') },

  // demo members
  { id: '6', name: 'Mia Torres', email: 'mia.torres@hedgestonecarwash.com', plan: 'Premium Wash', status: 'active', joinDate: new Date('2025-09-01') },
  { id: '7', name: 'Carlos Mendoza', email: 'carlos.mendoza@hedgestonecarwash.com', plan: 'Basic Wash', status: 'active', joinDate: new Date('2025-11-10') },
  { id: '8', name: 'Priya Patel', email: 'priya.patel@hedgestonecarwash.com', plan: 'Platinum Unlimited', status: 'active', joinDate: new Date('2025-06-15') },
];


export const SEED_ACTIVE_MEMBERS_CHART: ChartDataPoint[] = [
  { label: 'Jan', value: 180 },
  { label: 'Feb', value: 195 },
  { label: 'Mar', value: 205 },
  { label: 'Apr', value: 210 },
  { label: 'May', value: 218 },
  { label: 'Jun', value: 225 },
  { label: 'Jul', value: 230 },
  { label: 'Aug', value: 228 },
  { label: 'Sep', value: 232 },
  { label: 'Oct', value: 235 },
  { label: 'Nov', value: 237 },
  { label: 'Dec', value: 237 },
];

export const SEED_RETENTION_CHART: ChartDataPoint[] = [
  { label: 'Week 1', value: 95 },
  { label: 'Week 2', value: 92 },
  { label: 'Week 3', value: 88 },
  { label: 'Week 4', value: 85 },
];
