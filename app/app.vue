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
        <div
          v-if="msg.role === 'assistant'"
          v-html="formatMessage(msg.content)"
        ></div>
        <div v-else>{{ msg.content }}</div>
      </div>

      <div v-if="isLoading" class="message system">Thinking...</div>
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
      <button
        @click="handleSend"
        class="send-btn"
        :disabled="isLoading || gameFinished"
      >
        ACT
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import "../assets/css/main.css";
import { useGame } from "../composables/useGame";
import { useTemplateRef } from "vue";

const {
  currentLevel,
  messages,
  sendMessage,
  isLoading,
  initializeGame,
  gameFinished,
} = useGame();
const input = ref("");
const inputRef = useTemplateRef("inputRef");
const chatLog = ref<HTMLElement | null>(null);

// Auto scroll to bottom
watch(
  messages,
  async () => {
    await nextTick();
    if (chatLog.value) {
      chatLog.value.scrollTop = chatLog.value.scrollHeight;
    }
  },
  { deep: true }
);

onMounted(() => {
  initializeGame();
});

const handleCheatCode = (code: string): boolean => {
  const cheatMap: { [key: string]: number } = {
    "/imyourgod3": 2, // Level 3 (Dungeon 3)
    "/imyourgod6": 5, // Level 6 (Dungeon 6)
    "/imyourgod9": 8, // Level 9 (Dungeon 9)
  };

  const targetLevel = cheatMap[code.toLowerCase()];

  if (targetLevel !== undefined) {
    // Don't allow skipping backwards or to current level
    if (targetLevel <= currentLevel.value) {
      messages.value.push({
        role: "system",
        content: `You cannot skip to Dungeon ${
          targetLevel + 1
        } - you're already at or past it!`,
        level: currentLevel.value,
      });
      return true;
    }

    // Set game state for the new level
    gameFinished.value = false;
    currentLevel.value = targetLevel;

    // Add system message about cheat activation
    messages.value.push({
      role: "system",
      content: `*** CHEAT CODE ACTIVATED ***\nSkipping to Dungeon ${
        targetLevel + 1
      }...`,
      level: targetLevel,
    });

    // Initialize the new level
    setTimeout(() => initializeGame(), 500);

    return true;
  }

  return false;
};

const handleSend = async () => {
  if (!input.value) return;
  const txt = input.value;

  // Check for cheat codes before processing normal input
  if (handleCheatCode(txt)) {
    input.value = "";
    inputRef.value?.focus();
    return;
  }

  input.value = "";
  await sendMessage(txt);
  inputRef.value?.focus();
};

const formatMessage = (content: string) => {
  // Simple formatter to handle bolding or newlines if needed.
  // The AI returns text. We can convert newlines to <br>.
  return content.replace(/\n/g, "<br>");
};
</script>
