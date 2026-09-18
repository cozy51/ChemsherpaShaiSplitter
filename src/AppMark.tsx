export default function AppMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="SHAlファイル分割">
      <defs>
        <linearGradient id="app-mark-tile" x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4ea5f9" />
          <stop offset=".55" stopColor="#1c74e0" />
          <stop offset="1" stopColor="#0a4db5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#app-mark-tile)" />
      <path d="M21 11h12l8.5 8.5v11.4L18 38.1V14a3 3 0 0 1 3-3z" fill="#fff" />
      <path d="M33 11l8.5 8.5H33z" fill="#a9cdff" />
      <path d="M21.5 41.6L45 35v12a3 3 0 0 1-3 3H24.5a3 3 0 0 1-3-3z" fill="#fff" opacity=".82" />
    </svg>
  )
}
