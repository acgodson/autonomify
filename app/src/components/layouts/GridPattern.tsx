function SpinningCube({
  className,
  delay,
  color,
  variant = 1,
}: {
  className: string
  delay: number
  color: string
  variant?: 1 | 2
}) {
  return (
    <div
      className={`${className} ${color} pointer-events-none`}
      style={{
        animation: `randomSpin${variant === 2 ? "2" : ""} ${10 + delay}s ease-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}

function MagicUnderline() {
  return (
    <svg
      className="absolute -bottom-4 left-0 w-full h-5"
      viewBox="0 0 200 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M3 12 C20 8, 40 16, 60 10 C80 4, 100 14, 120 8 C140 2, 160 12, 180 6 C190 3, 195 8, 197 10"
        stroke="url(#wandGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        className="animate-draw"
      />
      <defs>
        <linearGradient id="wandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function GridPattern() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="gridPattern"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="gridFade" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="gridMask">
            <rect width="100%" height="100%" fill="url(#gridFade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridPattern)" mask="url(#gridMask)" />
      </svg>

      <SpinningCube
        className="absolute top-24 left-12 w-8 h-8 rotate-45"
        delay={0}
        color="bg-amber-500/30"
        variant={1}
      />
      <SpinningCube
        className="absolute top-44 right-24 w-6 h-6 rotate-12"
        delay={3}
        color="bg-blue-500/35"
        variant={2}
      />
      <SpinningCube
        className="absolute top-72 left-1/4 w-10 h-10 rotate-45"
        delay={6}
        color="bg-purple-500/25"
        variant={1}
      />
      <SpinningCube
        className="absolute bottom-48 right-1/4 w-7 h-7 rotate-45"
        delay={9}
        color="bg-amber-500/30"
        variant={2}
      />
      <SpinningCube
        className="absolute top-1/3 right-16 w-9 h-9 rotate-12"
        delay={2}
        color="bg-cyan-500/25"
        variant={1}
      />
      <SpinningCube
        className="absolute top-1/2 left-20 w-6 h-6 rotate-45"
        delay={5}
        color="bg-green-500/30"
        variant={2}
      />
      <SpinningCube
        className="absolute bottom-72 left-1/3 w-8 h-8 rotate-12"
        delay={8}
        color="bg-pink-500/25"
        variant={1}
      />
      <SpinningCube
        className="absolute top-36 left-1/2 w-5 h-5 rotate-45"
        delay={4}
        color="bg-amber-400/20"
        variant={2}
      />
      <SpinningCube
        className="absolute bottom-32 right-16 w-7 h-7 rotate-12"
        delay={7}
        color="bg-blue-400/25"
        variant={1}
      />
    </div>
  )
}

export { MagicUnderline }
