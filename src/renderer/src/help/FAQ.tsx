import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { platformAlt } from '@/lib/utils/env'
import { HelpSection } from './components'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'

interface FaqEntry {
  questionKey: TranslationKey
  answer: ReactNode
}

export function FAQ() {
  const { t } = useI18n()

  const faqs: FaqEntry[] = [
    {
      questionKey: 'help.faq1Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ShortcutRenderer
            shortcut={`${platformAlt}+Enter`}
            variant="light"
            className="text-xs mx-1"
          />
          {t('help.faq1A')}
        </span>
      )
    },
    {
      questionKey: 'help.faq2Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ShortcutRenderer
            shortcut={`${platformAlt}+Shift+Enter`}
            variant="light"
            className="text-xs mx-1"
          />
          {t('help.faq2A')}
        </span>
      )
    },
    {
      questionKey: 'help.faq3Q',
      answer: <span>{t('help.faq3A')}</span>
    },
    {
      questionKey: 'help.faq4Q',
      answer: (
        <span>
          {t('help.faq4A')}{' '}
          <ShortcutRenderer shortcut={`${platformAlt}+M`} variant="light" className="text-xs" />{' '}
          {t('help.faq4Tail')}
        </span>
      )
    },
    {
      questionKey: 'help.faq5Q',
      answer: (
        <span>
          {t('help.faq5A')}{' '}
          <ShortcutRenderer
            shortcut={`${platformAlt}+T`}
            variant="light"
            className="text-xs mx-1"
          />
          {t('help.faq5Tail')}
        </span>
      )
    },
    {
      questionKey: 'help.faq6Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ShortcutRenderer
            shortcut={`${platformAlt}+Shift+T`}
            variant="light"
            className="text-xs mx-1"
          />
          {t('help.faq6A')}
        </span>
      )
    },
    {
      questionKey: 'help.faq7Q',
      answer: <span>{t('help.faq7A')}</span>
    }
  ]

  return (
    <HelpSection Icon={BookOpen} title={t('help.faqTitle')}>
      {faqs.map((faq, index) => (
        <div key={index} className="border border-gray-400 rounded-lg p-4">
          <h3 className="font-semibold mb-2">{t(faq.questionKey)}</h3>
          <p className="text-sm text-gray-700">{faq.answer}</p>
        </div>
      ))}
    </HelpSection>
  )
}
