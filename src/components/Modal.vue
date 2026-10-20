<script setup lang='ts'>
const props = withDefaults(defineProps<{
  modelValue?: boolean
  direction?: string
  mask?: boolean
}>(), {
  modelValue: false,
  direction: 'bottom',
  mask: true,
})

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const positionClass = computed(() => {
  switch (props.direction) {
    case 'bottom':
      return 'bottom-0 left-0 right-0 border-t'
    case 'top':
      return 'top-0 left-0 right-0 border-b'
    case 'left':
      return 'bottom-0 left-0 top-0 border-r w-max'
    case 'right':
      return 'bottom-0 top-0 right-0 border-l w-max'
    default:
      return ''
  }
})

const containerPositionClass = computed(() => {
  if (props.mask)
    return 'bottom-0 left-0 right-0 top-0'
  switch (props.direction) {
    case 'bottom':
      return 'bottom-0 left-0 right-0'
    case 'top':
      return 'top-0 left-0 right-0'
    case 'left':
      return 'bottom-0 left-0 top-0'
    case 'right':
      return 'bottom-0 top-0 right-0'
    default:
      return ''
  }
})

const transform = computed(() => {
  switch (props.direction) {
    case 'bottom':
      return 'translateY(100%)'
    case 'top':
      return 'translateY(-100%)'
    case 'left':
      return 'translateX(-100%)'
    case 'right':
      return 'translateX(100%)'
    default:
      return ''
  }
})
</script>

<template>
  <div
    fixed z-40
    :class="[containerPositionClass, modelValue ? '' : 'pointer-events-none']"
  >
    <div
      v-if="mask"
      class="bg-[#241f1a] left-0 right-0 top-0 bottom-0 absolute transition-opacity duration-500 ease-out"
      :class="modelValue ? 'opacity-40' : 'opacity-0'"
      @click="$emit('update:modelValue', false)"
    />
    <!-- scrim 用固定暗色：之前 bg-[var(--ink)] 在暗色主题下是浅色——40% 白雾盖住游戏，
         内容看着「浮」在页面上（实抓）。暗 scrim 亮暗两主题都成立。
         面板 padding-top 让位顶栏：top sheet 从 top-0 铺起，首屏印章曾被 sticky 顶栏拦腰盖住。 -->
    <div
      class="dc-modal bg-base border-base absolute transition-all duration-200 ease-out max-w-screen max-h-screen overflow-auto scrolls shadow-[var(--shadow)] pt-[var(--dc-nav-h)]"
      :class="[positionClass]"
      :style="modelValue ? {} : { transform }"
    >
      <slot />
    </div>
  </div>
</template>
