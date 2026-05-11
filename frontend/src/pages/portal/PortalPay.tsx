import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { portalApi, CURRENCY_SYMBOLS } from '../../services/api'
import { ArrowLeft, CreditCard, Building2, Upload, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PortalPay() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<any>(null)
  const [bankDetails, setBankDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bank' | 'payhere'>('bank')
  const [submitted, setSubmitted] = useState(false)

  // Bank transfer state
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // PayHere state
  const [payhereLoading, setPayhereLoading] = useState(false)
  const payhereFormRef = useRef<HTMLFormElement>(null)
  const [payhereParams, setPayhereParams] = useState<any>(null)

  // Copy state
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [invRes, bankRes] = await Promise.all([
          portalApi.invoice(Number(invoiceId)),
          portalApi.bankDetails()
        ])
        setInvoice(invRes.data)
        setBankDetails(bankRes.data)
        // Default tab: use invoice's payment_methods preference
        const methods = invRes.data?.payment_methods || 'bank'
        if ((methods === 'online' || methods === 'both') && bankRes.data?.enabled_gateways?.includes('payhere')) {
          setTab('payhere')
        } else {
          setTab('bank')
        }
      } catch {
        toast.error('Failed to load invoice')
        navigate('/portal/invoices')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [invoiceId])

  const sym = (inv: any) => CURRENCY_SYMBOLS[inv?.currency] || 'Rs.'

  async function handleSlipSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!slipFile) { toast.error('Please select a payment slip'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('invoice_id', String(invoiceId))
      fd.append('slip', slipFile)
      fd.append('reference', reference)
      fd.append('amount', String(invoice.total))
      fd.append('currency', invoice.currency || 'LKR')
      await portalApi.submitSlip(fd)
      setSubmitted(true)
      toast.success('Payment slip submitted!')
    } catch {
      toast.error('Failed to submit slip')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePayhere() {
    setPayhereLoading(true)
    try {
      const res = await portalApi.initiatePayhere(Number(invoiceId))
      setPayhereParams(res.data)
      // Auto-submit form after state update
      setTimeout(() => {
        if (payhereFormRef.current) payhereFormRef.current.submit()
      }, 100)
    } catch {
      toast.error('Failed to initiate payment')
      setPayhereLoading(false)
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setSlipFile(file)
    } else {
      toast.error('Only images or PDF accepted')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setSlipFile(file)
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!invoice) return null

  if (submitted) return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={36} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Slip Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Your payment slip for <span className="font-semibold text-slate-700">Invoice #{invoice.invoice_number}</span> has been submitted successfully.
          Our team will review and confirm within 1–2 business days.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-6 text-xs text-amber-700">
          Invoice status will be updated to <strong>Paid</strong> once the slip is verified.
        </div>
        <Link to="/portal/invoices" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
          Back to Invoices
        </Link>
      </div>
    </div>
  )

  // Which tabs to show: intersection of invoice's payment_methods and globally configured gateways
  const globalGateways: string[] = bankDetails?.enabled_gateways || ['bank_transfer']
  const invoiceMethods = invoice?.payment_methods || 'bank'
  const wantsBank = invoiceMethods === 'bank' || invoiceMethods === 'both'
  const wantsOnline = invoiceMethods === 'online' || invoiceMethods === 'both'
  const enabledGateways: string[] = [
    ...(wantsBank ? ['bank_transfer'] : []),
    ...(wantsOnline && globalGateways.includes('payhere') ? ['payhere'] : []),
  ].length > 0
    ? [...(wantsBank ? ['bank_transfer'] : []), ...(wantsOnline && globalGateways.includes('payhere') ? ['payhere'] : [])]
    : ['bank_transfer'] // fallback to bank if nothing resolved

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <Link to="/portal/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Invoices
      </Link>

      {/* Invoice Summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">Paying Invoice</p>
            <h2 className="text-xl font-bold text-slate-800">#{invoice.invoice_number}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{invoice.client_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Amount Due</p>
            <p className="text-2xl font-bold text-slate-800">{sym(invoice)} {Number(invoice.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{invoice.currency || 'LKR'}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-50 flex gap-6 text-xs text-slate-500">
          <span>Issue: <span className="text-slate-700 font-medium">{invoice.issue_date}</span></span>
          <span>Due: <span className={`font-medium ${invoice.status === 'Overdue' ? 'text-red-600' : 'text-slate-700'}`}>{invoice.due_date}</span></span>
          <span>Status: <span className={`font-medium ${invoice.status === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`}>{invoice.status}</span></span>
        </div>
      </div>

      {/* Overdue warning */}
      {invoice.status === 'Overdue' && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3.5 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          This invoice is overdue. Please settle it as soon as possible.
        </div>
      )}

      {/* Payment Method Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {enabledGateways.includes('bank_transfer') && (
            <button
              onClick={() => setTab('bank')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${tab === 'bank' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Building2 size={15} /> Bank Transfer
            </button>
          )}
          {enabledGateways.includes('payhere') && (
            <button
              onClick={() => setTab('payhere')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${tab === 'payhere' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CreditCard size={15} /> Pay Online
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Bank Transfer Tab */}
          {tab === 'bank' && (
            <div className="space-y-5">
              {/* Bank Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Transfer to this account</h3>
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  {[
                    { label: 'Bank', value: bankDetails?.bank_name || 'DFCC Bank Gampaha' },
                    { label: 'Account Name', value: bankDetails?.bank_account_name || 'Groovymark (pvt) Ltd' },
                    { label: 'Account Number', value: bankDetails?.bank_account_no || '102005870825', key: 'accno' },
                    { label: 'Branch', value: bankDetails?.bank_branch || 'Gampaha' },
                    { label: 'SWIFT Code', value: bankDetails?.bank_swift || 'DFCCLKLX', key: 'swift' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{item.value}</span>
                        {item.key && (
                          <button onClick={() => copyToClipboard(item.value, item.key!)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                            {copied === item.key ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Use invoice number <strong>#{invoice.invoice_number}</strong> as your transfer reference.</p>
              </div>

              {/* Slip Upload */}
              <form onSubmit={handleSlipSubmit} className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Upload Payment Slip</h3>

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50' : slipFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                >
                  {slipFile ? (
                    <div>
                      <CheckCircle size={24} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-emerald-700">{slipFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(slipFile.size / 1024).toFixed(0)} KB — click to change</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Drop your payment slip here, or <span className="text-indigo-600 font-medium">browse</span></p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG, or PDF — max 5MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

                {/* Reference */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Transaction Reference (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN123456"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!slipFile || submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {submitting ? 'Submitting...' : 'Submit Payment Slip'}
                </button>
              </form>
            </div>
          )}

          {/* PayHere Tab */}
          {tab === 'payhere' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                <CreditCard size={28} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Pay with PayHere</h3>
                <p className="text-sm text-slate-500 mt-1">Secure payment via credit/debit card or online banking</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Invoice</span><span className="font-medium text-slate-700">#{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-slate-500 mt-1.5">
                  <span>Amount</span><span className="font-bold text-slate-800">{sym(invoice)} {Number(invoice.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button
                onClick={handlePayhere}
                disabled={payhereLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all text-sm"
              >
                {payhereLoading ? 'Redirecting to PayHere...' : 'Pay Now with PayHere'}
              </button>
              <p className="text-xs text-slate-400">You will be redirected to PayHere's secure checkout page.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden PayHere form */}
      {payhereParams && (
        <form ref={payhereFormRef} method="POST" action={payhereParams.actionUrl} className="hidden">
          {Object.entries(payhereParams.params || {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ))}
        </form>
      )}
    </div>
  )
}
