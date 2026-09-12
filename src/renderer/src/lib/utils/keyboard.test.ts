import { describe, expect, it, vi } from 'vitest'
import {
  getShortcutAccelerator,
  getShortcutAcceleratorDisplay,
  getMouseButtonAccelerator,
  isMouseButtonBinding,
  isModifierKey
} from './keyboard'

vi.mock('./env', () => ({
  isMac: true,
  platformAlt: 'Alt'
}))

type EventOverrides = Partial<{
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  getModifierState: (key: string) => boolean
}>

function makeEvent(overrides: EventOverrides): KeyboardEvent {
  return {
    code: 'KeyK',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    getModifierState: () => false,
    ...overrides
  } as unknown as KeyboardEvent
}

describe('isModifierKey', () => {
  it('recognises all modifier codes', () => {
    expect(isModifierKey('ShiftLeft')).toBe(true)
    expect(isModifierKey('ControlRight')).toBe(true)
    expect(isModifierKey('MetaLeft')).toBe(true)
    expect(isModifierKey('AltRight')).toBe(true)
  })

  it('rejects non-modifier codes', () => {
    expect(isModifierKey('KeyA')).toBe(false)
    expect(isModifierKey('Enter')).toBe(false)
  })
})

describe('getShortcutAccelerator (macOS)', () => {
  it('builds Alt shortcut on macOS', () => {
    expect(getShortcutAccelerator(makeEvent({ code: 'Enter', altKey: true }))).toBe('Alt+Enter')
  })

  it('maps Ctrl to Control prefix on macOS', () => {
    expect(getShortcutAccelerator(makeEvent({ code: 'KeyC', ctrlKey: true }))).toBe('Control+C')
  })

  it('stacks modifiers in Ctrl, Alt, Shift, Meta order', () => {
    expect(
      getShortcutAccelerator(
        makeEvent({ code: 'Digit1', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true })
      )
    ).toBe('Control+Alt+Shift+CommandOrControl+1')
  })

  it('converts arrow and special keys to accelerator names', () => {
    expect(getShortcutAccelerator(makeEvent({ code: 'ArrowUp', altKey: true }))).toBe('Alt+Up')
    expect(getShortcutAccelerator(makeEvent({ code: 'Slash', altKey: true }))).toBe('Alt+/')
    expect(getShortcutAccelerator(makeEvent({ code: 'Backquote', altKey: true }))).toBe('Alt+`')
  })

  it('rejects bare modifier presses and unsupported keys', () => {
    expect(getShortcutAccelerator(makeEvent({ code: 'ShiftLeft' }))).toBeNull()
    expect(getShortcutAccelerator(makeEvent({ code: 'Numpad1' }))).toBeNull()
    expect(getShortcutAccelerator(makeEvent({ code: 'KeyA' }))).toBeNull()
  })

  it('treats AltGraph (AltRight) as plain Alt without Control', () => {
    const event = makeEvent({
      code: 'KeyJ',
      ctrlKey: true,
      altKey: true,
      getModifierState: (state) => state === 'AltGraph'
    })
    expect(getShortcutAccelerator(event)).toBe('Alt+J')
  })
})

describe('getShortcutAcceleratorDisplay', () => {
  it('renders mac symbols for modifiers and special keys', () => {
    expect(getShortcutAcceleratorDisplay('CommandOrControl+Alt+Enter')).toBe('⌘+⌥+↵')
    expect(getShortcutAcceleratorDisplay('Control+Shift+Up')).toBe('⌃+⇧+↑')
  })

  it('passes plain letter keys through unchanged', () => {
    expect(getShortcutAcceleratorDisplay('Alt+T')).toBe('⌥+T')
  })
})

describe('mouse button bindings', () => {
  it('maps middle and side buttons only (left/right are not bindable)', () => {
    expect(getMouseButtonAccelerator(0)).toBeNull() // left
    expect(getMouseButtonAccelerator(1)).toBe('Mouse3') // middle
    expect(getMouseButtonAccelerator(2)).toBeNull() // right
    expect(getMouseButtonAccelerator(3)).toBe('Mouse4') // side back
    expect(getMouseButtonAccelerator(4)).toBe('Mouse5') // side forward
    expect(getMouseButtonAccelerator(5)).toBeNull()
  })

  it('recognises only middle/side tokens as mouse bindings', () => {
    for (const token of ['Mouse3', 'Mouse4', 'Mouse5']) {
      expect(isMouseButtonBinding(token)).toBe(true)
    }
    for (const token of ['Mouse1', 'Mouse2', 'Mouse6']) {
      expect(isMouseButtonBinding(token)).toBe(false)
    }
    expect(isMouseButtonBinding('Alt+F')).toBe(false)
  })

  it('renders button bindings without modifier parsing', () => {
    expect(getShortcutAcceleratorDisplay('Mouse3')).toBe('\u{1F5B1}3')
    expect(getShortcutAcceleratorDisplay('Mouse5')).toBe('\u{1F5B1}5')
  })
})
