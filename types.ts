

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  PRODUCTION = 'PRODUCTION'
  ,SALES = 'SALES'
  ,PROCUREMENT = 'PROCUREMENT'
}

export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_ORDERS'
  | 'MANAGE_ORDERS'
  | 'VIEW_PRODUCTION'
  | 'MANAGE_PRODUCTION'
  | 'CREATE_SCAN_TABLE'
  | 'DELETE_SCAN_TABLE'
  | 'MANAGE_SCAN_TEMPLATE'
  | 'USE_SCAN_TEMPLATE'
  | 'ADD_PRODUCTION_COLUMN'
  | 'DELETE_PRODUCTION_COLUMN'
  | 'FORCE_DUPLICATE_SN'
  | 'FORCE_EDIT_COMPLETED_SCAN'
  | 'FORCE_COMPLETE_SCAN'
  | 'MANAGE_PRODUCTION_REPAIR'
  | 'MANAGE_SYSTEM'
  | 'MANAGE_SALES'
  | 'MANAGE_PROCUREMENT';

export enum OrderStatus {
  PENDING = 'PENDING',         // Created
  ASSIGNED = 'ASSIGNED',       // Manager assigned
  CHECKING = 'CHECKING',       // Diagnosis / Repair Loop
  QA_AGING = 'QA_AGING',       // Aging Test (New)
  SHIPPED = 'SHIPPED',         // Logistics
  CLOSED = 'CLOSED',           // Done
  SUSPENDED = 'SUSPENDED',     // Paused (requires reason)
  CANCELLED = 'CANCELLED'      // Cancelled (terminal, requires reason)
}

// New Enum for Discovery Phase
export enum DiscoveryPhase {
  IN_USE = '使用中',
  UNUSED = '未使用',
  PRODUCTION_RETURN = '生产返回',
  LOAN_RETURN = '借测归还',
  TEST_RETURN = '退测',
  OTHER = '其他'
}

export interface User {
  id: number;
  username: string;
  password?: string; 
  role: UserRole;
  permissions: Permission[]; 
  status: 'active' | 'pending';
  phone?: string;
  mustChangePassword?: boolean;
  /** Direct (personal) grants, separate from role/group effective permissions. */
  personalPermissions?: Permission[];
  permissionGroupIds?: number[];
  /** Permission -> role/group/direct grant labels for explainable authorization. */
  permissionSources?: Record<string, string[]>;
}

export interface Asset {
  id?: string; 
  batch_name?: string; 
  contract_no: string; 
  invoice_date: string; 
  model: string; 
  machine_sn: string; 
  
  // Components
  mb_model?: string; 
  mb_sn?: string; 
  
  cpu_model?: string; 
  cpu_sn?: string; 
  cpu_sn_2?: string; 

  psu_info?: string; 
  psu_cage_sn?: string; 
  psu_module_1_sn?: string; 
  psu_module_2_sn?: string; 

  hdd_info?: string; 
  hdd_sn?: string; 

  mem_info?: string; 
  mem_sns?: string; 

  pcie_sn?: string; 

  created_at?: string;
  factory_config_json?: string; 
}

export interface TestReport {
  id: number;
  machine_sn: string;
  test_type: 'STRESS_CPU' | 'MEMTEST' | 'IO_CHECK';
  status: 'PASS' | 'FAIL';
  log_snippet: string;
  report_url?: string;
  timestamp: string;
}

export interface LogisticsRecord {
  id: number;
  order_id: number;
  status: string;
  location: string;
  timestamp: string;
}

export interface RepairPartItem {
  id: string;
  part_name: string;
  old_sn: string;
  new_sn: string;
}

export interface RepairOrder {
  id: number;
  order_number: string;
  
  // Creation Fields
  machine_sn: string;
  customer_name: string; // New
  fault_description: string;
  discovery_phase: DiscoveryPhase; // New
  
  // Auto-fetched Data
  shipment_model?: string;
  shipment_date?: string;
  shipment_config_json?: string; // From Asset

  // Processing Fields
  received_config_json?: string; // Engineer Editable
  actual_fault_description?: string; // Engineer Confirmed
  
  parts_list?: RepairPartItem[]; // New Excel-like list
  
  report_data_json?: string; // Stores the final Repair Report structure
  
  status: OrderStatus;
  assigned_to?: number; 
  
  // Logistics
  logistics_provider?: string; // SF, JD, Driver, Pickup
  tracking_number?: string;
  
  created_at: string;
  updated_at: string;
}

export interface LifecycleEvent {
  id: number;
  machine_sn: string;
  event_type: 'FACTORY_SHIP' | 'REPAIR_SWAP' | 'STRESS_TEST' | 'LOGISTICS_UPDATE';
  part_name?: string;
  old_sn?: string;
  new_sn?: string;
  timestamp: string;
  technician_name?: string;
  operator_no?: string;
  operatorNo?: string;
  fault_description?: string;
  faultDescription?: string;
  details?: string;
}

// --- System Configuration Types ---

export type DatabaseType = 'mysql' | 'postgres' | 'oracle' | 'sqlite';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  filePath?: string; 
  ssl?: boolean;
}

export interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  dbIndex: number;
}

export interface SystemSettings {
  appName: string;
  maintenanceMode: boolean;
  logRetentionDays: number;
}

export interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  uptime: number; 
  dbStatus: 'connected' | 'disconnected' | 'latency_high';
  dbLatency: number; 
  redisStatus: 'connected' | 'disconnected' | 'disabled';
  activeConnections: number;
}
