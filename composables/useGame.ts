export const useGame = () => {
  const currentLevel = useState<number>("currentLevel", () => 0);
  const messages = useState<
    { role: "user" | "assistant" | "system"; content: string; level: number }[]
  >("messages", () => []);
  const isLoading = useState<boolean>("isLoading", () => false);
  const gameFinished = useState<boolean>("gameFinished", () => false);

  const sendMessage = async (input: string) => {
    if (!input.trim() || isLoading.value) return;

    messages.value.push({
      role: "user",
      content: input,
      level: currentLevel.value,
    });
    isLoading.value = true;

    // Filter history for current level only
    const history = messages.value
      .filter((m: any) => m.level === currentLevel.value && m.role !== "system")
      .map((m: any) => ({ role: m.role, content: m.content }));

    try {
      const { data, error } = await useFetch("/api/chat", {
        method: "POST",
        body: {
          userMessage: input,
          history: history,
          currentLevel: currentLevel.value,
        },
      });

      if (error.value) {
        console.error("Error sending message:", error.value);

        // Extract the error message from the statusMessage if available
        const errorMessage =
          error.value.statusMessage || error.value.message || "Network error";

        // Provide user-friendly error messaging
        let userMessage =
          "Sorry, I'm having trouble responding right now. Please try again.";

        // Customize message based on error type
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out")
        ) {
          userMessage = "The request timed out. Please try again.";
        } else if (errorMessage.includes("rate limit")) {
          userMessage =
            "Too many requests. Please wait a moment before trying again.";
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("Unable to reach")
        ) {
          userMessage =
            "Network connection issue. Please check your connection and try again.";
        } else if (errorMessage.includes("authentication")) {
          userMessage = "Service configuration error. Please contact support.";
        }

        messages.value.push({
          role: "system",
          content: userMessage,
          level: currentLevel.value,
        });
        return;
      }

      const response = data.value as { message: string; solved: boolean };

      if (!response) {
        messages.value.push({
          role: "system",
          content: "Received an unexpected response. Please try again.",
          level: currentLevel.value,
        });
        return;
      }

      messages.value.push({
        role: "assistant",
        content: response.message,
        level: currentLevel.value,
      });

      if (response.solved) {
        if (currentLevel.value < 9) {
          // 0-9 is 10 levels
          messages.value.push({
            role: "system",
            content:
              "*** DUNGEON COMPLETE ***\nProceeding to the next challenge...",
            level: currentLevel.value,
          });
          currentLevel.value++;
          // Automatically initialize next level
          setTimeout(() => initializeGame(), 1000);
        } else {
          gameFinished.value = true;
          messages.value.push({
            role: "system",
            content:
              "*** CONGRATULATIONS ***\nYou have conquered the Tomb of the Silver King!",
            level: currentLevel.value,
          });
        }
      }
    } catch (e: any) {
      console.error("Unexpected error in sendMessage:", e);
      messages.value.push({
        role: "system",
        content: "An unexpected error occurred. Please try again.",
        level: currentLevel.value,
      });
    } finally {
      isLoading.value = false;
    }
  };

  const initializeGame = async () => {
    // Check if we already have messages for this level to avoid double init
    const hasLevelMessages = messages.value.some(
      (m: any) => m.level === currentLevel.value && m.role === "assistant"
    );

    if (!hasLevelMessages) {
      isLoading.value = true;
      try {
        const { data, error } = await useFetch("/api/chat", {
          method: "POST",
          body: {
            userMessage: "",
            currentLevel: currentLevel.value,
            isInit: true,
          },
        });

        if (error.value) {
          console.error("Error initializing game:", error.value);

          const errorMessage =
            error.value.statusMessage || error.value.message || "Network error";
          let userMessage =
            "Failed to initialize the dungeon. Please refresh the page to try again.";

          // Customize message based on error type
          if (
            errorMessage.includes("timeout") ||
            errorMessage.includes("timed out")
          ) {
            userMessage =
              "The dungeon failed to load (timeout). Please refresh the page to try again.";
          } else if (
            errorMessage.includes("network") ||
            errorMessage.includes("Unable to reach")
          ) {
            userMessage =
              "Cannot reach the game server. Please check your connection and refresh the page.";
          }

          messages.value.push({
            role: "system",
            content: userMessage,
            level: currentLevel.value,
          });
          return;
        }

        const response = data.value as { message: string };
        if (response && response.message) {
          messages.value.push({
            role: "assistant",
            content: response.message,
            level: currentLevel.value,
          });
        } else {
          messages.value.push({
            role: "system",
            content:
              "Failed to load the dungeon. Please refresh the page to try again.",
            level: currentLevel.value,
          });
        }
      } catch (e: any) {
        console.error("Unexpected error in initializeGame:", e);
        messages.value.push({
          role: "system",
          content:
            "An unexpected error occurred while loading the dungeon. Please refresh the page.",
          level: currentLevel.value,
        });
      } finally {
        isLoading.value = false;
      }
    }
  };

  return {
    currentLevel,
    messages,
    isLoading,
    sendMessage,
    initializeGame,
    gameFinished,
  };
};
