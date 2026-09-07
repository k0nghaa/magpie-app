/**
 * 화면 라우팅 상태 (조건부 렌더링용, 경량).
 *
 * M2는 화면이 2개(대화/설정)뿐이라 네비게이션 라이브러리 없이 이 스토어의 screen 값으로
 * App.tsx에서 조건부 렌더링한다. (M3에서 둥지 화면이 추가되면 react-navigation 도입 예정 —
 * DECISIONS.md 참조)
 */
import { create } from 'zustand';

export type AppScreen = 'conversation' | 'settings';

interface AppRouteStore {
  screen: AppScreen;
  navigate: (screen: AppScreen) => void;
}

export const useAppRoute = create<AppRouteStore>((set) => ({
  screen: 'conversation',
  navigate: (screen) => set({ screen }),
}));
