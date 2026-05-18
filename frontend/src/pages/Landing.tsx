import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import PlanCard from '../components/PlanCard'

const plans = [
  { id: 'free' as const, title: 'Free', price: 'LKR 0/mo', limits: ['1 user', '10 invoices / mo', '5 clients', '50 expenses / mo'] },
  { id: 'professional' as const, title: 'Professional', price: 'LKR 4,900/mo', limits: ['3 users', '50 invoices / mo', '25 clients', 'Payroll up to 5'], highlighted: true },
  { id: 'business' as const, title: 'Business', price: 'LKR 12,900/mo', limits: ['10 users', '200 invoices / mo', '100 clients', 'Payroll up to 20'] },
  { id: 'enterprise' as const, title: 'Enterprise', price: 'Custom', limits: ['Unlimited everything', 'Dedicated support', 'Custom integrations'] },
]

const features = [
  { title: 'Invoicing & PDF', desc: 'Branded invoices with PDF export and client portal delivery.' },
  { title: 'Expense tracking', desc: 'Categories, receipts, and multi-currency support.' },
  { title: 'Payroll', desc: 'Salary runs, slips, and automated expense sync.' },
  { title: 'Client portal', desc: 'Clients view invoices, pay, and upload proof.' },
  { title: 'Employee portal', desc: 'Salary slips, tasks, leave, and KPIs.' },
  { title: 'Financial reports', desc: 'P&L, cashflow, revenue, and payroll insights.' },
]

export default function Landing() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      <header className="bg-[#1E3A5F] text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">GroovyMark Finance</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-blue-200">Features</a>
            <a href="#pricing" className="hover:text-blue-200">Pricing</a>
            <Link to="/login" className="hover:text-blue-200">Log in</Link>
            <Link to="/signup" className="bg-[#3B82F6] px-4 py-2 rounded-md font-semibold hover:bg-blue-500">Get started</Link>
          </nav>
          <button type="button" className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-3 text-sm">
            <a href="#features" onClick={() => setOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
            <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
            <Link to="/signup" onClick={() => setOpen(false)}>Get started</Link>
          </div>
        )}
      </header>

      <section className="bg-[#F8FAFC] py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-[#1E3A5F] max-w-3xl mx-auto leading-tight">
            Finance management built for growing teams
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Invoices, payroll, expenses and reporting — all in one place. Pick a plan and get started in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex justify-center bg-[#1E3A5F] text-white px-8 py-3 rounded-md font-semibold hover:bg-[#152a45]">
              Get started free
            </Link>
            <a href="#pricing" className="inline-flex justify-center border border-[#1E3A5F] text-[#1E3A5F] px-8 py-3 rounded-md font-semibold hover:bg-white">
              View plans
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center text-[#1E3A5F] mb-10">Everything you need</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <div key={f.title} className="rounded-lg border border-slate-200 p-6 bg-white shadow-sm">
              <h3 className="font-semibold text-[#1E3A5F]">{f.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="py-16 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-[#1E3A5F] mb-10">Pricing</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map(p => (
              <PlanCard
                key={p.id}
                id={p.id}
                title={p.title}
                price={p.price}
                limits={p.limits}
                highlighted={p.highlighted}
                onSelect={() => { window.location.href = `/signup?plan=${p.id}` }}
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between gap-6 text-sm text-slate-600">
          <div>
            <p className="font-bold text-[#1E3A5F]">GroovyMark Finance</p>
            <p className="mt-1">Run your company finances with confidence.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/login" className="hover:text-[#1E3A5F]">Admin login</Link>
            <Link to="/client-login" className="hover:text-[#1E3A5F]">Client portal</Link>
            <Link to="/employee-login" className="hover:text-[#1E3A5F]">Employee portal</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
