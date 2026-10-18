import {defineConfig} from '@playwright/test'
import base from './playwright.config'
export default defineConfig({...base,use:{...base.use,baseURL:'http://127.0.0.1:4175'},webServer:[{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort',url:'http://127.0.0.1:4175',reuseExistingServer:true},{command:'node scripts/serve-pitnote.mjs',url:'http://127.0.0.1:4190',reuseExistingServer:true}]})
