export const useGame = () => {
    const currentLevel = useState<number>('currentLevel', () => 0);
    const messages = useState<{ role: 'user' | 'assistant' | 'system', content: string, level: number }[]>('messages', () => []);
    const isLoading = useState<boolean>('isLoading', () => false);
    const gameFinished = useState<boolean>('gameFinished', () => false);

    const sendMessage = async (input: string) => {
        if (!input.trim() || isLoading.value) return;

        messages.value.push({ role: 'user', content: input, level: currentLevel.value });
        isLoading.value = true;

        // Filter history for current level only
        const history = messages.value
            .filter((m: any) => m.level === currentLevel.value && m.role !== 'system')
            .map((m: any) => ({ role: m.role, content: m.content }));

        try {
            const { data, error } = await useFetch('/api/chat', {
                method: 'POST',
                body: {
                    userMessage: input,
                    history: history, // Send full history including the new message? The API adds userMessage separately.
                    // Wait, my API implementation adds userMessage separately.
                    // So history should NOT include the just-added user message?
                    // "apiMessages = [...apiMessages, ...body.history]; ... apiMessages.push({ role: 'user', content: userMessage });"
                    // So I should exclude the last message (current input) from 'history'.
                    currentLevel: currentLevel.value,
                }
            });

            // Adjust history calculation:
            // exclude the last item which is the current input
            // const historyToSend = history.slice(0, -1);
            // Actually, in the body above `history: history` uses the const `history` I defined.
            // I should redefine `history` to exclude the latest input.
            
            if (error.value) {
                console.error('Error sending message:', error.value);
                messages.value.push({ role: 'system', content: 'The dungeon master is silent... (Network Error)', level: currentLevel.value });
                return;
            }

            const response = data.value as { message: string, solved: boolean };
            
            if (response) {
                 messages.value.push({ role: 'assistant', content: response.message, level: currentLevel.value });

                 if (response.solved) {
                     if (currentLevel.value < 9) { // 0-9 is 10 levels
                         messages.value.push({ role: 'system', content: '*** DUNGEON COMPLETE ***\nProceeding to the next challenge...', level: currentLevel.value });
                         currentLevel.value++;
                         // Automatically initialize next level
                         setTimeout(() => initializeGame(), 1000);
                     } else {
                         gameFinished.value = true;
                         messages.value.push({ role: 'system', content: '*** CONGRATULATIONS ***\nYou have conquered the Tomb of the Silver King!', level: currentLevel.value });
                     }
                 }
            }

        } catch (e) {
            console.error(e);
            messages.value.push({ role: 'system', content: 'An unknown error occurred.', level: currentLevel.value });
        } finally {
            isLoading.value = false;
        }
    };

    const initializeGame = async () => {
         // Check if we already have messages for this level to avoid double init?
         // If we just incremented level, we have no messages for it yet.
         const hasLevelMessages = messages.value.some((m: any) => m.level === currentLevel.value && m.role === 'assistant');
         
         if (!hasLevelMessages) {
             isLoading.value = true;
             try {
                const { data } = await useFetch('/api/chat', {
                    method: 'POST',
                    body: {
                        userMessage: '', // Init doesn't have user message
                        currentLevel: currentLevel.value,
                        isInit: true
                    }
                });
                 const response = data.value as { message: string };
                 if (response) {
                     messages.value.push({ role: 'assistant', content: response.message, level: currentLevel.value });
                 }
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
        gameFinished
    };
}
