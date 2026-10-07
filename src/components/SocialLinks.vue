<script setup lang="ts">
import { t } from '~/i18n'
</script>

<template>
  <div p4 mt2 op50>
    {{ t('join-community') }}
  </div>
  <div flex>
    <a
      square-btn mx2 flex-gap-1
      href="https://diuci.com/"
      target="_blank"
    >
      <div i-carbon-home />
      {{ t('our-site') }}
    </a>
    <a
      square-btn mx2 flex-gap-1
      href="https://lian.diuci.com/"
      target="_blank"
    >
      <div i-carbon-flow-activity />
      连词成句
    </a>
    <a
      square-btn mx2 flex-gap-1
      href="https://github.com/diuci/handle/issues"
      target="_blank"
    >
      <div i-carbon-logo-github />
      {{ t('report-issue') }}
    </a>
  </div>
</template>
