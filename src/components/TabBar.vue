<script setup lang="ts">
  // 与主站 / K12 同一套底部标签栏：图标路径、字号、高度、top:auto 全部逐值一致。
  // 汉兜站里「汉兜」是当前页，标 on。
</script>

<template>
  <nav class="dc-tabbar" aria-label="快捷导航">
    <a class="dc-tab" href="https://diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.6 10.4 12 3.8l8.4 6.6"/>
        <path d="M5.8 9.2V19a1.4 1.4 0 0 0 1.4 1.4h9.6a1.4 1.4 0 0 0 1.4-1.4V9.2"/>
        <path d="M10 20.4v-5.2h4v5.2"/>
      </svg>
      <span class="tx">首页</span>
    </a>
    <a class="dc-tab on" href="https://handle.diuci.com/" aria-current="page">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.6" y="3.6" width="7.6" height="7.6" rx="2"/>
        <rect x="12.8" y="3.6" width="7.6" height="7.6" rx="2"/>
        <rect x="3.6" y="12.8" width="7.6" height="7.6" rx="2"/>
        <rect x="12.8" y="12.8" width="7.6" height="7.6" rx="2"/>
      </svg>
      <span class="tx">汉兜</span>
    </a>
    <a class="dc-tab" href="https://k12.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.2A1.4 1.4 0 0 1 5.4 3.8H11a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.4H4z"/>
        <path d="M20 5.2a1.4 1.4 0 0 0-1.4-1.4H15a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.4H20z"/>
      </svg>
      <span class="tx">古诗文</span>
    </a>
    <a class="dc-tab" href="https://ink.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.2 3.6H20a.4.4 0 0 1 .4.4v5.8"/>
        <path d="M20.4 3.6 11.2 12.8a2 2 0 0 0-.5 1l-.8 3.4a.5.5 0 0 0 .6.6l3.4-.8a2 2 0 0 0 1-.5l9.2-9.2"/>
        <path d="M15.6 8.4 5.2 18.8a2 2 0 0 1-1 .5l-2 .6a.5.5 0 0 1-.6-.6l.6-2a2 2 0 0 1 .5-1L13 5.6"/>
      </svg>
      <span class="tx">对战</span>
    </a>
    <a class="dc-tab" href="https://moon.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>
        <path d="M17.6 3.2 16.8 5M20.8 6.4 18.6 6.9M14.6 2.4l.5 1.8"/>
      </svg>
      <span class="tx">月光</span>
    </a>
  </nav>
</template>
