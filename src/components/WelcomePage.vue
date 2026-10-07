<script setup lang="ts">
import { isDark, kind, showHelp, showVariants, useMask } from '~/state'
import { initialized, inputMode } from '~/storage'
import { t } from '~/i18n'

function start() {
  showHelp.value = false
  useMask.value = false
  initialized.value = true
}

function variantButton() {
  showVariants.value = true
}

const final = computed(() => ({ py: 'uo', zy: 'ㄨㄛ', sp: 'o' }[inputMode.value]))
// 成语玩法沿用上游的文案与例子；五言 / 七言换一套说法和例子。
const isIdiom = computed(() => kind.value === 'idiom')

/**
 * 规则页的例子必须和当前玩法同字数，否则七言玩法下面摆一行五言，
 * 后面两个空格子看起来像坏了。两句都取自诗句词库，不是编的。
 */
const verseDemo = computed(() => kind.value === 'qiyan'
  ? { guess: '病树前头万木春', answer: '千树万树梨花开' }
  : { guess: '千山鸟飞绝', answer: '众鸟高飞尽' })
</script>

<template>
  <div p="x5 y10" flex="~ col gap-2 y-center" relative>
    <div absolute top-4 right-4 flex="~ gap-3">
      <button v-if="!initialized" icon-btn @click="isDark = !isDark">
        <div i-carbon-sun dark:i-carbon-moon />
      </button>
      <button v-else icon-btn @click="start()">
        <div i-carbon-close />
      </button>
    </div>

    <AppName h="2.5rem" />
    <div mt--1 op50 text-sm>
      {{ t('description') }}
    </div>

    <div h-1px w-10 border="b base" m4 />

    <p text-xl font-serif mb4>
      <b>{{ t('rule') }}</b>
    </p>

    <template v-if="!isIdiom">
      <p>{{ t('intro-verse-1') }}</p>
      <p>{{ t('intro-verse-2') }}</p>
    </template>

    <p>{{ t('intro-1') }} <b text-ok>{{ t('target-' + kind) }}</b>。</p>
    <p>{{ t('intro-3') }}</p>
    <div h-1px w-10 border="b base" m4 />

    <template v-if="isIdiom">
      <WordBlocks my2 :word="t('example-1')" :revealed="true" answer=" 门  " />
      <p>{{ t('intro-4') }} <b text-ok>{{ t('intro-5') }}</b> {{ t('intro-6') }}</p>

      <WordBlocks my2 :word="t('example-2')" :revealed="true" answer="一一一水" />
      <p>{{ t('intro-7') }} <b text-mis>{{ t('intro-8') }}</b> {{ t('intro-9') }}</p>

      <WordBlocks my2 :word="t('example-3')" :revealed="true" answer="桥它拖 " />
      <p max-w-130>
        {{ t('intro-10') }} <b>{{ t('intro-11') }}</b> {{ t('intro-12') }}
        {{ t('intro-13') }} <b>{{ t('intro-14') }}</b> {{ t('intro-15') }} <b op50>{{ t('intro-14') }}</b> {{ t('intro-16') }}
        {{ t('intro-17') }} <b text-mis>{{ final }}</b> {{ t('intro-19') }}
      </p>

      <WordBlocks my2 :word="t('example-4')" :revealed="true" answer="武运昌隆" />
      <p>{{ t('intro-20') }}</p>
    </template>

    <template v-else>
      <WordBlocks my2 :word="verseDemo.guess" :revealed="true" :answer="verseDemo.answer" />
      <p max-w-130>
        {{ t('verse-rule-1') }}
        {{ t('intro-10') }} <b>{{ t('intro-11') }}</b> {{ t('intro-12') }}{{ t('verse-rule-2') }}
      </p>

      <WordBlocks my2 :word="verseDemo.answer" :revealed="true" :answer="verseDemo.answer" />
      <p>{{ t('intro-20-verse') }}</p>
      <p op60>{{ t('intro-verse-3') }}</p>
    </template>

    <div h-1px w-10 border="b base" m4 />

    <button btn p="x4 y2" @click="start()">
      <span tracking-1 pl1>{{ t('start') }}</span>
    </button>
    <div op50>
      {{ t('update-tip') }}
    </div>

    <div h-1px w-10 border="b base" m4 />

    <Settings :lite="true" />

    <div h-1px w-10 border="b base" m4 />

    <div h-1px w-10 border="b base" m4 />
    <button text-primary op80 hover:op100 @click="variantButton()">
      {{ t('other-variants') }}
    </button>
    <div>
      <span op40>玩法与词库来自 </span>
      <a op50 hover:op80 href="https://github.com/antfu/handle" target="_blank">汉兜 Handle</a>
      <span op40> · Anthony Fu &amp; Inès · MIT</span>
    </div>
    <div>
      <span op40>{{ t('verse-attribution') }}</span>
    </div>
    <div>
      <span op40>本站是 </span>
      <a op50 hover:op80 href="https://diuci.com/" target="_blank">丢词夺理</a>
      <span op40> 的非官方复刻，与上游无关联</span>
    </div>
    <div>
      <a op50 hover:op80 href="https://k12.diuci.com/legal/" target="_blank">{{ t('legal-link') }}</a>
      <span op40> · <a op50 hover:op80 href="mailto:hi@diuci.com">hi@diuci.com</a></span>
    </div>
    <a href="https://github.com/diuci/handle" target="_blank" flex="~ center gap-1" op50 hover:op80>
      <div i-carbon-logo-github />
      {{ t('source-code') }}
    </a>
  </div>
</template>
