/**
 * 대화 상태 스토어 (Zustand).
 * 화면은 이 훅의 status/isAiSpeaking/error 를 구독하고 start/stop 만 호출합니다.
 */
import { create } from 'zustand';
import { ConversationController } from './conversationController';

export type ConversationStatus = 'idle' | 'connecting' | 'active' | 'error';

interface ConversationStore {
  status: ConversationStatus;
  /** AI가 말하는 중이면 true, 아니면(=듣는 중) false. */
  isAiSpeaking: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

// 컨트롤러는 직렬화 대상이 아니라 모듈 스코프에 보관합니다.
let controller: ConversationController | null = null;

export const useConversation = create<ConversationStore>((set, get) => ({
  status: 'idle',
  isAiSpeaking: false,
  error: null,

  start: () => {
    const status = get().status;
    if (status === 'connecting' || status === 'active') return;

    set({ status: 'connecting', error: null, isAiSpeaking: false });

    controller = new ConversationController({
      onConnecting: () => set({ status: 'connecting' }),
      onActive: () => set({ status: 'active' }),
      onAiSpeaking: (speaking) => set({ isAiSpeaking: speaking }),
      onError: (message) =>
        set({ status: 'error', error: message, isAiSpeaking: false }),
      onEnded: () => set({ status: 'idle', isAiSpeaking: false }),
    });
    void controller.start();
  },

  stop: () => {
    void controller?.stop();
    controller = null;
    set({ status: 'idle', isAiSpeaking: false });
  },
}));
