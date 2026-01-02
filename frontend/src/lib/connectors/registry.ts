// Driver Registry
// Central registration point for all database drivers

import type { Driver } from './types';

const drivers = new Map<string, Driver>();

/**
 * Register a driver in the registry
 */
export function registerDriver(driver: Driver): void {
  if (drivers.has(driver.name)) {
    console.warn(`Driver ${driver.name} is already registered, overwriting.`);
  }
  drivers.set(driver.name, driver);
}

/**
 * Get a driver by name
 */
export function getDriver(name: string): Driver | undefined {
  return drivers.get(name);
}

/**
 * List all registered drivers
 */
export function listDrivers(): Driver[] {
  return Array.from(drivers.values());
}

/**
 * Check if a driver is registered
 */
export function hasDriver(name: string): boolean {
  return drivers.has(name);
}
