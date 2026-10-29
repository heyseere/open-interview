import { describe, expect, it } from 'vitest'
import {
  TOOLBAR_BUTTON_DEFAULT,
  TOOLBAR_BUTTON_IDS,
  TOOLBAR_BUTTON_META,
  normalizeToolbarButtons,
  splitToolbarRows,
  THREE_ROW_WIDTH,
  TWO_ROW_WIDTH,
  type ToolbarSection,
  type ToolbarSectionEntry
} from './toolbar-buttons'

describe('toolbar button registry', () => {
  it('has metadata for every id and no extras', () => {
    expect(Object.keys(TOOLBAR_BUTTON_META).sort()).toEqual([...TOOLBAR_BUTTON_IDS].sort())
  })

  it('defaults to every button in registry order', () => {
    expect(TOOLBAR_BUTTON_DEFAULT).toEqual([...TOOLBAR_BUTTON_IDS])
  })
})

describe('normalizeToolbarButtons', () => {
  it('keeps a valid selection, preserving the chosen order', () => {
    expect(normalizeToolbarButtons(['stop', 'voice'])).toEqual(['stop', 'voice'])
  })

  it('drops unknown ids (renamed/removed in a later version)', () => {
    expect(normalizeToolbarButtons(['voice', 'nope', 'stop'])).toEqual(['voice', 'stop'])
  })

  it('falls back to all buttons for an empty or non-array value', () => {
    // An empty toolbar would hide the only mouse surface in compact layout
    expect(normalizeToolbarButtons([])).toEqual(TOOLBAR_BUTTON_DEFAULT)
    expect(normalizeToolbarButtons(undefined)).toEqual(TOOLBAR_BUTTON_DEFAULT)
    expect(normalizeToolbarButtons('voice')).toEqual(TOOLBAR_BUTTON_DEFAULT)
  })

  it('falls back when every persisted id is unknown', () => {
    expect(normalizeToolbarButtons(['a', 'b'])).toEqual(TOOLBAR_BUTTON_DEFAULT)
  })
})

describe('splitToolbarRows', () => {
  const entry = (section: ToolbarSection, count = 1): ToolbarSectionEntry => ({
    section,
    buttons: Array.from({ length: count }, (_, i) => `${section}-${i}`)
  })
  const all = [entry('transcription', 4), entry('screenshot', 4), entry('generation', 3)]

  it('keeps one row on wide windows', () => {
    expect(splitToolbarRows(all, TWO_ROW_WIDTH)).toEqual([all])
    expect(splitToolbarRows(all, 1200)).toEqual([all])
  })

  it('splits transcription off below TWO_ROW_WIDTH', () => {
    const rows = splitToolbarRows(all, TWO_ROW_WIDTH - 1)
    expect(rows.map((row) => row.map((entry) => entry.section))).toEqual([
      ['transcription'],
      ['screenshot', 'generation']
    ])
    expect(splitToolbarRows(all, THREE_ROW_WIDTH)).toEqual(rows)
  })

  it('gives every section its own row below THREE_ROW_WIDTH', () => {
    const rows = splitToolbarRows(all, THREE_ROW_WIDTH - 1)
    expect(rows.map((row) => row.map((entry) => entry.section))).toEqual([
      ['transcription'],
      ['screenshot'],
      ['generation']
    ])
    expect(splitToolbarRows(all, 240)).toEqual(rows)
  })

  it('never renders a row for an empty section', () => {
    const withEmpty = [entry('transcription', 2), entry('generation', 1)]
    expect(splitToolbarRows(withEmpty, THREE_ROW_WIDTH - 1).map((row) => row[0].section)).toEqual([
      'transcription',
      'generation'
    ])
  })
})
