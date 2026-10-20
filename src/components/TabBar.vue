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
    <a class="dc-tab" href="https://k12.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.2A1.4 1.4 0 0 1 5.4 3.8H11a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.4H4z"/>
        <path d="M20 5.2a1.4 1.4 0 0 0-1.4-1.4H15a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.4H20z"/>
      </svg>
      <span class="tx">学古诗</span>
    </a>
    <a class="dc-tab" href="https://jiagu.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="1.6"/>
        <path d="M12 8.4v7.2M9.6 12h4.8"/>
      </svg>
      <span class="tx">画甲骨</span>
    </a>
    <a class="dc-tab" href="https://lian.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5.4" cy="6.6" r="2.3"/>
        <circle cx="12" cy="12" r="2.3"/>
        <circle cx="18.6" cy="17.4" r="2.3"/>
        <path d="M7.1 8.3l3.5 2.4M13.4 13.3l3.5 2.4"/>
      </svg>
      <span class="tx">连句</span>
    </a>
    <a class="dc-tab" href="https://zimi.diuci.com/">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.2 5.4h15.6M7.2 5.4v13.2M16.8 5.4v13.2M9.4 18.6h5.2"/>
        <path d="M9.8 9.6a2.4 2.4 0 1 1 3.3 2.2c-.7.35-1.1.95-1.1 1.7v.5"/>
      </svg>
      <span class="tx">猜谜</span>
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
    </nav>
</template>
