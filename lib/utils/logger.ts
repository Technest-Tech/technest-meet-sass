const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

export const logger = {
  info: (msg: string, data?: any) => {
    if (isDevelopment) {
      console.log(`ℹ️ ${msg}`, data !== undefined ? data : '');
    }
  },
  
  error: (msg: string, data?: any) => {
    console.error(`❌ ${msg}`, data !== undefined ? data : '');
  },
  
  warn: (msg: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`⚠️ ${msg}`, data !== undefined ? data : '');
    }
  },
  
  debug: (msg: string, data?: any) => {
    if (isDevelopment) {
      console.debug(`🔍 ${msg}`, data !== undefined ? data : '');
    }
  },
  
  success: (msg: string, data?: any) => {
    if (isDevelopment) {
      console.log(`✅ ${msg}`, data !== undefined ? data : '');
    }
  },
};
















