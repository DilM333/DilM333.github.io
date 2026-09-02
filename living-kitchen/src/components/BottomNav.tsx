import { NavLink } from 'react-router-dom'

const links = [
  { to: '/kitchen', label: 'Kitchen', icon: '🍽️' },
  { to: '/make', label: 'Make', icon: '✨' },
  { to: '/add', label: 'Add', icon: '➕' },
  { to: '/grocery', label: 'List', icon: '📝' },
  { to: '/favorites', label: 'Saved', icon: '❤️' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-ink/10 bg-cream/95 backdrop-blur px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:rounded-b-xl2">
      <div className="flex items-stretch justify-between">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                isActive ? 'text-clay' : 'text-ink/50'
              }`
            }
          >
            <span className="text-xl leading-none">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
