<script setup lang="ts">
import { t } from '~/i18n'
</script>

<template>
  <div pb2 op50>
    {{ t('feedback') }}
  </div>
  <div flex>
    <a
      square-btn mx2 flex-gap-1
      href="https://github.com/diuci/handle/issues"
      target="_blank"
    >
      <div i-carbon-logo-github />
      {{ t('report-issue') }}
    </a>
    <a
      square-btn mx2 flex-gap-1
      href="https://github.com/antfu/handle"
      target="_blank"
    >
      <div i-carbon-document />
      {{ t('upstream') }}
    </a>
  </div>
</template>
