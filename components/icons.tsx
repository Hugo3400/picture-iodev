type IconProps = { size?: number; style?: React.CSSProperties }

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
})

export function Logo({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="var(--accent)" />
      <circle cx="12" cy="12" r="5" stroke="#0a0a0b" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.6" fill="#0a0a0b" />
    </svg>
  )
}

export function IconLock({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M7 10V7a5 5 0 0110 0v3" /></svg>
}

export function IconImage({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="9" r="1.6" /><path d="M21 16l-5.5-5.5a2 2 0 00-2.8 0L4 19" /></svg>
}

export function IconTrash({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
}

export function IconEdit({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></svg>
}

export function IconFolder({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
}

export function IconLink({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.49-1.49" /></svg>
}

export function IconClose({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}

export function IconChevronLeft({ size = 20, style }: IconProps) {
  return <svg {...base(size)} style={style}><polyline points="15 18 9 12 15 6" /></svg>
}

export function IconChevronRight({ size = 20, style }: IconProps) {
  return <svg {...base(size)} style={style}><polyline points="9 18 15 12 9 6" /></svg>
}

export function IconCheck({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><polyline points="20 6 9 17 4 12" /></svg>
}

export function IconUpload({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
}

export function IconDownload({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
}

export function IconGrid({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
}

export function IconUsers({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
}

export function IconClock({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
}

export function IconBell({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 21a2 2 0 004 0" /></svg>
}

export function IconSearch({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
}

export function IconLogout({ size = 16, style }: IconProps) {
  return <svg {...base(size)} style={style}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
}

export function IconDiscord({ size = 18, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 127.14 96.36" fill="currentColor" style={style}>
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
