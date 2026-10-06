import type { Theme } from '@unocss/preset-mini'
import { defineConfig, presetAttributify, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  shortcuts: [
    {
      'btn': 'px-4 py-1 rounded inline-block bg-primary text-[var(--on-accent)] cursor-pointer tracking-wide op90 hover:op100 disabled:cursor-default disabled:bg-[var(--ink-faint)] disabled:!op50 disabled:pointer-events-none',
      'icon-btn': 'text-1.2em cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-primary disabled:pointer-events-none',
      'square-btn': 'flex flex-gap-2 items-center border border-base px2 py1 relative !outline-none rounded-[var(--radius)]',
      'square-btn-mark': 'absolute h-2 w-2 bg-primary -right-0.2rem -top-0.2rem',

      'bg-base': 'bg-[var(--paper)]',
      'bg-overlay': 'bg-[var(--tag-bg)]',
      'bg-header': 'bg-[var(--tag-bg)]',
      'bg-active': 'bg-[var(--tag-bg)]',
      'bg-hover': 'bg-[var(--tag-bg)]',
      'border-base': 'border-[var(--line)]',

      'tab-button': 'font-light op50 hover:op80 h-full px-4',
      'tab-button-active': 'op100 bg-[var(--tag-bg)]',
    },
    [/^(flex|grid)-center/g, () => 'justify-center items-center'],
    [/^(flex|grid)-x-center/g, () => 'justify-center'],
    [/^(flex|grid)-y-center/g, () => 'items-center'],
  ],
  rules: [
    ['max-h-screen', { 'max-height': 'calc(var(--vh, 1vh) * 100)' }],
    ['font-hanzi', { 'font-family': 'var(--brush)' }],
    ['font-round', { 'font-family': 'var(--round)' }],
    ['h-screen', { height: 'calc(var(--vh, 1vh) * 100)' }],
  ],
  theme: <Theme>{
    colors: {
      'ok': 'var(--c-ok)',
      'primary': 'var(--c-primary)',
      'primary-deep': 'var(--c-primary-deep)',
      'mis': 'var(--c-mis)',
    },
  },
  presets: [
    // 上游用的 presetUno 在 UnoCSS 66 里改名为 presetWind3。
    // dark 显式写死 class：主题由 html[data-theme] / html.dark 控制，不能跟系统偏好走。
    presetWind3({ dark: 'class' }),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
  ],
})