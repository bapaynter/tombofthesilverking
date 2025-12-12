<template>
  <div class="game-container">
    <header class="header">
      <h1>The Tomb of the Silver King</h1>
      <h3>Dungeon {{ currentLevel + 1 }}</h3>
    </header>

    <div class="chat-log" ref="chatLog">
      <div 
        v-for="(msg, index) in messages" 
        :key="index"
        class="message"
        :class="msg.role"
      >
        <div v-if="msg.role === 'assistant'" v-html="formatMessage(msg.content)"></div>
        <div v-else>{{ msg.content }}</div>
      </div>
      
      <div v-if="isLoading" class="message system">
        Thinking...
      </div>
    </div>

    <footer class="input-area">
      <input 
        v-model="input" 
        @keyup.enter="handleSend"
        class="command-input"
        ref="inputRef"
        type="text" 
        placeholder="What do you do?" 
        :disabled="isLoading || gameFinished"
        autofocus
      />
      <button @click="handleSend" class="send-btn" :disabled="isLoading || gameFinished">
        ACT
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import '../assets/css/main.css';
import { useGame } from '../composables/useGame';
import { useTemplateRef } from 'vue';

const { currentLevel, messages, sendMessage, isLoading, initializeGame, gameFinished } = useGame();
const input = ref('');
const inputRef = useTemplateRef('inputRef');
const chatLog = ref<HTMLElement | null>(null);

// Auto scroll to bottom
watch(messages, async () => {
  await nextTick();
  if (chatLog.value) {
    chatLog.value.scrollTop = chatLog.value.scrollHeight;
  }
}, { deep: true });

onMounted(() => {
  initializeGame();
});

const handleSend = async () => {
  if (!input.value) return;
  const txt = input.value;
  input.value = '';
  await sendMessage(txt);
  inputRef.value?.focus();
};

const formatMessage = (content: string) => {
    // Simple formatter to handle bolding or newlines if needed.
    // The AI returns text. We can convert newlines to <br>.
    return content.replace(/\n/g, '<br>');
}
</script>
