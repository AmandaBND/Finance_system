import { Link } from 'react-router-dom'

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans text-center">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Access denied</h1>
      <p className="text-slate-600 mt-2 max-w-md">Your role does not allow access to this area.</p>
      <Link to="/login" className="mt-8 inline-block bg-[#1E3A5F] text-white px-6 py-2.5 rounded-md text-sm font-semibold">Back to login</Link>
    </div>
  )
}
