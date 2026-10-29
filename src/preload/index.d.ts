import type { MainAPI } from './index'

declare global {
  interface Window {
    api: MainAPI
  }
}
