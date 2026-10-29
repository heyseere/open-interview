import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import { ActionShortcut } from '@/components/ActionShortcut'
import { SectionCard } from '@/components/SectionCard'
import { Well } from '@/components/Well'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'

interface FaqEntry {
  questionKey: TranslationKey
  answer: ReactNode
}

/**
 * FAQ — documentation, so every entry is prose plus (at most) live keycaps.
 *
 * Answers that mention a key use `ActionShortcut`, which reads the live
 * bindings: a user who rebinds a shortcut must never read a stale literal.
 * The keycap is a span, not a control, so the page keeps zero interactive
 * elements. Instructions point at header icons and shortcuts by NAME, never at
 * a button on this page.
 */
export function FAQ() {
  const { t } = useI18n()

  const faqs: FaqEntry[] = [
    {
      questionKey: 'help.faq1Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ActionShortcut action="takeScreenshot" size="sm" className="mx-1" />
          {t('help.faq1A')}
        </span>
      )
    },
    {
      questionKey: 'help.faq2Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ActionShortcut action="appendScreenshot" size="sm" className="mx-1" />
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
          {t('help.faq4A')} <ActionShortcut action="ignoreOrEnableMouse" size="sm" />{' '}
          {t('help.faq4Tail')}
        </span>
      )
    },
    {
      questionKey: 'help.faq5Q',
      answer: (
        <span>
          {t('help.faq5A')}{' '}
          <ActionShortcut action="toggleTranscription" size="sm" className="mx-1" />
          {t('help.faq5Tail')}
        </span>
      )
    },
    {
      questionKey: 'help.faq6Q',
      answer: (
        <span>
          {t('help.pressTo')}
          <ActionShortcut action="clearTranscription" size="sm" className="mx-1" />
          {t('help.faq6A')}
        </span>
      )
    },
    {
      questionKey: 'help.faq7Q',
      answer: <span>{t('help.faq7A')}</span>
    },
    {
      questionKey: 'help.faq8Q',
      answer: <span>{t('help.faq8A')}</span>
    }
  ]

  return (
    <SectionCard icon={BookOpen} title={t('help.faqTitle')}>
      {faqs.map((faq) => (
        <Well key={faq.questionKey}>
          <h3 className="mb-2 font-semibold">{t(faq.questionKey)}</h3>
          <p className="text-sm text-foreground">{faq.answer}</p>
        </Well>
      ))}
    </SectionCard>
  )
}
