import { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string
}

export const TikTokIcon = ({ className = 'w-6 h-6', ...props }: IconProps) => (
  <svg className={className} fill='currentColor' viewBox='0 0 24 24' {...props}>
    <path d='M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V7.93a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.36z' />
  </svg>
)

export const PortfolioIcon = ({
  className = 'w-4 h-4',
  ...props
}: IconProps) => (
  <svg
    className={className}
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
    viewBox='0 0 24 24'
    {...props}
  >
    <rect x='2' y='7' width='20' height='14' rx='2.5' />
    <path d='M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' />
    <path d='M2 13h20' />
    <path d='M10 13v2' />
    <path d='M14 13v2' />
  </svg>
)

export const GitHubIcon = ({ className = 'w-4 h-4', ...props }: IconProps) => (
  <svg className={className} fill='currentColor' viewBox='0 0 24 24' {...props}>
    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
  </svg>
)

export const SpinnerIcon = ({ className = 'w-4 h-4', ...props }: IconProps) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns='http://www.w3.org/2000/svg'
    fill='none'
    viewBox='0 0 24 24'
    {...props}
  >
    <circle
      className='opacity-25'
      cx='12'
      cy='12'
      r='10'
      stroke='currentColor'
      strokeWidth='4'
    />
    <path
      className='opacity-75'
      fill='currentColor'
      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
    />
  </svg>
)

export const DownloadIcon = ({
  className = 'w-5 h-5',
  ...props
}: IconProps) => (
  <svg
    className={className}
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    {...props}
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    />
  </svg>
)

export const MusicIcon = ({ className = 'w-5 h-5', ...props }: IconProps) => (
  <svg
    className={className}
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    {...props}
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3'
    />
  </svg>
)

export const CheckIcon = ({ className = 'w-4 h-4', ...props }: IconProps) => (
  <svg className={className} fill='currentColor' viewBox='0 0 20 20' {...props}>
    <path
      fillRule='evenodd'
      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
      clipRule='evenodd'
    />
  </svg>
)

export const CloseIcon = ({ className = 'w-5 h-5', ...props }: IconProps) => (
  <svg
    className={className}
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    {...props}
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M6 6l12 12M18 6L6 18'
    />
  </svg>
)

export const TwitterXIcon = ({
  className = 'w-4 h-4',
  ...props
}: IconProps) => (
  <svg className={className} fill='currentColor' viewBox='0 0 24 24' {...props}>
    <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z' />
  </svg>
)

// Full-color brand badges — self-contained (own background + white glyph), so
// they render identically anywhere regardless of surrounding text color. The
// `instagram-gradient` id is shared across instances; the defs are identical,
// so duplicate ids resolve to the same gradient with no visual difference.
export const InstagramIcon = ({
  className = 'w-4 h-4',
  ...props
}: IconProps) => (
  <svg className={className} viewBox='0 0 24 24' fill='none' {...props}>
    <defs>
      <linearGradient
        id='instagram-gradient'
        x1='2'
        y1='22'
        x2='22'
        y2='2'
        gradientUnits='userSpaceOnUse'
      >
        <stop stopColor='#FEDA75' />
        <stop offset='0.25' stopColor='#FA7E1E' />
        <stop offset='0.5' stopColor='#D62976' />
        <stop offset='0.75' stopColor='#962FBF' />
        <stop offset='1' stopColor='#4F5BD5' />
      </linearGradient>
    </defs>
    <rect width='24' height='24' rx='6' fill='url(#instagram-gradient)' />
    <rect
      x='5.4'
      y='5.4'
      width='13.2'
      height='13.2'
      rx='4'
      fill='none'
      stroke='#fff'
      strokeWidth='1.7'
    />
    <circle
      cx='12'
      cy='12'
      r='3.3'
      fill='none'
      stroke='#fff'
      strokeWidth='1.7'
    />
    <circle cx='16.7' cy='7.3' r='1.15' fill='#fff' />
  </svg>
)

export const FacebookIcon = ({
  className = 'w-4 h-4',
  ...props
}: IconProps) => (
  <svg className={className} viewBox='0 0 24 24' fill='none' {...props}>
    <rect width='24' height='24' rx='6' fill='#1877F2' />
    <path
      d='M16.4 12.06h-2.62V20h-3.1v-7.94H8.86V9.4h1.82V7.85c0-2.15 1.28-3.35 3.24-3.35.94 0 1.93.17 1.93.17v2.12h-1.08c-1.06 0-1.4.66-1.4 1.34V9.4h2.37l-.38 2.66z'
      fill='#fff'
    />
  </svg>
)

export const YouTubeIcon = ({
  className = 'w-4 h-4',
  ...props
}: IconProps) => (
  <svg className={className} viewBox='0 0 24 24' fill='none' {...props}>
    <rect width='24' height='24' rx='6' fill='#FF0000' />
    <path d='M9.8 8.2 16 12l-6.2 3.8z' fill='#fff' />
  </svg>
)

// Utility component for the default image placeholder
export const getImagePlaceholderBase64 = () =>
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+'
