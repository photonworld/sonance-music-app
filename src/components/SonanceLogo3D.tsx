import React, { useId, useState } from 'react';

export type SonanceLogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface SonanceLogo3DProps {
  size?: SonanceLogoSize;
  isPlaying?: boolean;
  interactive?: boolean;
  animateFloat?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<SonanceLogoSize, string> = {
  sm: 'w-9 h-9',
  md: 'w-16 h-16',
  lg: 'w-28 h-28',
  xl: 'w-44 h-44 sm:w-52 sm:h-52',
};

/**
 * Tactile 3D extruded matte amber cassette logo inspired by soft-clay 3D product renders.
 * Features extruded bevel depth, corner screws, recessed tape slot, toothed spinning spools,
 * and smooth pointer-driven 3D perspective tilt.
 */
export const SonanceLogo3D: React.FC<SonanceLogo3DProps> = ({
  size = 'sm',
  isPlaying = false,
  interactive = false,
  animateFloat = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const [tilt, setTilt] = useState<{ rx: number; ry: number; hovered: boolean }>({
    rx: 0,
    ry: 0,
    hovered: false,
  });
  const [spinBump, setSpinBump] = useState(0);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    setTilt({
      rx: -ny * 16,
      ry: nx * 18,
      hovered: true,
    });
  };

  const handlePointerLeave = () => {
    if (!interactive) return;
    setTilt({ rx: 0, ry: 0, hovered: false });
  };

  const handleClick = () => {
    if (!interactive) return;
    setSpinBump((prev) => prev + 360);
  };

  const faceGradId = `sonance-face-${uid}`;
  const sideGradId = `sonance-side-${uid}`;
  const bridgeGradId = `sonance-bridge-${uid}`;
  const shadowGradId = `sonance-shadow-${uid}`;
  const slotGradId = `sonance-slot-${uid}`;

  // Reusable 6-tooth cassette spool path centered at (0,0)
  const spoolTeethAngles = [0, 60, 120, 180, 240, 300];

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={interactive ? handleClick : undefined}
      className={`relative inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer' : ''
      } ${SIZE_CLASSES[size]} ${className}`}
      style={{
        perspective: '680px',
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes sonanceCassetteFloat {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, -5px, 0); }
        }
        @keyframes sonanceReelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sonance-cassette-float {
          animation: sonanceCassetteFloat 4.2s ease-in-out infinite;
        }
        .sonance-reel-spin {
          animation: sonanceReelSpin 3.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sonance-cassette-float,
          .sonance-reel-spin {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className={`w-full h-full flex items-center justify-center ${
          animateFloat ? 'sonance-cassette-float' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry + spinBump}deg) scale(${
            tilt.hovered ? 1.07 : 1
          })`,
          transition:
            'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          viewBox="0 0 240 200"
          className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(180,98,20,0.28)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={faceGradId} x1="36" y1="30" x2="196" y2="165" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFD896" />
              <stop offset="52%" stopColor="#FFC067" />
              <stop offset="100%" stopColor="#F5A446" />
            </linearGradient>

            <linearGradient id={sideGradId} x1="28" y1="88" x2="188" y2="178" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E69234" />
              <stop offset="65%" stopColor="#D47E24" />
              <stop offset="100%" stopColor="#BA6516" />
            </linearGradient>

            <linearGradient id={bridgeGradId} x1="65" y1="125" x2="155" y2="155" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFD282" />
              <stop offset="100%" stopColor="#ECA042" />
            </linearGradient>

            <linearGradient id={slotGradId} x1="104" y1="78" x2="132" y2="112" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1B1A1F" />
              <stop offset="100%" stopColor="#35323B" />
            </linearGradient>

            <radialGradient id={shadowGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(180, 95, 18, 0.28)" />
              <stop offset="100%" stopColor="rgba(180, 95, 18, 0)" />
            </radialGradient>
          </defs>

          {/* Subtle ambient shadow ellipse underneath floating cassette */}
          {size !== 'sm' && (
            <ellipse cx="120" cy="176" rx="76" ry="12" fill={`url(#${shadowGradId})`} />
          )}

          {/* Tilted 3D Cassette Assembly matching the reference isometric pitch */}
          <g transform="translate(120, 96) rotate(-14) translate(-120, -96)">
            {/* Extruded 3D Side & Bottom Thickness Shell (depth offset: dx=-7, dy=+10) */}
            <g transform="translate(-7, 10)">
              <rect
                x="26"
                y="42"
                width="188"
                height="116"
                rx="14"
                fill={`url(#${sideGradId})`}
              />
            </g>

            {/* Connecting 3D bevel fill bridges at top-left & bottom-right corners */}
            <path
              d="M 27 52 L 20 62 L 20 154 C 20 162 25 168 33 168 L 195 168 L 205 158 Z"
              fill={`url(#${sideGradId})`}
            />

            {/* Primary Lit Cassette Front Face */}
            <rect
              x="26"
              y="42"
              width="188"
              height="116"
              rx="14"
              fill={`url(#${faceGradId})`}
              stroke="#FFE6B8"
              strokeWidth="1.5"
            />

            {/* Subtle inner bevel frame */}
            <rect
              x="31"
              y="47"
              width="178"
              height="106"
              rx="11"
              stroke="rgba(218, 128, 32, 0.22)"
              strokeWidth="1"
            />

            {/* Four Recessed Corner Ivory Screw Holes */}
            {[
              { x: 38, y: 54 },
              { x: 202, y: 54 },
              { x: 38, y: 146 },
              { x: 202, y: 146 },
            ].map((screw, idx) => (
              <g key={idx}>
                <circle cx={screw.x - 0.6} cy={screw.y + 0.8} r="3.6" fill="rgba(182, 98, 22, 0.42)" />
                <circle cx={screw.x} cy={screw.y} r="3.2" fill="#FFF8EE" />
              </g>
            ))}

            {/* Center Recessed Magnetic Tape Window (3D stepped interior) */}
            <rect
              x="101"
              y="81"
              width="38"
              height="26"
              rx="3"
              fill="#D98830"
              opacity="0.45"
            />
            <rect
              x="103"
              y="82"
              width="34"
              height="23"
              rx="2.5"
              fill={`url(#${slotGradId})`}
            />
            {/* 3D Inner Side Wall & Magnetic Tape Strip */}
            <path
              d="M 103 82 L 111 82 L 111 105 L 103 105 Z"
              fill="#4B4752"
              opacity="0.72"
            />
            <rect x="111" y="96" width="26" height="5" fill="#111014" opacity="0.85" />

            {/* Left Toothed Cassette Spool Reel */}
            <g transform="translate(74, 94)">
              {/* Recessed outer socket ring */}
              <circle cx="-1" cy="1" r="21.5" fill="rgba(196, 110, 26, 0.35)" />
              <circle cx="0" cy="0" r="20.5" fill="#F8AC4C" />
              <g className={isPlaying ? 'sonance-reel-spin' : ''}>
                <circle cx="0" cy="0" r="18.5" fill="#FFFFFF" />
                <circle cx="0" cy="0" r="13.5" fill="#FCE5BE" opacity="0.55" />
                <circle cx="0" cy="0" r="11" fill="#FFFFFF" />
                {spoolTeethAngles.map((deg) => (
                  <rect
                    key={deg}
                    x="-1.8"
                    y="-17.5"
                    width="3.6"
                    height="5.2"
                    rx="1"
                    fill="#F2A347"
                    transform={`rotate(${deg})`}
                  />
                ))}
                <circle cx="0" cy="0" r="8.2" fill="#FFFDF9" stroke="#F4AD57" strokeWidth="1" />
              </g>
            </g>

            {/* Right Toothed Cassette Spool Reel */}
            <g transform="translate(166, 94)">
              <circle cx="-1" cy="1" r="21.5" fill="rgba(196, 110, 26, 0.35)" />
              <circle cx="0" cy="0" r="20.5" fill="#F8AC4C" />
              <g className={isPlaying ? 'sonance-reel-spin' : ''}>
                <circle cx="0" cy="0" r="18.5" fill="#FFFFFF" />
                <circle cx="0" cy="0" r="13.5" fill="#FCE5BE" opacity="0.55" />
                <circle cx="0" cy="0" r="11" fill="#FFFFFF" />
                {spoolTeethAngles.map((deg) => (
                  <rect
                    key={deg}
                    x="-1.8"
                    y="-17.5"
                    width="3.6"
                    height="5.2"
                    rx="1"
                    fill="#F2A347"
                    transform={`rotate(${deg})`}
                  />
                ))}
                <circle cx="0" cy="0" r="8.2" fill="#FFFDF9" stroke="#F4AD57" strokeWidth="1" />
              </g>
            </g>

            {/* Classic Raised Bottom Trapezoidal Tape Bridge Contour */}
            <path
              d="M 62 158 L 76 130 C 78 127 81 125 85 125 L 155 125 C 159 125 162 127 164 130 L 178 158 Z"
              fill={`url(#${bridgeGradId})`}
              stroke="#FFE3B0"
              strokeWidth="1.2"
            />
            <path
              d="M 64 157 L 77 131 L 163 131 L 176 157"
              stroke="rgba(184, 98, 22, 0.25)"
              strokeWidth="1.4"
              fill="none"
            />
            {/* Two tiny guide pin holes inside the bottom cassette bridge */}
            <circle cx="93" cy="144" r="3" fill="#FFF8EE" />
            <circle cx="147" cy="144" r="3" fill="#FFF8EE" />
          </g>
        </svg>
      </div>
    </div>
  );
};
