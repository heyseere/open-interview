import { Link } from 'react-router'
import {
  ArrowLeft,
  Lightbulb,
  MessageCircle,
  Camera,
  PictureInPicture2,
  EyeOff,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { platformAlt } from '@/lib/utils/env'
import { useI18n } from '@/lib/i18n'
import { HelpSection } from './components'
import { Shortcuts } from './Shortcuts'
import { FAQ } from './FAQ'

export default function HelpPage() {
  const { t } = useI18n()

  return (
    <>
      {/* Header */}
      <div id="app-header" className="flex items-center">
        <div className="actions">
          <Button variant="ghost" asChild size="icon" className="w-12 mr-2 rounded-none">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
        <h1>{t('help.title')}</h1>
      </div>

      {/* Help Content */}
      <div id="app-content" className="flex flex-col gap-4 p-8">
        {/* Introduction */}
        <HelpSection Icon={Info} title={t('help.introTitle')}>
          <p className="text-gray-700">
            {t('help.introBody')} {t('help.visitProject')}{' '}
            <a
              href="https://github.com/heyseere/open-interview#readme"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              {t('help.repoLink')}
            </a>{' '}
            {t('help.introTail')}
          </p>
          <div className="bg-gray-700/10 rounded-lg p-4">
            <h3 className="font-semibold mb-2">{t('help.featuresTitle')}</h3>
            <ul className="space-y-1 text-gray-700 list-disc list-inside">
              <li className="flex gap-2">
                <Camera className="h-6 w-4" />
                <span>{t('help.featureScreenshot')}</span>
              </li>
              <li className="flex gap-2">
                <EyeOff className="h-6 w-4" />
                <span>{t('help.featureStealth')}</span>
              </li>
              <li className="flex items-start gap-2">
                <PictureInPicture2 className="h-6 w-4" />
                <span>{t('help.featureOverlay')}</span>
              </li>
            </ul>
          </div>
        </HelpSection>

        {/* Quick Start */}
        <HelpSection Icon={Lightbulb} title={t('help.quickStartTitle')}>
          <div className="border border-gray-400 rounded-lg p-4">
            <h3 className="font-semibold mb-2">{t('help.step1Title')}</h3>
            <p className="text-sm text-gray-700">
              {t('help.step1Body')}{' '}
              <ShortcutRenderer
                shortcut={`${platformAlt}+Enter`}
                variant="light"
                className="text-xs mx-1"
              />
              {t('help.step1Tail')}
            </p>
          </div>
          <div className="border border-gray-400 rounded-lg p-4">
            <h3 className="font-semibold mb-2">{t('help.step2Title')}</h3>
            <p className="text-sm text-gray-700">{t('help.step2Body')}</p>
          </div>
        </HelpSection>

        {/* Keyboard Shortcuts */}
        <Shortcuts />

        {/* FAQ */}
        <FAQ />

        {/* Contact Support */}
        <HelpSection Icon={MessageCircle} title={t('help.supportTitle')}>
          <p className="text-gray-700">{t('help.supportBody')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-gray-400 rounded-lg p-4">
              <h3 className="font-semibold mb-2 ">{t('help.supportIssuesTitle')}</h3>
              <p className="text-gray-700">
                {t('help.onPage')}{' '}
                <a
                  href="https://github.com/heyseere/open-interview/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {t('help.supportIssuesTitle')}
                </a>{' '}
                {t('help.supportIssuesBody')}
              </p>
            </div>
          </div>
        </HelpSection>
      </div>
    </>
  )
}
