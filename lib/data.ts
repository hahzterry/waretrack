export type Zone = 'Frozen' | 'Chilled';

export interface SiteSeed {
  id: string;
  name: string;
  code: string;
  city: string;
  docks: number;
  maintenanceDocks: number[];
  capacity: number; // pallet positions
  fill: number; // starting fill ratio
  delivered: number;
  onTime: number;
  temps: { frozen: number; chilled: number };
}

export const SITES: SiteSeed[] = [
  {
    id: 'nh',
    name: 'North Harbor Cold Hub',
    code: 'NHC-01',
    city: 'Harbor District',
    docks: 6,
    maintenanceDocks: [],
    capacity: 5200,
    fill: 0.74,
    delivered: 184,
    onTime: 173,
    temps: { frozen: -21.4, chilled: 2.1 },
  },
  {
    id: 'rv',
    name: 'Riverside Reefer DC',
    code: 'RRD-02',
    city: 'Riverside',
    docks: 5,
    maintenanceDocks: [3],
    capacity: 4100,
    fill: 0.81,
    delivered: 132,
    onTime: 118,
    temps: { frozen: -19.8, chilled: 3.4 },
  },
  {
    id: 'sm',
    name: 'Summit Frozen DC',
    code: 'SFD-03',
    city: 'Summit Valley',
    docks: 4,
    maintenanceDocks: [],
    capacity: 3300,
    fill: 0.58,
    delivered: 97,
    onTime: 94,
    temps: { frozen: -22.6, chilled: 1.8 },
  },
  {
    id: 'bv',
    name: 'Bayview Chill Center',
    code: 'BCC-04',
    city: 'Bayview',
    docks: 5,
    maintenanceDocks: [],
    capacity: 3900,
    fill: 0.67,
    delivered: 151,
    onTime: 139,
    temps: { frozen: -20.3, chilled: 2.6 },
  },
];

export interface SkuSeed {
  sku: string;
  name: string;
  zone: Zone;
  share: number; // share of stock
  min: number; // low-stock threshold as share of its nominal
}

export const SKUS: SkuSeed[] = [
  { sku: 'FZ-1042', name: 'Frozen Peas 2.5kg', zone: 'Frozen', share: 0.17, min: 0.55 },
  { sku: 'FZ-2210', name: 'Ice Cream Tubs', zone: 'Frozen', share: 0.14, min: 0.6 },
  { sku: 'FZ-3307', name: 'Chicken Breast IQF', zone: 'Frozen', share: 0.16, min: 0.5 },
  { sku: 'FZ-4415', name: 'Salmon Fillets', zone: 'Frozen', share: 0.1, min: 0.55 },
  { sku: 'FZ-5120', name: 'Mixed Berries', zone: 'Frozen', share: 0.09, min: 0.6 },
  { sku: 'CH-6031', name: 'Greek Yogurt', zone: 'Chilled', share: 0.13, min: 0.55 },
  { sku: 'CH-7008', name: 'Fresh Cheese Blocks', zone: 'Chilled', share: 0.11, min: 0.5 },
  { sku: 'FZ-8124', name: 'Frozen Shrimp', zone: 'Frozen', share: 0.1, min: 0.6 },
];

export const CARRIERS = ['Polar Freight', 'ColdLine Logistics', 'Nordic Reefer', 'FrostWay', 'BlueChain Transport', 'Arctic Express'];
export const ORIGINS = ['Port Terminal 4', 'Valley Farms Co-op', 'Coastal Seafoods', 'Dairy Union Plant', 'Central Poultry', 'Berry Growers Assn.', 'Inland Rail Yard'];
