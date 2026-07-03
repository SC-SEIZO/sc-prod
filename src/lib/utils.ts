import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  if (!name) return '';
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const parts = cleanName.split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function getMemberPin(factoryName: string, machineId: string): string {
  // Guard against null/undefined arguments
  if (!factoryName || !machineId) return 'XXXX';

  let factoryCode = '';
  const uFact = factoryName.toUpperCase();
  if (uFact === 'FACT 2') {
    factoryCode = 'F2';
  } else if (uFact === 'FACT 3') {
    factoryCode = 'F3';
  } else if (uFact === 'FACT 4') {
    factoryCode = 'F4';
  } else if (uFact.includes('SC2')) {
    factoryCode = 'SC'; // Use 2-char code so machine digits fit in 4-char PIN
  } else {
    const match = factoryName.match(/\d+/);
    factoryCode = match ? `F${match[0]}` : 'F';
  }

  let cleanMachine = machineId.replace(/\s+/g, '');
  if (cleanMachine.toUpperCase().startsWith('MC')) {
    cleanMachine = cleanMachine.substring(2);
  }

  // Always pad machine code so total PIN is exactly 4 chars
  const maxMachineLen = 4 - factoryCode.length;
  let machineCode = cleanMachine.substring(0, maxMachineLen);
  if (machineCode.length < maxMachineLen && /^\d+$/.test(machineCode)) {
    machineCode = machineCode.padStart(maxMachineLen, '0');
  }

  const fullPin = `${factoryCode}${machineCode}`.toUpperCase();
  return fullPin.substring(0, 4);
}
