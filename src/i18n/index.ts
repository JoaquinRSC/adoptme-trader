import en from './en'
import es from './es'

export const messages = { en, es }
export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export default messages
