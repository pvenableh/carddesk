<script setup lang="ts">
/**
 * Top-level Activity Feed screen — promoted to its own bottom-nav tab. Wraps the
 * reusable <FeedView> in the standard screen chrome (header + scroll body) so it
 * matches the other primary screens. The feed body itself (privacy toggle,
 * events, reactions) lives in FeedView.
 */
import FeedView from './FeedView.vue'
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr" style="padding-bottom: 8px">
      <div class="cd-stitle">Activity Feed</div>
    </div>
    <FeedView />
  </div>
</template>
