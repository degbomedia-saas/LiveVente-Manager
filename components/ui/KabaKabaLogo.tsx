export function KabaKabaLogo({
  className = 'h-12 w-auto',
  light = false,
}: {
  className?: string
  light?: boolean
}) {
  const textColor = light ? '#0F172A' : '#FFFFFF'

  return (
    <svg
      viewBox="0 0 248 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="kaba kaba"
    >
      {/* Symbole K bicolore émeraude (#10B981) & cyan (#06B6D4) */}
      <g>
        {/* Barre verticale émeraude */}
        <rect x="4" y="6" width="10" height="40" rx="5" fill="#10B981" />
        {/* Bras supérieur cyan */}
        <path
          d="M17.5 25.5L32.5 8.5C34.2 6.6 37.1 6.5 39 8.2C40.8 9.8 40.9 12.7 39.2 14.6L26.5 28.8L17.5 25.5Z"
          fill="#06B6D4"
        />
        {/* Bras inférieur émeraude */}
        <path
          d="M20.5 22.8L39.5 38.2C41.4 39.8 41.7 42.6 40.1 44.5C38.5 46.4 35.7 46.7 33.8 45.1L16.5 30.8L20.5 22.8Z"
          fill="#10B981"
        />
        {/* Point vitesse cyan */}
        <circle cx="42" cy="26" r="3.5" fill="#06B6D4" />
      </g>

      {/* Typographie kaba kaba */}
      <text
        x="56"
        y="35"
        fill={textColor}
        fontFamily="var(--font-geist-sans), system-ui, -apple-system, sans-serif"
        fontSize="29"
        fontWeight="800"
        letterSpacing="-0.03em"
      >
        kaba kaba
      </text>

      {/* Point cyan sur le second mot */}
      <circle cx="235" cy="31" r="4" fill="#06B6D4" />
    </svg>
  )
}
