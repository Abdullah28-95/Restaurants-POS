import type { LocalPrinterSettings } from '@/types/pos';
export const defaultPrinterSettings:LocalPrinterSettings={ stationName:'POS-1',printerType:'browser',printerCashIp:'',portCash:'9100',printerKitchenIp1:'',portKitchen1:'9100',printerKitchenIp2:'',portKitchen2:'9100',printerKitchenIp3:'',portKitchen3:'9100',printerKitchenIp4:'',portKitchen4:'9100',categoryPrinterMap:{},enableKds:false,kdsPort:8080,categoryKdsMap:{},customerDisplay:false };
const KEY='futec-pos-local-settings';
export function loadLocalSettings():LocalPrinterSettings{ if(typeof window==='undefined')return defaultPrinterSettings; try{return {...defaultPrinterSettings,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return defaultPrinterSettings;} }
export function saveLocalSettings(v:LocalPrinterSettings){ localStorage.setItem(KEY,JSON.stringify(v)); }
