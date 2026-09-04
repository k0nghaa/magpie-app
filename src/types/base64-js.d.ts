// base64-js는 타입 선언을 번들하지 않고, @types/base64-js 설치는 기존 eslint peer-dep
// 충돌(ERESOLVE) 때문에 막혀서, 사용하는 API만 로컬로 선언합니다.
declare module 'base64-js' {
  export function toByteArray(b64: string): Uint8Array;
  export function fromByteArray(bytes: Uint8Array): string;
  export function byteLength(b64: string): number;
}
