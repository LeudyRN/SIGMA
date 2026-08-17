import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#0B2B50',
        color: '#FFFFFF',
        display: 'flex',
        fontSize: 28,
        fontWeight: 800,
        height: '100%',
        justifyContent: 'center',
        letterSpacing: '-0.06em',
        width: '100%',
      }}
    >
      Σ
    </div>,
    size,
  );
}
